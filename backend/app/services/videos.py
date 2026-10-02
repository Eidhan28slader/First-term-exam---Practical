from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import THUMBNAIL_BUCKET, VIDEO_BUCKET
from app.models import Video
from app.schemas import VideoPublic
from app.services.storage import public_file_url


def video_response(video: Video) -> VideoPublic:
    return VideoPublic(
        id=video.id,
        title=video.title,
        description=video.description,
        video_url=public_file_url(video.video_url, VIDEO_BUCKET),
        thumbnail_url=public_file_url(video.thumbnail_url, THUMBNAIL_BUCKET),
        views=video.views,
        user_id=video.user_id,
        username=video.user.name,
        created_at=video.created_at,
    )


def get_video_or_404(db: Session, video_id: int) -> Video:
    video = db.scalar(select(Video).options(joinedload(Video.user)).where(Video.id == video_id))
    if video is None:
        raise HTTPException(status_code=404, detail="No encontramos ese video")
    return video
