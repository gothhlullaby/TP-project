
from fastapi import FastAPI

app = FastAPI(
    title="Smart Alarm API",
    description="Backend API for Smart Alarm application",
    version="0.1.0"
)


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
