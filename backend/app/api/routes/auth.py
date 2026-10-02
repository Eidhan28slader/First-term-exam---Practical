import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User
from app.schemas import LoginData, TokenResponse, UserCreate, UserPublic
from app.security import create_token, hash_password, verify_password

router = APIRouter(tags=["Autenticación"])


@router.post("/users", response_model=UserPublic, status_code=201)
def create_user(data: UserCreate, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(status_code=422, detail="Escribe un correo válido")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status_code=409, detail="Ese correo ya tiene una cuenta")
    user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=TokenResponse)
def login(data: LoginData, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == data.email.strip().lower()))
    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
    return {"access_token": create_token(user.id), "user": user}
