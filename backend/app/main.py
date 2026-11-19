from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware #для фронта от маши

from .database import Base, engine
from .routers import auth, alarms, tasks, statistics

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Smart Alarm API",
    description="Backend API for Smart Alarm application",
    version="0.2.0"
)

app.add_middleware( #для фронта от маши
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:5501",
        "http://localhost:5501",
        "http://127.0.0.1:8000",
        "http://localhost:8000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
