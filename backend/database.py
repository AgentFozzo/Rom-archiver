import os
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

DATA_PATH = os.getenv("DATA_PATH", "/data")
DATABASE_URL = f"sqlite+aiosqlite:///{DATA_PATH}/romarchiver.db"


class Base(DeclarativeBase):
    pass


engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # Migrate: add new columns to existing tables if missing (SQLite-safe)
        from sqlalchemy import text
        for stmt in [
            "ALTER TABLE downloads ADD COLUMN extra_type VARCHAR",
            "ALTER TABLE downloads ADD COLUMN target_game_id INTEGER",
            "ALTER TABLE games ADD COLUMN is_favorite BOOLEAN DEFAULT 0",
        ]:
            try:
                await conn.execute(text(stmt))
            except Exception:
                pass  # Column already exists
