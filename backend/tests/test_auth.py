
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


# Отдельная тестовая база данных в памяти
TEST_DATABASE_URL = "sqlite://"

test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

TestingSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=test_engine
)


@pytest.fixture
def client():
    Base.metadata.create_all(bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def test_register_user(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "password123"
        }
    )

    assert response.status_code == 201
    assert response.json()["email"] == "user@example.com"
    assert "hashed_password" not in response.json()


def test_register_duplicate_email(client):
    payload = {
        "email": "user@example.com",
        "password": "password123"
    }

    client.post("/auth/register", json=payload)

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 409


def test_register_short_password(client):
    response = client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "123"
        }
    )

    assert response.status_code == 422


def test_login_user(client):
    client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "password123"
        }
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "user@example.com",
            "password": "password123"
        }
    )

    assert response.status_code == 200
    assert "access_token" in response.json()
    assert response.json()["token_type"] == "bearer"


def test_login_wrong_password(client):
    client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "password123"
        }
    )

    response = client.post(
        "/auth/login",
        json={
            "email": "user@example.com",
            "password": "wrongpassword"
        }
    )

    assert response.status_code == 401


def test_get_current_user(client):
    client.post(
        "/auth/register",
        json={
            "email": "user@example.com",
            "password": "password123"
        }
    )

    login_response = client.post(
        "/auth/login",
        json={
            "email": "user@example.com",
            "password": "password123"
        }
    )

    token = login_response.json()["access_token"]

    response = client.get(
        "/auth/me",
        headers={
            "Authorization": f"Bearer {token}"
        }
    )

    assert response.status_code == 200
    assert response.json()["email"] == "user@example.com"


def test_get_current_user_without_token(client):
    response = client.get("/auth/me")

    assert response.status_code == 401
