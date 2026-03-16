"""
ROM Download Manager: downloads ROMs from URLs, hashes them,
identifies via DAT lookup, and organizes into platform folders.
"""
import asyncio
import json
import logging
import os
import re
import time
from datetime import datetime
from pathlib import Path
from typing import Optional
from urllib.parse import unquote, urlparse

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import igdb as igdb_client
import models
from dat_parser import (
    clean_rom_name,
    detect_platform_from_path,
    extract_region,
    extract_revision,
    PLATFORM_DISPLAY_NAMES,
    ALL_ROM_EXTENSIONS,
    ROM_EXTENSIONS,
)
from scanner import compute_hashes, lookup_dat_entry, get_or_create_platform

logger = logging.getLogger(__name__)

# Track active downloads for real-time progress
active_downloads: dict[int, dict] = {}


def filename_from_url(url: str) -> str:
    """Extract a filename from a URL."""
    parsed = urlparse(url)
    path = unquote(parsed.path)
    name = Path(path).name
    if not name or '.' not in name:
        return "download.bin"
    return name


def filename_from_headers(headers: dict) -> Optional[str]:
    """Extract filename from Content-Disposition header."""
    cd = headers.get("content-disposition", "")
    if not cd:
        return None
    match = re.search(r'filename\*?=["\']?(?:UTF-8\'\')?([^"\';\s]+)', cd, re.IGNORECASE)
    if match:
        return unquote(match.group(1))
    return None


def detect_platform_from_extension(filename: str) -> Optional[str]:
    """Detect platform from file extension."""
    ext = Path(filename).suffix.lower()
    for slug, exts in ROM_EXTENSIONS.items():
        if ext in exts:
            return slug
    return None


