from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json


class PlatformBase(BaseModel):
    name: str
    slug: str
    igdb_id: Optional[int] = None
    cover_url: Optional[str] = None


class PlatformOut(PlatformBase):
    id: int
    game_count: int = 0

    class Config:
        from_attributes = True


class GameBase(BaseModel):
    title: str
    file_name: str
    file_path: str
    file_size: int = 0
    platform_id: int


class GameOut(BaseModel):
    id: int
    title: str
    file_name: str
    file_path: str
    file_size: int
    platform_id: int
    igdb_id: Optional[int] = None
    cover_url: Optional[str] = None
    summary: Optional[str] = None
    rating: Optional[float] = None
    release_date: Optional[int] = None
    genres: Optional[List[str]] = None
    developer: Optional[str] = None
    publisher: Optional[str] = None
    screenshots: Optional[List[str]] = None
    region: Optional[str] = None
    revision: Optional[str] = None
    crc32: Optional[str] = None
    md5: Optional[str] = None
    sha1: Optional[str] = None
    dat_verified: bool = False
    dat_title: Optional[str] = None
    created_at: Optional[datetime] = None
    platform: Optional[PlatformOut] = None

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj, **kwargs):
        instance = super().model_validate(obj, **kwargs)
        # Parse JSON strings for genres and screenshots
        if isinstance(obj.genres, str):
            try:
                instance.genres = json.loads(obj.genres)
            except Exception:
                instance.genres = []
        if isinstance(obj.screenshots, str):
            try:
                instance.screenshots = json.loads(obj.screenshots)
            except Exception:
                instance.screenshots = []
        return instance


class GameUpdate(BaseModel):
    title: Optional[str] = None
    igdb_id: Optional[int] = None
    cover_url: Optional[str] = None
    summary: Optional[str] = None
    rating: Optional[float] = None
    release_date: Optional[int] = None
    genres: Optional[List[str]] = None
    developer: Optional[str] = None
    publisher: Optional[str] = None
    region: Optional[str] = None


class ScanStatus(BaseModel):
    running: bool
    progress: int
    total: int
    current_file: str
    found: int
    updated: int
    errors: int


class DatFileOut(BaseModel):
    id: int
    name: str
    platform_id: Optional[int] = None
    entry_count: int
    imported_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SettingsOut(BaseModel):
    igdb_client_id: str = ""
    igdb_client_secret: str = ""
    rom_path: str = "/roms"
    auto_scan_on_start: bool = False
    download_images: bool = True


class IGDBSearchResult(BaseModel):
    igdb_id: int
    title: str
    cover_url: Optional[str] = None
    summary: Optional[str] = None
    rating: Optional[float] = None
    release_date: Optional[int] = None
    genres: Optional[List[str]] = None


class BiosFileOut(BaseModel):
    id: int
    filename: str
    platform_slug: str
    category: str
    file_size: int = 0
    md5: Optional[str] = None
    sha1: Optional[str] = None
    description: Optional[str] = None
    verified: bool = False
    uploaded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class BiosPlatformInfo(BaseModel):
    slug: str
    name: str
    needs: List[str] = []
    emulators: List[str] = []
    uploaded_count: int = 0


class DownloadCreate(BaseModel):
    url: str
    platform_slug: Optional[str] = None


class DownloadOut(BaseModel):
    id: int
    url: str
    filename: Optional[str] = None
    status: str
    progress: float
    total_bytes: Optional[int] = None
    downloaded_bytes: int = 0
    speed_bps: int = 0
    platform_slug: Optional[str] = None
    game_id: Optional[int] = None
    error: Optional[str] = None
    created_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True
