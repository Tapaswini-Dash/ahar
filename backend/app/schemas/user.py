from pydantic import BaseModel, ConfigDict, EmailStr


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    avatar_url: str | None = None
    is_verified: bool
    auth_provider: str


class UserUpdateRequest(BaseModel):
    full_name: str | None = None
    avatar_url: str | None = None