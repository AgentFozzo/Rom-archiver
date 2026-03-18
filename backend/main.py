import asyncio
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Optional, List

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, delete

import models
import schemas
import igdb as igdb_client
from database import get_db, init_db
from scanner import (
    scan_library, get_scan_status, fetch_igdb_metadata, process_rom_file,
    reorganize_library, get_reorganize_status,
    check_library_integrity, find_duplicate_games,
    verify_games, get_verify_status,
)
from dat_parser import DatParser, PLATFORM_DISPLAY_NAMES
from downloader import process_download, active_downloads, EXTRA_SUBDIRS
from bios_db import lookup_bios_by_md5, lookup_bios_by_filename, PLATFORM_BIOS_INFO

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger(__name__)

ROM_PATH = os.getenv("ROM_PATH", "/roms")
DATA_PATH = os.getenv("DATA_PATH", "/data")
IGDB_CLIENT_ID = os.getenv("IGDB_CLIENT_ID", "")
IGDB_CLIENT_SECRET = os.getenv("IGDB_CLIENT_SECRET", "")

app = FastAPI(title="ROM Archiver", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup():
    os.makedirs(f"{DATA_PATH}/images", exist_ok=True)
    os.makedirs(f"{DATA_PATH}/dats", exist_ok=True)
    await init_db()

    # Seed default settings if missing
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        for key, value in [
            ("igdb_client_id", IGDB_CLIENT_ID),
            ("igdb_client_secret", IGDB_CLIENT_SECRET),
            ("rom_path", ROM_PATH),
            ("auto_scan_on_start", "false"),
            ("download_images", "true"),
        ]:
            result = await db.execute(select(models.Setting).where(models.Setting.key == key))
            if not result.scalar_one_or_none():
                db.add(models.Setting(key=key, value=value))
        await db.commit()

        result = await db.execute(select(models.Setting).where(models.Setting.key == "auto_scan_on_start"))
        setting = result.scalar_one_or_none()
        if setting and setting.value == "true":
            asyncio.create_task(_background_scan(ROM_PATH))


async def _background_scan(rom_path: str):
    from database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        cid, csec = await get_igdb_creds(db)
        await scan_library(db, rom_path, cid, csec)


async def get_igdb_creds(db: AsyncSession) -> tuple[str, str]:
    result = await db.execute(
        select(models.Setting).where(
            models.Setting.key.in_(["igdb_client_id", "igdb_client_secret"])
        )
    )
    settings = {s.key: s.value or "" for s in result.scalars()}
    return settings.get("igdb_client_id", ""), settings.get("igdb_client_secret", "")


# ─── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
async def health():
    return {"status": "ok"}


# ─── Platforms ─────────────────────────────────────────────────────────────────

@app.get("/api/platforms", response_model=List[schemas.PlatformOut])
async def list_platforms(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Platform).order_by(models.Platform.name))
    platforms = result.scalars().all()

    out = []
    for p in platforms:
        count_result = await db.execute(
            select(func.count()).select_from(models.Game).where(models.Game.platform_id == p.id)
        )
        count = count_result.scalar() or 0
        out.append(schemas.PlatformOut(
            id=p.id,
            name=p.name,
            slug=p.slug,
            igdb_id=p.igdb_id,
            cover_url=p.cover_url,
            game_count=count,
        ))
    return out


@app.get("/api/platforms/{platform_id}", response_model=schemas.PlatformOut)
async def get_platform(platform_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Platform).where(models.Platform.id == platform_id))
    platform = result.scalar_one_or_none()
    if not platform:
        raise HTTPException(404, "Platform not found")
    count_result = await db.execute(
        select(func.count()).select_from(models.Game).where(models.Game.platform_id == platform_id)
    )
    return schemas.PlatformOut(
        id=platform.id,
        name=platform.name,
        slug=platform.slug,
        igdb_id=platform.igdb_id,
        cover_url=platform.cover_url,
        game_count=count_result.scalar() or 0,
    )


