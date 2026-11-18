
import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


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


def register_and_get_headers(client, email):
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "password123"
        }
    )

    assert response.status_code == 201

    login_response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "password123"
        }
    )

    assert login_response.status_code == 200

    token = login_response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }


def alarm_payload():
    return {
        "time": "07:30",
        "days": [0, 1, 2, 3, 4],
        "task": "Математика",
        "level": "средняя",
        "melody": "Утренний свет",
        "volume": 70,
        "enabled": True
    }


def create_alarm(client, headers):
    return client.post(
        "/alarms",
        json=alarm_payload(),
        headers=headers
    )


def test_create_alarm(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    response = create_alarm(client, headers)

    assert response.status_code == 201

    data = response.json()

    assert data["id"] is not None
    assert data["time"] == "07:30"
    assert data["days"] == [0, 1, 2, 3, 4]
    assert data["task"] == "Математика"
    assert data["level"] == "средняя"
    assert data["melody"] == "Утренний свет"
    assert data["volume"] == 70
    assert data["enabled"] is True


def test_get_alarms(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    create_alarm(client, headers)

    response = client.get(
        "/alarms",
        headers=headers
    )

    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.json()[0]["time"] == "07:30"


def test_get_alarms_sorted_by_time(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    first_alarm = alarm_payload()
    first_alarm["time"] = "09:00"

    second_alarm = alarm_payload()
    second_alarm["time"] = "06:30"

    client.post("/alarms", json=first_alarm, headers=headers)
    client.post("/alarms", json=second_alarm, headers=headers)

    response = client.get(
        "/alarms",
        headers=headers
    )

    assert response.status_code == 200

    times = [alarm["time"] for alarm in response.json()]

    assert times == ["06:30", "09:00"]


def test_get_single_alarm(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    create_response = create_alarm(client, headers)
    alarm_id = create_response.json()["id"]

    response = client.get(
        f"/alarms/{alarm_id}",
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["id"] == alarm_id


def test_update_alarm(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    create_response = create_alarm(client, headers)
    alarm_id = create_response.json()["id"]

    updated_data = alarm_payload()
    updated_data["time"] = "08:45"
    updated_data["volume"] = 50
    updated_data["level"] = "сложная"

    response = client.put(
        f"/alarms/{alarm_id}",
        json=updated_data,
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["time"] == "08:45"
    assert response.json()["volume"] == 50
    assert response.json()["level"] == "сложная"


def test_toggle_alarm(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    create_response = create_alarm(client, headers)
    alarm_id = create_response.json()["id"]

    response = client.patch(
        f"/alarms/{alarm_id}/toggle",
        headers=headers
    )

    assert response.status_code == 200
    assert response.json()["enabled"] is False

    second_response = client.patch(
        f"/alarms/{alarm_id}/toggle",
        headers=headers
    )

    assert second_response.status_code == 200
    assert second_response.json()["enabled"] is True


def test_delete_alarm(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    create_response = create_alarm(client, headers)
    alarm_id = create_response.json()["id"]

    response = client.delete(
        f"/alarms/{alarm_id}",
        headers=headers
    )

    assert response.status_code == 204

    get_response = client.get(
        f"/alarms/{alarm_id}",
        headers=headers
    )

    assert get_response.status_code == 404


def test_get_alarms_without_token(client):
    response = client.get("/alarms")

    assert response.status_code == 401


def test_create_alarm_without_token(client):
    response = client.post(
        "/alarms",
        json=alarm_payload()
    )

    assert response.status_code == 401


def test_get_another_users_alarm(client):
    first_user_headers = register_and_get_headers(
        client,
        "first@example.com"
    )

    second_user_headers = register_and_get_headers(
        client,
        "second@example.com"
    )

    create_response = create_alarm(
        client,
        first_user_headers
    )

    alarm_id = create_response.json()["id"]

    response = client.get(
        f"/alarms/{alarm_id}",
        headers=second_user_headers
    )

    assert response.status_code == 404


def test_update_another_users_alarm(client):
    first_user_headers = register_and_get_headers(
        client,
        "first@example.com"
    )

    second_user_headers = register_and_get_headers(
        client,
        "second@example.com"
    )

    create_response = create_alarm(
        client,
        first_user_headers
    )

    alarm_id = create_response.json()["id"]

    response = client.put(
        f"/alarms/{alarm_id}",
        json=alarm_payload(),
        headers=second_user_headers
    )

    assert response.status_code == 404


def test_delete_another_users_alarm(client):
    first_user_headers = register_and_get_headers(
        client,
        "first@example.com"
    )

    second_user_headers = register_and_get_headers(
        client,
        "second@example.com"
    )

    create_response = create_alarm(
        client,
        first_user_headers
    )

    alarm_id = create_response.json()["id"]

    response = client.delete(
        f"/alarms/{alarm_id}",
        headers=second_user_headers
    )

    assert response.status_code == 404


def test_create_alarm_with_invalid_time(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    payload = alarm_payload()
    payload["time"] = "25:70"

    response = client.post(
        "/alarms",
        json=payload,
        headers=headers
    )

    assert response.status_code == 422


def test_create_alarm_with_invalid_day(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    payload = alarm_payload()
    payload["days"] = [0, 1, 7]

    response = client.post(
        "/alarms",
        json=payload,
        headers=headers
    )

    assert response.status_code == 422


def test_create_alarm_with_duplicate_days(client):
    headers = register_and_get_headers(
        client,
        "user@example.com"
    )

    payload = alarm_payload()
    payload["days"] = [0, 1, 1, 2]

    response = client.post(
        "/alarms",
        json=payload,
        headers=headers
    )

    assert response.status_code == 422
