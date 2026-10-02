"""Compatibilidad con el comando anterior: uvicorn main:app."""

from app.main import app

__all__ = ["app"]
