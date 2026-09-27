
"""Reads/updates for the currently-authenticated user's own profile row
(not onboarding targets — that's onboarding_service/UserProfile)."""

from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.schemas.user import UserUpdateRequest


async def update_user(db: AsyncSession, user: User, body: UserUpdateRequest) -> User:
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.avatar_url is not None:
        user.avatar_url = body.avatar_url

    await db.commit()
    await db.refresh(user)
    return user