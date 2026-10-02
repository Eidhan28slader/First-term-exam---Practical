import os
import uuid
from functools import lru_cache

import boto3
from fastapi import HTTPException, UploadFile

from app.config import (
    AWS_REGION,
    MAX_THUMBNAIL_BYTES,
    MAX_VIDEO_BYTES,
    THUMBNAIL_BUCKET,
    VIDEO_BUCKET,
)
from app.schemas import UploadRequest


@lru_cache(maxsize=1)
def get_s3_client():
    return boto3.client("s3", region_name=AWS_REGION)


def get_bucket(kind: str) -> str:
    bucket = VIDEO_BUCKET if kind == "video" else THUMBNAIL_BUCKET
    if not bucket:
        raise HTTPException(status_code=503, detail="Configura los buckets de S3 en las variables de entorno")
    return bucket


def create_upload_url(data: UploadRequest, user_id: int) -> dict[str, str]:
    video_types = {".mp4": "video/mp4"}
    thumbnail_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    suffix = os.path.splitext(data.filename.lower())[1]
    allowed_types = video_types if data.kind == "video" else thumbnail_types
    max_size = MAX_VIDEO_BYTES if data.kind == "video" else MAX_THUMBNAIL_BYTES
    if suffix not in allowed_types or data.content_type != allowed_types[suffix]:
        raise HTTPException(status_code=415, detail="El formato del archivo no está permitido")
    if data.size > max_size:
        raise HTTPException(status_code=413, detail="El archivo supera el tamaño permitido")
    bucket = get_bucket(data.kind)
    object_key = f"{user_id}/{uuid.uuid4().hex}{suffix}"
    upload_url = get_s3_client().generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket, "Key": object_key, "ContentType": data.content_type},
        ExpiresIn=900,
    )
    return {"upload_url": upload_url, "object_key": object_key, "content_type": data.content_type}


def upload_local_file(file: UploadFile, kind: str, user_id: int) -> str:
    video_types = {".mp4": "video/mp4"}
    thumbnail_types = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png"}
    suffix = os.path.splitext(file.filename or "")[1].lower()
    allowed_types = video_types if kind == "video" else thumbnail_types
    max_size = MAX_VIDEO_BYTES if kind == "video" else MAX_THUMBNAIL_BYTES
    if suffix not in allowed_types or file.content_type != allowed_types[suffix]:
        raise HTTPException(status_code=415, detail="El formato del archivo no está permitido")

    file.file.seek(0, os.SEEK_END)
    size = file.file.tell()
    file.file.seek(0)
    if size == 0:
        raise HTTPException(status_code=422, detail="El archivo no puede estar vacío")
    if size > max_size:
        raise HTTPException(status_code=413, detail="El archivo supera el tamaño permitido")

    bucket = get_bucket(kind)
    object_key = f"{user_id}/{uuid.uuid4().hex}{suffix}"
    get_s3_client().upload_fileobj(
        file.file,
        bucket,
        object_key,
        ExtraArgs={"ContentType": allowed_types[suffix]},
    )
    return object_key


def public_file_url(value: str, bucket: str) -> str:
    if value.startswith(("http://", "https://")) or not bucket:
        return value
    return get_s3_client().generate_presigned_url(
        "get_object", Params={"Bucket": bucket, "Key": value}, ExpiresIn=3600
    )


def delete_s3_file(value: str, bucket: str) -> None:
    if bucket and value and not value.startswith(("http://", "https://")):
        get_s3_client().delete_object(Bucket=bucket, Key=value)
