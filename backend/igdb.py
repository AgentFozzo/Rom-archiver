import httpx
import asyncio
import time
import os
import logging
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)

IGDB_API_URL = "https://api.igdb.com/v4"
TWITCH_TOKEN_URL = "https://id.twitch.tv/oauth2/token"

_token_cache: Dict[str, Any] = {"token": None, "expires_at": 0}
_token_lock = asyncio.Lock()


async def get_access_token(client_id: str, client_secret: str) -> Optional[str]:
    global _token_cache
    async with _token_lock:
        now = time.time()
        if _token_cache["token"] and _token_cache["expires_at"] > now + 60:
            return _token_cache["token"]

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    TWITCH_TOKEN_URL,
                    params={
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "grant_type": "client_credentials",
                    },
                    timeout=10,
                )
                resp.raise_for_status()
                data = resp.json()
                _token_cache["token"] = data["access_token"]
                _token_cache["expires_at"] = now + data.get("expires_in", 3600)
                return _token_cache["token"]
        except Exception as e:
            logger.error(f"Failed to get IGDB token: {e}")
            return None


async def igdb_request(
    client_id: str,
    client_secret: str,
    endpoint: str,
    query: str,
) -> Optional[List[Dict]]:
    token = await get_access_token(client_id, client_secret)
    if not token:
        return None

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{IGDB_API_URL}/{endpoint}",
                headers={
                    "Client-ID": client_id,
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "text/plain",
                },
                content=query,
                timeout=15,
            )
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            _token_cache["token"] = None  # force refresh
        logger.error(f"IGDB API error {e.response.status_code}: {e}")
        return None
    except Exception as e:
        logger.error(f"IGDB request failed: {e}")
        return None


def _cover_url(image_id: str, size: str = "cover_big") -> str:
    return f"https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg"


async def search_game(
    client_id: str,
    client_secret: str,
    query: str,
    platform_igdb_id: Optional[int] = None,
    limit: int = 5,
) -> List[Dict]:
    platform_filter = ""
    if platform_igdb_id:
        platform_filter = f" & platforms = ({platform_igdb_id})"

    igdb_query = (
        f'search "{query}";'
        f"fields id,name,summary,cover.image_id,first_release_date,rating,"
        f"genres.name,involved_companies.company.name,involved_companies.developer,"
        f"involved_companies.publisher,screenshots.image_id,videos.video_id;"
        f"where version_parent = null{platform_filter};"
        f"limit {limit};"
    )

    results = await igdb_request(client_id, client_secret, "games", igdb_query)
    if not results:
        return []

    games = []
    for r in results:
        cover_url = None
        if r.get("cover") and r["cover"].get("image_id"):
            cover_url = _cover_url(r["cover"]["image_id"], "cover_big")

        screenshots = []
        for s in r.get("screenshots", []):
            if s.get("image_id"):
                screenshots.append(_cover_url(s["image_id"], "screenshot_big"))

        developer = None
        publisher = None
        for ic in r.get("involved_companies", []):
            comp = ic.get("company", {})
            if ic.get("developer") and not developer:
                developer = comp.get("name")
            if ic.get("publisher") and not publisher:
                publisher = comp.get("name")

        genres = [g["name"] for g in r.get("genres", []) if g.get("name")]

        trailer_youtube_id = None
        for v in r.get("videos", []):
            if v.get("video_id"):
                trailer_youtube_id = v["video_id"]
                break

        games.append({
            "igdb_id": r["id"],
            "title": r["name"],
            "cover_url": cover_url,
            "summary": r.get("summary"),
            "rating": r.get("rating"),
            "release_date": r.get("first_release_date"),
            "genres": genres,
            "developer": developer,
            "publisher": publisher,
            "screenshots": screenshots,
            "trailer_youtube_id": trailer_youtube_id,
        })

    return games


async def get_game_by_id(
    client_id: str,
    client_secret: str,
    igdb_id: int,
) -> Optional[Dict]:
    igdb_query = (
        f"fields id,name,summary,cover.image_id,first_release_date,rating,"
        f"genres.name,involved_companies.company.name,involved_companies.developer,"
        f"involved_companies.publisher,screenshots.image_id,videos.video_id;"
        f"where id = {igdb_id};"
        f"limit 1;"
    )

    results = await igdb_request(client_id, client_secret, "games", igdb_query)
    if not results:
        return None

    r = results[0]
    cover_url = None
    if r.get("cover") and r["cover"].get("image_id"):
        cover_url = _cover_url(r["cover"]["image_id"], "cover_big")

    screenshots = []
    for s in r.get("screenshots", []):
        if s.get("image_id"):
            screenshots.append(_cover_url(s["image_id"], "screenshot_big"))

    developer = None
    publisher = None
    for ic in r.get("involved_companies", []):
        comp = ic.get("company", {})
        if ic.get("developer") and not developer:
            developer = comp.get("name")
        if ic.get("publisher") and not publisher:
            publisher = comp.get("name")

    genres = [g["name"] for g in r.get("genres", []) if g.get("name")]

    trailer_youtube_id = None
    for v in r.get("videos", []):
        if v.get("video_id"):
            trailer_youtube_id = v["video_id"]
            break

    return {
        "igdb_id": r["id"],
        "title": r["name"],
        "cover_url": cover_url,
        "summary": r.get("summary"),
        "rating": r.get("rating"),
        "release_date": r.get("first_release_date"),
        "genres": genres,
        "developer": developer,
        "publisher": publisher,
        "screenshots": screenshots,
        "trailer_youtube_id": trailer_youtube_id,
    }


async def search_platform(
    client_id: str,
    client_secret: str,
    name: str,
) -> Optional[Dict]:
    igdb_query = (
        f'search "{name}";'
        f"fields id,name,slug,platform_logo.image_id;"
        f"limit 3;"
    )

    results = await igdb_request(client_id, client_secret, "platforms", igdb_query)
    if not results:
        return None

    r = results[0]
    logo_url = None
    if r.get("platform_logo") and r["platform_logo"].get("image_id"):
        logo_url = _cover_url(r["platform_logo"]["image_id"], "logo_med")

    return {
        "igdb_id": r["id"],
        "name": r["name"],
        "slug": r.get("slug", ""),
        "cover_url": logo_url,
    }
