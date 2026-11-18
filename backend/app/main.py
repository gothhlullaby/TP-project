from fastapi import FastAPI

from .database import Base, engine
from .routers import auth, alarms, tasks, statistics

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Alarm API",
    description="Backend API for Smart Alarm application",
    version="0.2.0"
)

app.include_router(auth.router)
app.include_router(alarms.router)
app.include_router(tasks.router)
app.include_router(statistics.router)


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
