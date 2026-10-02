from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Video
from app.schemas import UserPublic, VideoPublic
from app.services.videos import video_response

router = APIRouter(prefix="/users", tags=["Usuarios"])


@router.get("/me", response_model=UserPublic)
def read_my_profile(user: User = Depends(get_current_user)):
    return user


@router.get("/{user_id}", response_model=UserPublic)
def read_user(user_id: int, db: Session = Depends(get_db)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="No encontramos ese usuario")
    return user


@router.get("/{user_id}/videos", response_model=list[VideoPublic])
def read_user_videos(user_id: int, db: Session = Depends(get_db)):
    videos = db.scalars(
        select(Video)
        .options(joinedload(Video.user))
        .where(Video.user_id == user_id)
        .order_by(Video.created_at.desc())
    ).all()
    return [video_response(video) for video in videos]
