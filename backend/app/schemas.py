from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class LoginData(BaseModel):
    email: str
    password: str


class UserPublic(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic


class UploadRequest(BaseModel):
    kind: Literal["video", "thumbnail"]
    filename: str
    content_type: str
    size: int = Field(gt=0)


class UploadResponse(BaseModel):
    upload_url: str
    object_key: str
    content_type: str


class VideoCreate(BaseModel):
    title: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=3000)
    video_url: str = Field(min_length=1)
    thumbnail_url: str = Field(min_length=1)


class VideoUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=3000)


class VideoPublic(BaseModel):
    id: int
    title: str
    description: str
    video_url: str
    thumbnail_url: str
    views: int
    user_id: int
    username: str
    created_at: datetime


class CommentCreate(BaseModel):
    content: str = Field(min_length=1, max_length=1000)


class CommentPublic(BaseModel):
    id: int
    content: str
    user_id: int
    username: str
    created_at: datetime
