
"""
Registration, email/password login, Google login, and token refresh.
Routes call into this — they never touch User rows or JWTs directly.
"""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_google_id_token,
    verify_password,
)
from app.models.user import User
from app.schemas.auth import GoogleLoginRequest, LoginRequest, RegisterRequest, TokenResponse


class AuthError(Exception):
    """Raised for any client-facing auth failure. Routes turn this into a 401/409/400."""

    def __init__(self, message: str, status_code: int = 401):
        super().__init__(message)
        self.status_code = status_code


def _issue_tokens(user: User) -> TokenResponse:
    subject = str(user.id)
    return TokenResponse(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def register_user(db: AsyncSession, body: RegisterRequest) -> TokenResponse:
    existing = await get_user_by_email(db, body.email)
    if existing is not None:
        raise AuthError("An account with this email already exists.", status_code=409)

    user = User(
        email=body.email,
        full_name=body.full_name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return _issue_tokens(user)


async def login_with_password(db: AsyncSession, body: LoginRequest) -> TokenResponse:
    user = await get_user_by_email(db, body.email)
    if user is None or user.hashed_password is None:
        raise AuthError("Incorrect email or password.")

    if not verify_password(body.password, user.hashed_password):
        raise AuthError("Incorrect email or password.")

    if not user.is_active:
        raise AuthError("This account is inactive.", status_code=403)

    return _issue_tokens(user)


async def login_with_google(db: AsyncSession, body: GoogleLoginRequest) -> TokenResponse:
    payload = verify_google_id_token(body.id_token)
    if payload is None:
        raise AuthError("Invalid Google sign-in token.")

    google_sub = payload.get("sub")
    email = payload.get("email")
    if not google_sub or not email:
        raise AuthError("Google token is missing required fields.")

    result = await db.execute(select(User).where(User.google_sub == google_sub))
    user = result.scalar_one_or_none()

    if user is None:
        # Not linked by google_sub yet — check if this email already has a
        # password account, and link Google to it instead of duplicating.
        user = await get_user_by_email(db, email)

        if user is None:
            user = User(
                email=email,
                full_name=payload.get("name") or email.split("@")[0],
                google_sub=google_sub,
                avatar_url=payload.get("picture"),
                is_verified=bool(payload.get("email_verified", False)),
            )
            db.add(user)
        else:
            user.google_sub = google_sub
            if not user.avatar_url:
                user.avatar_url = payload.get("picture")

        await db.commit()
        await db.refresh(user)

    if not user.is_active:
        raise AuthError("This account is inactive.", status_code=403)

    return _issue_tokens(user)


async def refresh_access_token(db: AsyncSession, refresh_token: str) -> TokenResponse:
    payload = decode_token(refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise AuthError("Invalid or expired refresh token.")

    user_id = payload.get("sub")
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise AuthError("Invalid or expired refresh token.")

    return _issue_tokens(user)