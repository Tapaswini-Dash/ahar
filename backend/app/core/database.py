"""
Async SQLAlchemy engine + session setup (asyncpg driver against Postgres).

Nothing here talks to a specific table — models.py owns the schema. This
file is just plumbing: one engine for the app's lifetime, one session per
request via the get_db dependency.
"""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy import inspect, text
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# echo=False in prod; flip to True locally if you need to see generated SQL.
engine = create_async_engine(settings.database_url, echo=False, pool_pre_ping=True)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,  # so objects stay usable after commit, e.g. in response models
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency — yields one session per request, always closed after."""
    async with AsyncSessionLocal() as session:
        yield session


async def init_db() -> None:
    """
    Dev/first-run convenience: creates tables from the ORM models directly.

    This is fine to get moving fast, but it does NOT track schema changes
    over time. Once the schema stabilizes, switch to Alembic migrations
    instead of calling this on every startup — create_all() only ever adds
    missing tables, it never alters existing ones.
    """
    # Ensure every model is registered before create_all, including the
    # gamification and badge tables used by the rewards route.
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # create_all does not add columns to existing tables. Keep these two
        # additive onboarding fields available for existing local installs.
        def add_goal_columns(sync_conn):
            inspector = inspect(sync_conn)
            if "user_profiles" not in inspector.get_table_names():
                return
            columns = {column["name"] for column in inspector.get_columns("user_profiles")}
            if "goal_weight_kg" not in columns:
                sync_conn.execute(text("ALTER TABLE user_profiles ADD COLUMN goal_weight_kg FLOAT"))
            if "calorie_target_choice" not in columns:
                sync_conn.execute(text("ALTER TABLE user_profiles ADD COLUMN calorie_target_choice VARCHAR(20) NOT NULL DEFAULT 'recommended'"))
        await conn.run_sync(add_goal_columns)
        def add_gamification_goal_column(sync_conn):
            inspector = inspect(sync_conn)
            if "user_gamification" not in inspector.get_table_names():
                return
            columns = {column["name"] for column in inspector.get_columns("user_gamification")}
            if "goal_complete_date" not in columns:
                sync_conn.execute(text("ALTER TABLE user_gamification ADD COLUMN goal_complete_date DATE"))
        await conn.run_sync(add_gamification_goal_column)
        def add_packaged_food_columns(sync_conn):
            inspector = inspect(sync_conn)
            if "packaged_food_logs" not in inspector.get_table_names():
                return
            columns = {column["name"] for column in inspector.get_columns("packaged_food_logs")}
            if "ingredients_text" not in columns:
                sync_conn.execute(text("ALTER TABLE packaged_food_logs ADD COLUMN ingredients_text TEXT"))
            if "nutrition_source" not in columns:
                sync_conn.execute(text("ALTER TABLE packaged_food_logs ADD COLUMN nutrition_source VARCHAR(32) NOT NULL DEFAULT 'open_food_facts'"))
        await conn.run_sync(add_packaged_food_columns)
