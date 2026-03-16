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
from scanner import scan_library, get_scan_status, fetch_igdb_metadata, process_rom_file
from dat_parser import DatParser, PLATFORM_DISPLAY_NAMES
from downloader import process_download, active_downloads

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
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy.orm import selectinload

    query = select(models.Game).options(selectinload(models.Game.platform))

    if platform_id:
        query = query.where(models.Game.platform_id == platform_id)

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
    await db.delete(dl)
    await db.commit()
    return {"ok": True}


@app.get("/api/downloads/platforms")
async def get_platform_options():
    """Return available platform slugs for the download form."""
    return [{"slug": k, "name": v} for k, v in PLATFORM_DISPLAY_NAMES.items()]


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
