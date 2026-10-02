from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Comment, User, Video
from app.schemas import CommentCreate, CommentPublic
from app.services.videos import get_video_or_404

router = APIRouter(prefix="/videos/{video_id}/comments", tags=["Comentarios"])


@router.get("", response_model=list[CommentPublic])
def list_comments(video_id: int, db: Session = Depends(get_db)):
    get_video_or_404(db, video_id)
    comments = db.scalars(
        select(Comment)
        .options(joinedload(Comment.user))
        .where(Comment.video_id == video_id)
        .order_by(Comment.created_at)
    ).all()
    return [
        CommentPublic(
            id=comment.id,
            content=comment.content,
            user_id=comment.user_id,
            username=comment.user.name,
            created_at=comment.created_at,
        )
        for comment in comments
    ]


@router.post("", response_model=CommentPublic, status_code=201)
def create_comment(
    video_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if db.get(Video, video_id) is None:
        raise HTTPException(status_code=404, detail="No encontramos ese video")
    comment = Comment(content=data.content.strip(), user_id=user.id, video_id=video_id, user=user)
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentPublic(
        id=comment.id,
        content=comment.content,
        user_id=user.id,
        username=user.name,
        created_at=comment.created_at,
    )
