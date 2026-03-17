"""
ROM scanner: walks the ROM directory, computes hashes, matches against DAT entries,
then fetches metadata from IGDB.
"""
import asyncio
import hashlib
import json
import logging
import os
import zlib
from pathlib import Path
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

import igdb as igdb_client
import models
from dat_parser import (
    detect_platform_from_path,
    clean_rom_name,
    extract_region,
    extract_revision,
    ROM_EXTENSIONS,
    PLATFORM_DISPLAY_NAMES,
)

logger = logging.getLogger(__name__)

ALL_ROM_EXTENSIONS = {ext for exts in ROM_EXTENSIONS.values() for ext in exts}

# Global scan state
scan_state = {
    "running": False,
    "progress": 0,
    "total": 0,
    "current_file": "",
    "found": 0,
    "updated": 0,
    "errors": 0,
}


def get_scan_status() -> dict:
    return dict(scan_state)


async def compute_hashes(file_path: str) -> dict:
    """Compute CRC32, MD5, SHA1 of a file asynchronously (chunked)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _compute_hashes_sync, file_path)


def _compute_hashes_sync(file_path: str) -> dict:
    crc32_val = 0
    md5 = hashlib.md5()
    sha1 = hashlib.sha1()
    chunk_size = 1024 * 1024  # 1 MB

    try:
        with open(file_path, "rb") as f:
            while chunk := f.read(chunk_size):
                crc32_val = zlib.crc32(chunk, crc32_val)
                md5.update(chunk)
                sha1.update(chunk)
    except OSError as e:
        logger.error(f"Error hashing {file_path}: {e}")
        return {}

    return {
        "crc32": format(crc32_val & 0xFFFFFFFF, "08x"),
        "md5": md5.hexdigest(),
        "sha1": sha1.hexdigest(),
    }


async def get_or_create_platform(
    db: AsyncSession,
    slug: str,
    igdb_client_id: str = "",
    igdb_client_secret: str = "",
) -> models.Platform:
    result = await db.execute(select(models.Platform).where(models.Platform.slug == slug))
    platform = result.scalar_one_or_none()

    if platform:
        return platform

    display_name = PLATFORM_DISPLAY_NAMES.get(slug, slug.upper())
    platform = models.Platform(name=display_name, slug=slug)

    # Try to get IGDB platform info
    if igdb_client_id and igdb_client_secret:
        try:
            info = await igdb_client.search_platform(igdb_client_id, igdb_client_secret, display_name)
            if info:
                platform.igdb_id = info.get("igdb_id")
                platform.cover_url = info.get("cover_url")
        except Exception as e:
            logger.warning(f"Failed to get IGDB platform for {slug}: {e}")

    db.add(platform)
    await db.flush()
    return platform


async def lookup_dat_entry(db: AsyncSession, crc32: str, md5: str, sha1: str) -> Optional[dict]:
    """Look up a ROM in the imported DAT entries by hash."""
    from sqlalchemy import or_

    conditions = []
    if crc32:
        conditions.append(models.DatEntry.crc32 == crc32)
    if md5:
        conditions.append(models.DatEntry.md5 == md5)
    if sha1:
        conditions.append(models.DatEntry.sha1 == sha1)

    if not conditions:
        return None

    result = await db.execute(
        select(models.DatEntry).where(or_(*conditions)).limit(1)
    )
    entry = result.scalar_one_or_none()
    if entry:
        return {
            "game_name": entry.game_name,
            "rom_name": entry.rom_name,
            "crc32": entry.crc32,
            "md5": entry.md5,
            "sha1": entry.sha1,
        }
    return None


async def fetch_igdb_metadata(
    db: AsyncSession,
    title: str,
    platform_igdb_id: Optional[int],
    igdb_client_id: str,
    igdb_client_secret: str,
) -> Optional[dict]:
    """Search IGDB for a game and return its metadata."""
    if not igdb_client_id or not igdb_client_secret:
        return None

    try:
        results = await igdb_client.search_game(
            igdb_client_id,
            igdb_client_secret,
            title,
            platform_igdb_id=platform_igdb_id,
            limit=1,
        )
        if results:
            return results[0]
    except Exception as e:
        logger.warning(f"IGDB search failed for '{title}': {e}")

    return None


def collect_rom_files(rom_path: str) -> list[str]:
    """Recursively collect all ROM files from the given path."""
    files = []
    for root, dirs, filenames in os.walk(rom_path):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith(".")]
        for filename in filenames:
            if filename.startswith("."):
                continue
            ext = Path(filename).suffix.lower()
            if ext in ALL_ROM_EXTENSIONS:
                files.append(os.path.join(root, filename))
    return sorted(files)


async def scan_library(
    db: AsyncSession,
    rom_path: str,
    igdb_client_id: str = "",
    igdb_client_secret: str = "",
):
    """Main scan function. Discovers ROMs, computes hashes, matches metadata."""
    global scan_state

    if scan_state["running"]:
        return

    scan_state.update({
        "running": True,
        "progress": 0,
        "total": 0,
        "current_file": "Collecting files...",
        "found": 0,
        "updated": 0,
        "errors": 0,
    })

    try:
        rom_files = collect_rom_files(rom_path)
        scan_state["total"] = len(rom_files)
        logger.info(f"Found {len(rom_files)} ROM files to scan")

        platform_cache: dict[str, models.Platform] = {}

        for i, file_path in enumerate(rom_files):
            scan_state["progress"] = i
            scan_state["current_file"] = os.path.basename(file_path)

            try:
                await process_rom_file(
                    db=db,
                    file_path=file_path,
                    rom_path=rom_path,
                    platform_cache=platform_cache,
                    igdb_client_id=igdb_client_id,
                    igdb_client_secret=igdb_client_secret,
                )
            except Exception as e:
                logger.error(f"Error processing {file_path}: {e}")
                scan_state["errors"] += 1
                continue

        await db.commit()
        scan_state["progress"] = scan_state["total"]

    finally:
        scan_state["running"] = False
        scan_state["current_file"] = "Done"
        logger.info(
            f"Scan complete. Found: {scan_state['found']}, "
            f"Updated: {scan_state['updated']}, Errors: {scan_state['errors']}"
        )


async def process_rom_file(
    db: AsyncSession,
    file_path: str,
    rom_path: str,
    platform_cache: dict,
    igdb_client_id: str,
    igdb_client_secret: str,
):
    global scan_state

    relative_path = os.path.relpath(file_path, rom_path)
    file_name = os.path.basename(file_path)

    # Check if already in DB
    result = await db.execute(
        select(models.Game).where(models.Game.file_path == relative_path)
    )
    existing_game = result.scalar_one_or_none()

    file_size = os.path.getsize(file_path)

    # Detect platform
    slug = detect_platform_from_path(relative_path) or "other"

    if slug not in platform_cache:
        platform_cache[slug] = await get_or_create_platform(
            db, slug, igdb_client_id, igdb_client_secret
        )
    platform = platform_cache[slug]

    if existing_game:
        # Skip if file size unchanged (already processed)
        if existing_game.file_size == file_size and existing_game.igdb_id:
            return
    else:
        scan_state["found"] += 1

    # Compute hashes
    hashes = await compute_hashes(file_path)
    crc32 = hashes.get("crc32")
    md5 = hashes.get("md5")
    sha1 = hashes.get("sha1")

    # DAT lookup
    dat_entry = await lookup_dat_entry(db, crc32, md5, sha1)
    dat_verified = dat_entry is not None
    dat_title = dat_entry["game_name"] if dat_entry else None

    # Determine search title - always strip () and [] tags for IGDB lookup
    search_title = clean_rom_name(dat_title or file_name)
    region = extract_region(file_name)
    revision = extract_revision(file_name)

    # IGDB metadata
    igdb_data = None
    if search_title:
        igdb_data = await fetch_igdb_metadata(
            db, search_title, platform.igdb_id, igdb_client_id, igdb_client_secret
        )

    display_title = (igdb_data or {}).get("title") or dat_title or clean_rom_name(file_name) or file_name

    if existing_game:
        existing_game.file_size = file_size
        existing_game.crc32 = crc32
        existing_game.md5 = md5
        existing_game.sha1 = sha1
        existing_game.dat_verified = dat_verified
        existing_game.dat_title = dat_title
        existing_game.region = region
        existing_game.revision = revision
        if igdb_data:
            existing_game.title = display_title
            existing_game.igdb_id = igdb_data.get("igdb_id")
            existing_game.cover_url = igdb_data.get("cover_url")
            existing_game.summary = igdb_data.get("summary")
            existing_game.rating = igdb_data.get("rating")
            existing_game.release_date = igdb_data.get("release_date")
            existing_game.genres = json.dumps(igdb_data.get("genres") or [])
            existing_game.developer = igdb_data.get("developer")
            existing_game.publisher = igdb_data.get("publisher")
            existing_game.screenshots = json.dumps(igdb_data.get("screenshots") or [])
        scan_state["updated"] += 1
    else:
        game = models.Game(
            title=display_title,
            file_name=file_name,
            file_path=relative_path,
            file_size=file_size,
            platform_id=platform.id,
            crc32=crc32,
            md5=md5,
            sha1=sha1,
            dat_verified=dat_verified,
            dat_title=dat_title,
            region=region,
            revision=revision,
        )
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
        db.add(game)

    # Flush every 50 games to avoid holding too much in memory
    if scan_state["found"] % 50 == 0:
        await db.flush()
