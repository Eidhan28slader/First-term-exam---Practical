import os

from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./videos.db")
JWT_SECRET = os.getenv("JWT_SECRET", "local-development-secret-change-me")
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
VIDEO_BUCKET = os.getenv("S3_VIDEO_BUCKET", "")
THUMBNAIL_BUCKET = os.getenv("S3_THUMBNAIL_BUCKET", "")
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:5173").split(",")
    if origin.strip()
]
MAX_VIDEO_BYTES = 100 * 1024 * 1024
MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024
