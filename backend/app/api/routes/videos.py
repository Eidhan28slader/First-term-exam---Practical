from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.config import THUMBNAIL_BUCKET, VIDEO_BUCKET
from app.database import get_db
from app.dependencies import get_current_user
from app.models import User, Video
from app.schemas import UploadRequest, UploadResponse, VideoPublic, VideoUpdate
from app.services.storage import create_upload_url, delete_s3_file, upload_local_file
from app.services.videos import get_video_or_404, video_response

router = APIRouter(prefix="/videos", tags=["Videos"])


@router.post("/upload-url", response_model=UploadResponse)
def request_upload(data: UploadRequest, user: User = Depends(get_current_user)):
    return create_upload_url(data, user.id)


@router.post("", response_model=VideoPublic, status_code=201)
def create_video(
    title: str = Form(..., min_length=2, max_length=120),
    description: str = Form("", max_length=3000),
    video_file: UploadFile = File(..., description="Archivo MP4 de hasta 100 MB"),
    thumbnail_file: UploadFile = File(..., description="Miniatura JPG/JPEG/PNG de hasta 5 MB"),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video_key = upload_local_file(video_file, "video", user.id)
    thumbnail_key = upload_local_file(thumbnail_file, "thumbnail", user.id)
    video = Video(
        title=title.strip(),
        description=description.strip(),
        video_url=video_key,
        thumbnail_url=thumbnail_key,
        user_id=user.id,
        user=user,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return video_response(video)


@router.get("", response_model=list[VideoPublic])
def list_videos(db: Session = Depends(get_db)):
    videos = db.scalars(
        select(Video).options(joinedload(Video.user)).order_by(Video.created_at.desc())
    ).all()
    return [video_response(video) for video in videos]


@router.get("/{video_id}", response_model=VideoPublic)
def read_video(video_id: int, db: Session = Depends(get_db)):
    video = get_video_or_404(db, video_id)
    video.views += 1
    db.commit()
    db.refresh(video)
    return video_response(video)


@router.get("/{video_id}/recommendations", response_model=list[VideoPublic])
def recommend_videos(video_id: int, db: Session = Depends(get_db)):
    get_video_or_404(db, video_id)
    videos = db.scalars(
        select(Video)
        .options(joinedload(Video.user))
        .where(Video.id != video_id)
        .order_by(Video.created_at.desc())
        .limit(5)
    ).all()
    return [video_response(video) for video in videos]


@router.put("/{video_id}", response_model=VideoPublic)
def update_video(
    video_id: int,
    data: VideoUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = get_video_or_404(db, video_id)
    if video.user_id != user.id:
        raise HTTPException(status_code=403, detail="Solo puedes editar tus propios videos")
    for field, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(video, field, value.strip())
    db.commit()
    db.refresh(video)
    return video_response(video)


@router.delete("/{video_id}", status_code=204)
def delete_video(
    video_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    video = get_video_or_404(db, video_id)
    if video.user_id != user.id:
        raise HTTPException(status_code=403, detail="Solo puedes eliminar tus propios videos")
    delete_s3_file(video.video_url, VIDEO_BUCKET)
    delete_s3_file(video.thumbnail_url, THUMBNAIL_BUCKET)
    db.delete(video)
    db.commit()
