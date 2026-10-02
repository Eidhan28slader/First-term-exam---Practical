from app import models
from app.database import engine


def init_db() -> None:
    models.Base.metadata.create_all(bind=engine)
