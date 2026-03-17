from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Platform(Base):
    __tablename__ = "platforms"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    igdb_id = Column(Integer, nullable=True)
    cover_url = Column(String, nullable=True)
    games = relationship("Game", back_populates="platform")


class Game(Base):
    __tablename__ = "games"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    file_name = Column(String, nullable=False)
    file_path = Column(String, nullable=False, unique=True)
    file_size = Column(BigInteger, default=0)
    platform_id = Column(Integer, ForeignKey("platforms.id"), nullable=False)

    # IGDB metadata
    igdb_id = Column(Integer, nullable=True)
    cover_url = Column(String, nullable=True)
    cover_local = Column(String, nullable=True)  # cached locally
    summary = Column(Text, nullable=True)
    rating = Column(Float, nullable=True)
    release_date = Column(Integer, nullable=True)  # unix timestamp
    genres = Column(String, nullable=True)          # JSON array string
    developer = Column(String, nullable=True)
    publisher = Column(String, nullable=True)
    screenshots = Column(Text, nullable=True)       # JSON array string

    # ROM identification
    region = Column(String, nullable=True)
    revision = Column(String, nullable=True)
    crc32 = Column(String, nullable=True, index=True)
    md5 = Column(String, nullable=True, index=True)
    sha1 = Column(String, nullable=True, index=True)
    dat_verified = Column(Boolean, default=False)
    dat_title = Column(String, nullable=True)       # canonical name from DAT

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    platform = relationship("Platform", back_populates="games")
    extras = relationship("GameExtra", back_populates="game", cascade="all, delete-orphan")


class GameExtra(Base):
    __tablename__ = "game_extras"

    id = Column(Integer, primary_key=True, index=True)
    game_id = Column(Integer, ForeignKey("games.id"), nullable=False)
    filename = Column(String, nullable=False)
    file_path = Column(String, nullable=False, unique=True)
    file_size = Column(BigInteger, default=0)
    # mod, update, dlc, cheat, other
    extra_type = Column(String, default="other", nullable=False)
    description = Column(String, nullable=True)
    uploaded_at = Column(DateTime, server_default=func.now())

    game = relationship("Game", back_populates="extras")


class DatFile(Base):
    __tablename__ = "dat_files"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    platform_id = Column(Integer, ForeignKey("platforms.id"), nullable=True)
    file_path = Column(String, nullable=False)
    entry_count = Column(Integer, default=0)
    imported_at = Column(DateTime, server_default=func.now())


class DatEntry(Base):
    __tablename__ = "dat_entries"

    id = Column(Integer, primary_key=True, index=True)
    dat_file_id = Column(Integer, ForeignKey("dat_files.id"), nullable=False)
    game_name = Column(String, nullable=False, index=True)
    rom_name = Column(String, nullable=False)
    crc32 = Column(String, nullable=True, index=True)
    md5 = Column(String, nullable=True, index=True)
    sha1 = Column(String, nullable=True, index=True)
    size = Column(BigInteger, nullable=True)


class BiosFile(Base):
    __tablename__ = "bios_files"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String, nullable=False)
    platform_slug = Column(String, nullable=False, index=True)
    category = Column(String, default="bios")  # bios, firmware, keys, other
    file_path = Column(String, nullable=False, unique=True)
    file_size = Column(BigInteger, default=0)
    md5 = Column(String, nullable=True)
    sha1 = Column(String, nullable=True)
    description = Column(String, nullable=True)
    verified = Column(Boolean, default=False)
    uploaded_at = Column(DateTime, server_default=func.now())


class Download(Base):
    __tablename__ = "downloads"

    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    filename = Column(String, nullable=True)
    status = Column(String, default="pending")  # pending, downloading, hashing, moving, complete, error
    progress = Column(Float, default=0)  # 0-100
    total_bytes = Column(BigInteger, nullable=True)
    downloaded_bytes = Column(BigInteger, default=0)
    speed_bps = Column(BigInteger, default=0)
    platform_slug = Column(String, nullable=True)  # user hint or auto-detected
    game_id = Column(Integer, ForeignKey("games.id"), nullable=True)
    # extra_type: None = ROM, else "mod"/"update"/"dlc"/"cheat"/"other"
    extra_type = Column(String, nullable=True)
    # For extras: the game to associate this file with
    target_game_id = Column(Integer, ForeignKey("games.id"), nullable=True)
    error = Column(String, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)


class Setting(Base):
    __tablename__ = "settings"

    key = Column(String, primary_key=True)
    value = Column(Text, nullable=True)