async def process_download(download_id: int, db_factory):
    """Main download pipeline: download → hash → identify → organize."""
    async with db_factory() as db:
        result = await db.execute(
            select(models.Download).where(models.Download.id == download_id)
        )
        dl = result.scalar_one_or_none()
        if not dl:
            return

        rom_path_result = await db.execute(
            select(models.Setting).where(models.Setting.key == "rom_path")
        )
        rom_path_setting = rom_path_result.scalar_one_or_none()
        rom_path = (rom_path_setting.value if rom_path_setting else None) or "/roms"

        try:
            # Phase 1: Download
            dl.status = "downloading"
            await db.commit()

            temp_dir = os.path.join(rom_path, ".tmp_downloads")
            os.makedirs(temp_dir, exist_ok=True)

            filename = filename_from_url(dl.url)
            temp_path = os.path.join(temp_dir, f"{dl.id}_{filename}")

            await download_file(dl, temp_path, db)

            # Get actual filename from download if we got one
            if dl.filename and dl.filename != filename:
                new_temp = os.path.join(temp_dir, f"{dl.id}_{dl.filename}")
                os.rename(temp_path, new_temp)
                temp_path = new_temp
                filename = dl.filename

            # Phase 2: Hash
            dl.status = "hashing"
            await db.commit()

            hashes = await compute_hashes(temp_path)
            crc32 = hashes.get("crc32")
            md5 = hashes.get("md5")
            sha1 = hashes.get("sha1")

            # Phase 3: DAT lookup
            dat_entry = await lookup_dat_entry(db, crc32, md5, sha1)
            dat_verified = dat_entry is not None
            dat_title = dat_entry["game_name"] if dat_entry else None

            # Determine final name
            if dat_title:
                ext = Path(filename).suffix
                final_name = dat_title + ext
            else:
                final_name = filename

            # Detect platform
            platform_slug = dl.platform_slug
            if not platform_slug:
                platform_slug = detect_platform_from_extension(filename)
            if not platform_slug:
                platform_slug = "other"

            # Phase 4: Move to correct folder
            dl.status = "moving"
            await db.commit()

            platform_dir = os.path.join(rom_path, platform_slug)
            os.makedirs(platform_dir, exist_ok=True)

            final_path = os.path.join(platform_dir, final_name)
            # Avoid overwriting
            if os.path.exists(final_path):
                stem = Path(final_name).stem
                ext = Path(final_name).suffix
                counter = 1
                while os.path.exists(final_path):
                    final_path = os.path.join(platform_dir, f"{stem} ({counter}){ext}")
                    counter += 1

            os.rename(temp_path, final_path)
            file_size = os.path.getsize(final_path)
            relative_path = os.path.relpath(final_path, rom_path)

            # Get IGDB credentials
            cid_result = await db.execute(
                select(models.Setting).where(
                    models.Setting.key.in_(["igdb_client_id", "igdb_client_secret"])
                )
            )
            creds = {s.key: s.value or "" for s in cid_result.scalars()}
            igdb_cid = creds.get("igdb_client_id", "")
            igdb_csec = creds.get("igdb_client_secret", "")

            # Create platform
            platform = await get_or_create_platform(db, platform_slug, igdb_cid, igdb_csec)

            # IGDB search
            search_title = dat_title or clean_rom_name(filename)
            igdb_data = None
            if search_title and igdb_cid and igdb_csec:
                try:
                    results = await igdb_client.search_game(
                        igdb_cid, igdb_csec, search_title,
                        platform_igdb_id=platform.igdb_id, limit=1,
                    )
                    if results:
                        igdb_data = results[0]
                except Exception as e:
                    logger.warning(f"IGDB search failed for download: {e}")

            display_title = (igdb_data or {}).get("title") or dat_title or clean_rom_name(filename) or filename

            # Create game entry
            game = models.Game(
                title=display_title,
                file_name=os.path.basename(final_path),
                file_path=relative_path,
                file_size=file_size,
                platform_id=platform.id,
                crc32=crc32,
                md5=md5,
                sha1=sha1,
                dat_verified=dat_verified,
                dat_title=dat_title,
                region=extract_region(filename),
                revision=extract_revision(filename),
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
            await db.flush()

            dl.game_id = game.id
            dl.filename = os.path.basename(final_path)
            dl.platform_slug = platform_slug
            dl.status = "complete"
            dl.progress = 100
            dl.completed_at = datetime.utcnow()
            await db.commit()

            logger.info(f"Download {dl.id} complete: {display_title} -> {relative_path}")

        except Exception as e:
            logger.error(f"Download {download_id} failed: {e}")
            dl.status = "error"
            dl.error = str(e)[:500]
            await db.commit()
        finally:
            active_downloads.pop(download_id, None)
            # Clean up temp dir if empty
            try:
                temp_dir = os.path.join(rom_path, ".tmp_downloads")
                if os.path.isdir(temp_dir) and not os.listdir(temp_dir):
                    os.rmdir(temp_dir)
            except OSError:
                pass


async def download_file(dl: models.Download, dest_path: str, db: AsyncSession):
    """Stream download a file with progress tracking."""
    async with httpx.AsyncClient(follow_redirects=True, timeout=httpx.Timeout(30, read=300)) as client:
        async with client.stream("GET", dl.url) as resp:
            resp.raise_for_status()

            # Try to get filename from headers
            header_name = filename_from_headers(dict(resp.headers))
            if header_name:
                dl.filename = header_name

            total = int(resp.headers.get("content-length", 0)) or None
            if total:
                dl.total_bytes = total

            downloaded = 0
            last_update = time.time()
            last_bytes = 0
            chunk_size = 1024 * 256  # 256 KB

            with open(dest_path, "wb") as f:
                async for chunk in resp.aiter_bytes(chunk_size):
                    f.write(chunk)
                    downloaded += len(chunk)

                    now = time.time()
                    elapsed = now - last_update
                    if elapsed >= 0.5:
                        speed = (downloaded - last_bytes) / elapsed if elapsed > 0 else 0
                        dl.downloaded_bytes = downloaded
                        dl.speed_bps = int(speed)
                        if total:
                            dl.progress = round((downloaded / total) * 100, 1)
                        last_update = now
                        last_bytes = downloaded

                        active_downloads[dl.id] = {
                            "downloaded_bytes": downloaded,
                            "total_bytes": total,
                            "speed_bps": int(speed),
                            "progress": dl.progress,
                        }

                        await db.commit()

            dl.downloaded_bytes = downloaded
            dl.total_bytes = downloaded if not total else total
            dl.progress = 100
            await db.commit()
