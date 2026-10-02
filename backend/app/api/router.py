from fastapi import APIRouter

from app.api.routes import auth, comments, users, videos

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(videos.router)
api_router.include_router(comments.router)
