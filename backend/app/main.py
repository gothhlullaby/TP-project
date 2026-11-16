
from fastapi import FastAPI

from .database import Base, engine
from .routers import auth

# Создание таблиц базы данных
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Alarm API",
    description="Backend API for Smart Alarm application",
    version="0.2.0"
)

app.include_router(auth.router)


@app.get("/")
def root():
    return {
        "message": "Smart Alarm API",
        "status": "running"
    }


@app.get("/health")
def health_check():
    return {
        "status": "healthy"
    }