@app.delete("/api/platforms/{platform_id}")
async def delete_platform(platform_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a platform if it has no games. Also removes the empty folder from disk."""
    result = await db.execute(select(models.Platform).where(models.Platform.id == platform_id))
    platform = result.scalar_one_or_none()
    if not platform:
        raise HTTPException(404, "Platform not found")

    count_result = await db.execute(
        select(func.count()).select_from(models.Game).where(models.Game.platform_id == platform_id)
    )
    count = count_result.scalar() or 0
    if count > 0:
        raise HTTPException(400, f"Platform still has {count} game(s). Remove all games first.")

    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH

    # Remove the folder from disk if it exists and is empty
    folder = os.path.join(rom_path, platform.slug)
    folder_removed = False
    if os.path.isdir(folder):
        try:
            os.rmdir(folder)  # only succeeds if empty
            folder_removed = True
        except OSError:
            pass  # not empty or permission issue — still delete the DB record

    await db.delete(platform)
    await db.commit()
    return {"ok": True, "folder_removed": folder_removed}


# ─── Games ─────────────────────────────────────────────────────────────────────

def _serialize_game(game: models.Game) -> schemas.GameOut:
    genres = []
    screenshots = []
    if game.genres:
        try:
            genres = json.loads(game.genres)
        except Exception:
            genres = []
    if game.screenshots:
        try:
            screenshots = json.loads(game.screenshots)
        except Exception:
            screenshots = []

    platform = None
    if game.platform:
        platform = schemas.PlatformOut(
            id=game.platform.id,
            name=game.platform.name,
            slug=game.platform.slug,
            igdb_id=game.platform.igdb_id,
            cover_url=game.platform.cover_url,
            game_count=0,
        )

    return schemas.GameOut(
        id=game.id,
        title=game.title,
        file_name=game.file_name,
        file_path=game.file_path,
        file_size=game.file_size,
        platform_id=game.platform_id,
        igdb_id=game.igdb_id,
        cover_url=game.cover_url,
        summary=game.summary,
        rating=game.rating,
        release_date=game.release_date,
        genres=genres,
        developer=game.developer,
        publisher=game.publisher,
        screenshots=screenshots,
        region=game.region,
        revision=game.revision,
        crc32=game.crc32,
        md5=game.md5,
        sha1=game.sha1,
        dat_verified=game.dat_verified,
        dat_title=game.dat_title,
        is_favorite=game.is_favorite or False,
        trailer_youtube_id=game.trailer_youtube_id,
        created_at=game.created_at,
        platform=platform,
    )


@app.get("/api/games", response_model=dict)
async def list_games(
    platform_id: Optional[int] = None,
    search: Optional[str] = None,
    sort: str = "title",
    order: str = "asc",
    page: int = 1,
    limit: int = 50,
    favorites_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload

    query = select(models.Game).options(selectinload(models.Game.platform))

    if platform_id:
        query = query.where(models.Game.platform_id == platform_id)

    if favorites_only:
        query = query.where(models.Game.is_favorite == True)

    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(models.Game.title.ilike(pattern), models.Game.file_name.ilike(pattern))
        )

    # Sorting
    sort_map = {
        "title": models.Game.title,
        "rating": models.Game.rating,
        "release_date": models.Game.release_date,
        "file_size": models.Game.file_size,
    }
    sort_col = sort_map.get(sort, models.Game.title)
    if order == "desc":
        query = query.order_by(sort_col.desc().nulls_last())
    else:
        query = query.order_by(sort_col.asc().nulls_last())

    # Total count
    count_query = select(func.count()).select_from(models.Game)
    if platform_id:
        count_query = count_query.where(models.Game.platform_id == platform_id)
    if favorites_only:
        count_query = count_query.where(models.Game.is_favorite == True)
    if search:
        count_query = count_query.where(
            or_(models.Game.title.ilike(f"%{search}%"), models.Game.file_name.ilike(f"%{search}%"))
        )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    games = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "limit": limit,
        "games": [_serialize_game(g) for g in games],
    }


@app.get("/api/games/{game_id}", response_model=schemas.GameOut)
async def get_game(game_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(models.Game)
        .options(selectinload(models.Game.platform))
        .where(models.Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")
    return _serialize_game(game)


@app.patch("/api/games/{game_id}", response_model=schemas.GameOut)
async def update_game(game_id: int, body: schemas.GameUpdate, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(models.Game)
        .options(selectinload(models.Game.platform))
        .where(models.Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")

    for field, value in body.model_dump(exclude_none=True).items():
        if field == "genres":
            setattr(game, field, json.dumps(value))
        else:
            setattr(game, field, value)

    await db.commit()
    await db.refresh(game)
    return _serialize_game(game)


@app.delete("/api/games/{game_id}")
async def delete_game(game_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Game).where(models.Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")
    await db.delete(game)
    await db.commit()
    return {"ok": True}


@app.post("/api/games/batch", response_model=schemas.BatchResult)
async def batch_game_action(
    body: schemas.BatchAction,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Bulk delete, refresh-metadata, or reassign-platform for a list of game IDs."""
    if not body.game_ids:
        raise HTTPException(400, "No game IDs provided")

    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH

    if body.action == "delete":
        affected = 0
        for gid in body.game_ids:
            result = await db.execute(select(models.Game).where(models.Game.id == gid))
            game = result.scalar_one_or_none()
            if not game:
                continue
            full_path = os.path.join(rom_path, game.file_path)
            if os.path.isfile(full_path):
                try:
                    os.remove(full_path)
                except OSError:
                    pass
            await db.delete(game)
            affected += 1
        await db.commit()
        return schemas.BatchResult(ok=True, affected=affected)

    elif body.action == "reassign-platform":
        if not body.platform_slug:
            raise HTTPException(400, "platform_slug required for reassign-platform")
        cid, csec = await get_igdb_creds(db)
        from scanner import get_or_create_platform
        platform = await get_or_create_platform(db, body.platform_slug, cid, csec)
        affected = 0
        for gid in body.game_ids:
            from sqlalchemy.orm import selectinload as _sil
            result = await db.execute(
                select(models.Game).options(_sil(models.Game.platform)).where(models.Game.id == gid)
            )
            game = result.scalar_one_or_none()
            if not game:
                continue
            old_path = os.path.join(rom_path, game.file_path)
            dest_dir = os.path.join(rom_path, body.platform_slug)
            os.makedirs(dest_dir, exist_ok=True)
            dest = os.path.join(dest_dir, game.file_name)
            if os.path.exists(dest) and dest != old_path:
                stem, ext = Path(game.file_name).stem, Path(game.file_name).suffix
                c = 1
                while os.path.exists(dest):
                    dest = os.path.join(dest_dir, f"{stem} ({c}){ext}"); c += 1
            if os.path.isfile(old_path):
                os.rename(old_path, dest)
            game.file_path = os.path.relpath(dest, rom_path)
            game.file_name = os.path.basename(dest)
            game.platform_id = platform.id
            affected += 1
        await db.commit()
        return schemas.BatchResult(ok=True, affected=affected)

    elif body.action == "refresh-metadata":
        # Run in background so the API returns immediately
        cid, csec = await get_igdb_creds(db)
        game_ids = list(body.game_ids)

        async def _do_refresh():
            from database import AsyncSessionLocal
            from sqlalchemy.orm import selectinload as _sil
            import json as _json
            async with AsyncSessionLocal() as s:
                for gid in game_ids:
                    try:
                        r = await s.execute(
                            select(models.Game).options(_sil(models.Game.platform)).where(models.Game.id == gid)
                        )
                        game = r.scalar_one_or_none()
                        if not game:
                            continue
                        search_title = game.dat_title or game.title
                        from scanner import fetch_igdb_metadata
                        igdb_data = await fetch_igdb_metadata(
                            s, search_title,
                            game.platform.igdb_id if game.platform else None,
                            cid, csec,
                        )
                        if igdb_data:
                            game.igdb_id = igdb_data.get("igdb_id")
                            game.cover_url = igdb_data.get("cover_url")
                            game.summary = igdb_data.get("summary")
                            game.rating = igdb_data.get("rating")
                            game.release_date = igdb_data.get("release_date")
                            game.genres = _json.dumps(igdb_data.get("genres") or [])
                            game.developer = igdb_data.get("developer")
                            game.publisher = igdb_data.get("publisher")
                            game.screenshots = _json.dumps(igdb_data.get("screenshots") or [])
                            game.trailer_youtube_id = igdb_data.get("trailer_youtube_id")
                            game.title = igdb_data.get("title") or game.title
                    except Exception as e:
                        logger.warning(f"Batch refresh failed for game {gid}: {e}")
                await s.commit()

        background_tasks.add_task(_do_refresh)
        return schemas.BatchResult(ok=True, affected=len(body.game_ids), message="Refresh started in background")

    else:
        raise HTTPException(400, f"Unknown action: {body.action}")


@app.post("/api/games/{game_id}/favorite", response_model=schemas.GameOut)
async def toggle_favorite(game_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(models.Game).options(selectinload(models.Game.platform)).where(models.Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")
    game.is_favorite = not (game.is_favorite or False)
    await db.commit()
    await db.refresh(game)
    return _serialize_game(game)


@app.post("/api/games/{game_id}/reassign-platform", response_model=schemas.GameOut)
async def reassign_game_platform(
    game_id: int,
    body: schemas.PlatformReassign,
    db: AsyncSession = Depends(get_db),
):
    """Move a game file to a different platform folder and update the DB."""
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(models.Game)
        .options(selectinload(models.Game.platform))
        .where(models.Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")

    new_slug = body.platform_slug.strip().lower()
    if not new_slug:
        raise HTTPException(400, "platform_slug required")

    rom_path_result = await db.execute(
        select(models.Setting).where(models.Setting.key == "rom_path")
    )
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH

    old_full_path = os.path.join(rom_path, game.file_path)
    cid, csec = await get_igdb_creds(db)
    from scanner import get_or_create_platform
    platform = await get_or_create_platform(db, new_slug, cid, csec)

    dest_dir = os.path.join(rom_path, new_slug)
    os.makedirs(dest_dir, exist_ok=True)
    dest_path = os.path.join(dest_dir, game.file_name)

    if os.path.exists(dest_path) and dest_path != old_full_path:
        stem = Path(game.file_name).stem
        ext = Path(game.file_name).suffix
        counter = 1
        while os.path.exists(dest_path):
            dest_path = os.path.join(dest_dir, f"{stem} ({counter}){ext}")
            counter += 1

    if os.path.isfile(old_full_path):
        os.rename(old_full_path, dest_path)

    game.file_path = os.path.relpath(dest_path, rom_path)
    game.file_name = os.path.basename(dest_path)
    game.platform_id = platform.id
    await db.commit()

    result2 = await db.execute(
        select(models.Game)
        .options(selectinload(models.Game.platform))
        .where(models.Game.id == game_id)
    )
    game = result2.scalar_one_or_none()
    return _serialize_game(game)


@app.get("/api/games/{game_id}/download")
async def download_game(game_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Game).where(models.Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")

    # Get rom path from settings
    rom_path_result = await db.execute(
        select(models.Setting).where(models.Setting.key == "rom_path")
    )
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH

    full_path = os.path.join(rom_path, game.file_path)
    if not os.path.isfile(full_path):
        raise HTTPException(404, "ROM file not found on disk")

    return FileResponse(
        path=full_path,
        filename=game.file_name,
        media_type="application/octet-stream",
    )


@app.post("/api/games/{game_id}/refresh")
async def refresh_game_metadata(game_id: int, db: AsyncSession = Depends(get_db)):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(models.Game)
        .options(selectinload(models.Game.platform))
        .where(models.Game.id == game_id)
    )
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")

    cid, csec = await get_igdb_creds(db)
    if not cid or not csec:
        raise HTTPException(400, "IGDB credentials not configured")

    search_title = game.dat_title or game.title
    igdb_data = await fetch_igdb_metadata(db, search_title, game.platform.igdb_id if game.platform else None, cid, csec)

    if igdb_data:
        game.igdb_id = igdb_data.get("igdb_id")
        game.cover_url = igdb_data.get("cover_url")
        game.summary = igdb_data.get("summary")
        game.rating = igdb_data.get("rating")
        game.release_date = igdb_data.get("release_date")
        game.genres = json.dumps(igdb_data.get("genres") or [])
        game.developer = igdb_data.get("developer")
        game.publisher = igdb_data.get("publisher")
        game.screenshots = json.dumps(igdb_data.get("screenshots") or [])
        game.trailer_youtube_id = igdb_data.get("trailer_youtube_id")
        game.title = igdb_data.get("title") or game.title
        await db.commit()
        await db.refresh(game)

    return _serialize_game(game)


# ─── IGDB Search ───────────────────────────────────────────────────────────────

@app.get("/api/igdb/search", response_model=List[schemas.IGDBSearchResult])
async def igdb_search(
    q: str = Query(..., min_length=1),
    platform_igdb_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
):
    cid, csec = await get_igdb_creds(db)
    if not cid or not csec:
        raise HTTPException(400, "IGDB credentials not configured")

    results = await igdb_client.search_game(cid, csec, q, platform_igdb_id=platform_igdb_id, limit=8)
    return [schemas.IGDBSearchResult(**r) for r in results]


# ─── Scanner ───────────────────────────────────────────────────────────────────

@app.post("/api/scan")
async def start_scan(background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    status = get_scan_status()
    if status["running"]:
        raise HTTPException(409, "Scan already running")

    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH

    background_tasks.add_task(_background_scan, rom_path)
    return {"message": "Scan started"}


@app.get("/api/scan/status", response_model=schemas.ScanStatus)
async def scan_status():
    return get_scan_status()


# ─── Library Tools ─────────────────────────────────────────────────────────────

@app.post("/api/library/reorganize")
async def start_reorganize(background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    status = get_reorganize_status()
    if status["running"]:
        raise HTTPException(409, "Reorganize already running")

    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH
    cid, csec = await get_igdb_creds(db)

    async def _run():
        from database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await reorganize_library(session, rom_path, cid, csec)

    background_tasks.add_task(_run)
    return {"message": "Reorganize started"}


@app.get("/api/library/reorganize/status", response_model=schemas.ReorganizeStatus)
async def reorganize_status():
    return get_reorganize_status()


@app.get("/api/library/integrity", response_model=schemas.IntegrityResult)
async def library_integrity(db: AsyncSession = Depends(get_db)):
    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH
    result = await check_library_integrity(db, rom_path)
    return {
        "missing": [_serialize_game(g) for g in result["missing"]],
        "total_checked": result["total_checked"],
    }


@app.delete("/api/library/integrity/missing")
async def remove_missing_games(db: AsyncSession = Depends(get_db)):
    """Remove DB entries for ROM files that no longer exist on disk."""
    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH
    result = await check_library_integrity(db, rom_path)
    count = 0
    for game in result["missing"]:
        await db.delete(game)
        count += 1
    await db.commit()
    return {"removed": count}


@app.get("/api/library/duplicates")
async def library_duplicates(db: AsyncSession = Depends(get_db)):
    groups = await find_duplicate_games(db)
    return [
        {
            "match_type": g.get("match_type", "crc32"),
            "crc32": g["crc32"],
            "games": [_serialize_game(game) for game in g["games"]],
        }
        for g in groups
    ]


@app.delete("/api/library/duplicates/auto-clean")
async def auto_clean_duplicates(db: AsyncSession = Depends(get_db)):
    """
    For each duplicate group, keep the 'best' copy and delete the rest from DB and disk.
    Best = has IGDB metadata > has DAT title > largest file size.
    """
    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH

    from scanner import find_duplicate_games as _find_dupes

    groups = await _find_dupes(db)
    removed = 0
    freed_bytes = 0

    for group in groups:
        games = group["games"]
        if len(games) < 2:
            continue

        # Score each game: higher = better copy to keep
        def score(g):
            s = 0
            if g.igdb_id:
                s += 100
            if g.cover_url:
                s += 20
            if g.dat_verified:
                s += 10
            if g.dat_title:
                s += 5
            s += (g.file_size or 0) // (1024 * 1024)  # MB bonus
            return s

        games_sorted = sorted(games, key=score, reverse=True)
        keep = games_sorted[0]
        to_delete = games_sorted[1:]

        for game in to_delete:
            full_path = os.path.join(rom_path, game.file_path)
            try:
                if os.path.isfile(full_path):
                    freed_bytes += os.path.getsize(full_path)
                    os.remove(full_path)
            except OSError:
                pass
            await db.delete(game)
            removed += 1

    await db.commit()
    return {"removed": removed, "freed_bytes": freed_bytes}


@app.post("/api/library/verify")
async def start_verify(background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    status = get_verify_status()
    if status["running"]:
        raise HTTPException(409, "Verification already running")

    async def _run():
        from database import AsyncSessionLocal
        async with AsyncSessionLocal() as session:
            await verify_games(session)

    background_tasks.add_task(_run)
    return {"message": "Verification started"}


@app.get("/api/library/verify/status", response_model=schemas.VerifyStatus)
async def verify_status():
    return get_verify_status()


@app.delete("/api/downloads/temp-cleanup", response_model=schemas.TempCleanupResult)
async def cleanup_temp_downloads(db: AsyncSession = Depends(get_db)):
    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH
    temp_dir = os.path.join(rom_path, ".tmp_downloads")
    deleted = 0
    freed_bytes = 0
    if os.path.isdir(temp_dir):
        for fname in os.listdir(temp_dir):
            fpath = os.path.join(temp_dir, fname)
            if os.path.isfile(fpath):
                try:
                    freed_bytes += os.path.getsize(fpath)
                    os.remove(fpath)
                    deleted += 1
                except OSError:
                    pass
        try:
            os.rmdir(temp_dir)
        except OSError:
            pass
    return {"deleted": deleted, "freed_bytes": freed_bytes}


@app.delete("/api/library/empty-folders")
async def cleanup_empty_folders(db: AsyncSession = Depends(get_db)):
    """Recursively remove empty directories under the ROM path (skips hidden dirs)."""
    rom_path_result = await db.execute(select(models.Setting).where(models.Setting.key == "rom_path"))
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH

    removed = []
    # Walk bottom-up so children are removed before parents
    for dirpath, dirnames, filenames in os.walk(rom_path, topdown=False):
        # Skip hidden directories entirely
        if any(part.startswith('.') for part in Path(dirpath).relative_to(rom_path).parts):
            continue
        if dirpath == rom_path:
            continue
        # Remove if truly empty (no files, no subdirs remaining)
        try:
            if not os.listdir(dirpath):
                os.rmdir(dirpath)
                removed.append(os.path.relpath(dirpath, rom_path))
        except OSError:
            pass

    return {"removed": len(removed), "folders": removed}


# ─── BIOS / System Files ──────────────────────────────────────────────────────

@app.get("/api/bios", response_model=List[schemas.BiosFileOut])
async def list_bios(
    platform_slug: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(models.BiosFile).order_by(models.BiosFile.platform_slug, models.BiosFile.filename)
    if platform_slug:
        query = query.where(models.BiosFile.platform_slug == platform_slug)
    result = await db.execute(query)
    return result.scalars().all()


@app.get("/api/bios/platforms", response_model=List[schemas.BiosPlatformInfo])
async def list_bios_platforms(db: AsyncSession = Depends(get_db)):
    # Count uploaded files per platform
    count_result = await db.execute(
        select(models.BiosFile.platform_slug, func.count())
        .group_by(models.BiosFile.platform_slug)
    )
    counts = {row[0]: row[1] for row in count_result}

    out = []
    for slug, info in PLATFORM_BIOS_INFO.items():
        out.append(schemas.BiosPlatformInfo(
            slug=slug,
            name=info["name"],
            needs=info.get("needs", []),
            emulators=info.get("emulators", []),
            uploaded_count=counts.get(slug, 0),
        ))
    return out


@app.post("/api/bios/upload", response_model=List[schemas.BiosFileOut])
async def upload_bios(
    files: List[UploadFile] = File(...),
    platform_slug: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    from scanner import _compute_hashes_sync

    bios_dir = f"{DATA_PATH}/bios"
    os.makedirs(bios_dir, exist_ok=True)

    uploaded = []

    for file in files:
        if not file.filename:
            continue

        # Save to temp first
        temp_path = os.path.join(bios_dir, f".tmp_{file.filename}")
        try:
            with open(temp_path, "wb") as f:
                shutil.copyfileobj(file.file, f)

            # Hash it
            hashes = _compute_hashes_sync(temp_path)
            md5 = hashes.get("md5", "")
            sha1 = hashes.get("sha1", "")
            file_size = os.path.getsize(temp_path)

            # Try to identify by hash or filename
            known = lookup_bios_by_md5(md5)
            if not known:
                known = lookup_bios_by_filename(file.filename)

            detected_platform = platform_slug
            description = None
            category = "bios"
            verified = False

            if known:
                detected_platform = detected_platform or known.get("platform")
                description = known.get("description")
                category = known.get("category", "bios")
                verified = True

            if not detected_platform:
                detected_platform = "other"

            # Move to platform subfolder
            platform_dir = os.path.join(bios_dir, detected_platform)
            os.makedirs(platform_dir, exist_ok=True)
            final_path = os.path.join(platform_dir, file.filename)

            # Avoid overwriting
            if os.path.exists(final_path):
                # Replace existing
                os.remove(final_path)
                # Also remove old DB entry
                await db.execute(
                    delete(models.BiosFile).where(models.BiosFile.file_path == final_path)
                )

            os.rename(temp_path, final_path)

            bios = models.BiosFile(
                filename=file.filename,
                platform_slug=detected_platform,
                category=category,
                file_path=final_path,
                file_size=file_size,
                md5=md5,
                sha1=sha1,
                description=description,
                verified=verified,
            )
            db.add(bios)
            await db.flush()
            uploaded.append(bios)

        except Exception as e:
            logger.error(f"Failed to upload BIOS file {file.filename}: {e}")
            if os.path.isfile(temp_path):
                os.remove(temp_path)
            continue

    await db.commit()
    for b in uploaded:
        await db.refresh(b)
    return uploaded


@app.get("/api/bios/{bios_id}/download")
async def download_bios(bios_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.BiosFile).where(models.BiosFile.id == bios_id))
    bios = result.scalar_one_or_none()
    if not bios:
        raise HTTPException(404, "BIOS file not found")
    if not os.path.isfile(bios.file_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        path=bios.file_path,
        filename=bios.filename,
        media_type="application/octet-stream",
    )


@app.delete("/api/bios/{bios_id}")
async def delete_bios(bios_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.BiosFile).where(models.BiosFile.id == bios_id))
    bios = result.scalar_one_or_none()
    if not bios:
        raise HTTPException(404, "BIOS file not found")
    if os.path.isfile(bios.file_path):
        os.remove(bios.file_path)
    await db.delete(bios)
    await db.commit()
    return {"ok": True}


# ─── DAT Files ─────────────────────────────────────────────────────────────────

@app.get("/api/dats", response_model=List[schemas.DatFileOut])
async def list_dats(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.DatFile).order_by(models.DatFile.name))
    return result.scalars().all()


@app.post("/api/dats/import", response_model=List[schemas.DatFileOut])
async def import_dats(files: List[UploadFile] = File(...), db: AsyncSession = Depends(get_db)):
    dats_dir = f"{DATA_PATH}/dats"
    os.makedirs(dats_dir, exist_ok=True)

    imported = []
    errors = []

    for file in files:
        if not file.filename or not file.filename.endswith(".dat"):
            errors.append(f"{file.filename or 'unknown'}: not a .dat file")
            continue

        dest_path = os.path.join(dats_dir, file.filename)
        try:
            with open(dest_path, "wb") as f:
                shutil.copyfileobj(file.file, f)

            parser = DatParser(dest_path)
            header, entries = parser.parse()

            # Detect platform
            platform_slug = parser.detect_platform_slug()
            platform_id = None
            if platform_slug:
                result = await db.execute(select(models.Platform).where(models.Platform.slug == platform_slug))
                platform = result.scalar_one_or_none()
                if platform:
                    platform_id = platform.id

            dat_name = header.get("name") or file.filename

            dat_file = models.DatFile(
                name=dat_name,
                platform_id=platform_id,
                file_path=dest_path,
                entry_count=len(entries),
            )
            db.add(dat_file)
            await db.flush()

            for entry in entries:
                db.add(models.DatEntry(
                    dat_file_id=dat_file.id,
                    game_name=entry["game_name"],
                    rom_name=entry["rom_name"],
                    crc32=entry.get("crc32"),
                    md5=entry.get("md5"),
                    sha1=entry.get("sha1"),
                    size=entry.get("size"),
                ))

            await db.commit()
            await db.refresh(dat_file)
            imported.append(dat_file)

        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")
            if os.path.isfile(dest_path):
                os.remove(dest_path)
            continue

    if not imported and errors:
        raise HTTPException(400, "; ".join(errors))

    return imported


@app.delete("/api/dats/{dat_id}")
async def delete_dat(dat_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.DatFile).where(models.DatFile.id == dat_id))
    dat = result.scalar_one_or_none()
    if not dat:
        raise HTTPException(404, "DAT file not found")

    # Remove entries
    await db.execute(delete(models.DatEntry).where(models.DatEntry.dat_file_id == dat_id))

    # Remove file
    if os.path.isfile(dat.file_path):
        os.remove(dat.file_path)

    await db.delete(dat)
    await db.commit()
    return {"ok": True}


# ─── Settings ──────────────────────────────────────────────────────────────────

@app.get("/api/settings", response_model=schemas.SettingsOut)
async def get_settings(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.Setting))
    settings = {s.key: s.value or "" for s in result.scalars()}
    return schemas.SettingsOut(
        igdb_client_id=settings.get("igdb_client_id", ""),
        igdb_client_secret=settings.get("igdb_client_secret", ""),
        rom_path=settings.get("rom_path", ROM_PATH),
        auto_scan_on_start=settings.get("auto_scan_on_start", "false") == "true",
        download_images=settings.get("download_images", "true") == "true",
    )


@app.put("/api/settings")
async def update_settings(body: schemas.SettingsOut, db: AsyncSession = Depends(get_db)):
    updates = {
        "igdb_client_id": body.igdb_client_id,
        "igdb_client_secret": body.igdb_client_secret,
        "rom_path": body.rom_path,
        "auto_scan_on_start": "true" if body.auto_scan_on_start else "false",
        "download_images": "true" if body.download_images else "false",
    }
    for key, value in updates.items():
        result = await db.execute(select(models.Setting).where(models.Setting.key == key))
        setting = result.scalar_one_or_none()
        if setting:
            setting.value = value
        else:
            db.add(models.Setting(key=key, value=value))
    await db.commit()
    return {"ok": True}


# ─── Downloads ─────────────────────────────────────────────────────────────────

@app.get("/api/downloads", response_model=List[schemas.DownloadOut])
async def list_downloads(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Download).order_by(models.Download.created_at.desc()).limit(50)
    )
    downloads = result.scalars().all()
    # Merge live progress for active downloads
    out = []
    for dl in downloads:
        d = schemas.DownloadOut.model_validate(dl)
        if dl.id in active_downloads:
            live = active_downloads[dl.id]
            d.downloaded_bytes = live.get("downloaded_bytes", d.downloaded_bytes)
            d.total_bytes = live.get("total_bytes", d.total_bytes)
            d.speed_bps = live.get("speed_bps", d.speed_bps)
            d.progress = live.get("progress", d.progress)
        out.append(d)
    return out


@app.post("/api/downloads", response_model=schemas.DownloadOut)
async def create_download(
    body: schemas.DownloadCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    dl = models.Download(
        url=body.url,
        platform_slug=body.platform_slug,
        extra_type=body.extra_type or None,
        target_game_id=body.target_game_id or None,
        status="pending",
    )
    db.add(dl)
    await db.commit()
    await db.refresh(dl)

    from database import AsyncSessionLocal
    background_tasks.add_task(process_download, dl.id, AsyncSessionLocal)
    return dl


@app.delete("/api/downloads/{download_id}")
async def delete_download(download_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.Download).where(models.Download.id == download_id)
    )
    dl = result.scalar_one_or_none()
    if not dl:
        raise HTTPException(404, "Download not found")

    # Clean up any leftover temp file
    rom_path_result = await db.execute(
        select(models.Setting).where(models.Setting.key == "rom_path")
    )
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH
    temp_dir = os.path.join(rom_path, ".tmp_downloads")
    if dl.filename:
        temp_file = os.path.join(temp_dir, f"{dl.id}_{dl.filename}")
        if os.path.isfile(temp_file):
            try:
                os.remove(temp_file)
            except OSError:
                pass
    # Also try glob pattern in case filename changed mid-download
    if os.path.isdir(temp_dir):
        for fname in os.listdir(temp_dir):
            if fname.startswith(f"{dl.id}_"):
                try:
                    os.remove(os.path.join(temp_dir, fname))
                except OSError:
                    pass
        try:
            if not os.listdir(temp_dir):
                os.rmdir(temp_dir)
        except OSError:
            pass

    await db.delete(dl)
    await db.commit()
    return {"ok": True}


@app.get("/api/downloads/platforms")
async def get_platform_options():
    """Return available platform slugs for the download form."""
    return [{"slug": k, "name": v} for k, v in PLATFORM_DISPLAY_NAMES.items()]


# ─── Game Extras ───────────────────────────────────────────────────────────────

@app.get("/api/games/{game_id}/extras", response_model=List[schemas.GameExtraOut])
async def list_game_extras(game_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.GameExtra)
        .where(models.GameExtra.game_id == game_id)
        .order_by(models.GameExtra.extra_type, models.GameExtra.filename)
    )
    return result.scalars().all()


@app.post("/api/games/{game_id}/extras/upload", response_model=List[schemas.GameExtraOut])
async def upload_game_extras(
    game_id: int,
    files: List[UploadFile] = File(...),
    extra_type: str = Query("other"),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(models.Game).where(models.Game.id == game_id))
    game = result.scalar_one_or_none()
    if not game:
        raise HTTPException(404, "Game not found")

    rom_path_result = await db.execute(
        select(models.Setting).where(models.Setting.key == "rom_path")
    )
    rom_path_setting = rom_path_result.scalar_one_or_none()
    rom_path = (rom_path_setting.value if rom_path_setting else None) or ROM_PATH

    valid_types = {"mod", "update", "dlc", "cheat", "other"}
    if extra_type not in valid_types:
        extra_type = "other"

    subdir = EXTRA_SUBDIRS.get(extra_type, "extras")
    dest_dir = os.path.join(rom_path, ".game_extras", str(game_id), subdir)
    os.makedirs(dest_dir, exist_ok=True)

    uploaded = []
    for file in files:
        if not file.filename:
            continue
        final_path = os.path.join(dest_dir, file.filename)
        # Avoid overwriting
        if os.path.exists(final_path):
            stem = Path(file.filename).stem
            ext = Path(file.filename).suffix
            counter = 1
            while os.path.exists(final_path):
                final_path = os.path.join(dest_dir, f"{stem} ({counter}){ext}")
                counter += 1
        try:
            with open(final_path, "wb") as f:
                shutil.copyfileobj(file.file, f)
            file_size = os.path.getsize(final_path)
            extra = models.GameExtra(
                game_id=game_id,
                filename=os.path.basename(final_path),
                file_path=final_path,
                file_size=file_size,
                extra_type=extra_type,
            )
            db.add(extra)
            await db.flush()
            uploaded.append(extra)
        except Exception as e:
            logger.error(f"Failed to upload extra for game {game_id}: {e}")
            if os.path.isfile(final_path):
                os.remove(final_path)

    await db.commit()
    for ex in uploaded:
        await db.refresh(ex)
    return uploaded


@app.get("/api/games/{game_id}/extras/{extra_id}/download")
async def download_game_extra(game_id: int, extra_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.GameExtra).where(
            models.GameExtra.id == extra_id,
            models.GameExtra.game_id == game_id,
        )
    )
    extra = result.scalar_one_or_none()
    if not extra:
        raise HTTPException(404, "Extra file not found")
    if not os.path.isfile(extra.file_path):
        raise HTTPException(404, "File not found on disk")
    return FileResponse(
        path=extra.file_path,
        filename=extra.filename,
        media_type="application/octet-stream",
    )


@app.delete("/api/games/{game_id}/extras/{extra_id}")
async def delete_game_extra(game_id: int, extra_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(models.GameExtra).where(
            models.GameExtra.id == extra_id,
            models.GameExtra.game_id == game_id,
        )
    )
    extra = result.scalar_one_or_none()
    if not extra:
        raise HTTPException(404, "Extra file not found")
    if os.path.isfile(extra.file_path):
        os.remove(extra.file_path)
    await db.delete(extra)
    await db.commit()
    return {"ok": True}


# ─── Stats ─────────────────────────────────────────────────────────────────────

@app.get("/api/stats")
async def get_stats(db: AsyncSession = Depends(get_db)):
    total_games = (await db.execute(select(func.count()).select_from(models.Game))).scalar() or 0
    total_platforms = (await db.execute(select(func.count()).select_from(models.Platform))).scalar() or 0
    verified_games = (await db.execute(
        select(func.count()).select_from(models.Game).where(models.Game.dat_verified == True)
    )).scalar() or 0
    total_size = (await db.execute(select(func.sum(models.Game.file_size)).select_from(models.Game))).scalar() or 0
    return {
        "total_games": total_games,
        "total_platforms": total_platforms,
        "verified_games": verified_games,
        "total_size_bytes": total_size,
    }


# ─── Serve frontend ────────────────────────────────────────────────────────────

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(STATIC_DIR):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        index = os.path.join(STATIC_DIR, "index.html")
        return FileResponse(index)
