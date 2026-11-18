import pytest

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import TaskChallenge


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
    client.post(
        "/auth/register",
        json={
            "email": email,
            "password": "password123"
        }
    )

    response = client.post(
        "/auth/login",
        json={
            "email": email,
            "password": "password123"
        }
    )

    token = response.json()["access_token"]

    return {
        "Authorization": f"Bearer {token}"
    }


def create_alarm(client, headers, task):
    return client.post(
        "/alarms",
        json={
            "time": "07:30",
            "days": [0, 1, 2, 3, 4],
            "task": task,
            "level": "средняя",
            "melody": "Утренний свет",
            "volume": 70,
            "enabled": True
        },
        headers=headers
    )


def get_expected_answer(challenge_id):
    db = TestingSessionLocal()
    try:
        challenge = db.query(TaskChallenge).filter(
            TaskChallenge.id == challenge_id
        ).first()

        return challenge.expected_answer
    finally:
        db.close()


def test_math_task_and_correct_answer(client):
    headers = register_and_get_headers(
        client,
        "math@example.com"
    )

    alarm_response = create_alarm(
        client,
        headers,
        "Математика"
    )

    assert alarm_response.status_code == 201

    alarm_id = alarm_response.json()["id"]

    task_response = client.get(
        f"/tasks/math?alarm_id={alarm_id}",
        headers=headers
    )

    assert task_response.status_code == 200

    task = task_response.json()

    assert task["id"] is not None
    assert task["question"]
    assert "expected_answer" not in task

    expected_answer = get_expected_answer(task["id"])

    check_response = client.post(
        "/tasks/math/check",
        json={
            "challenge_id": task["id"],
            "answer": expected_answer,
            "response_time_seconds": 10
        },
        headers=headers
    )

    assert check_response.status_code == 200
    assert check_response.json()["is_correct"] is True


def test_math_task_with_wrong_answer(client):
    headers = register_and_get_headers(
        client,
        "wrong-math@example.com"
    )

    alarm_response = create_alarm(
        client,
        headers,
        "Математика"
    )

    alarm_id = alarm_response.json()["id"]

    task_response = client.get(
        f"/tasks/math?alarm_id={alarm_id}",
        headers=headers
    )

    challenge_id = task_response.json()["id"]

    check_response = client.post(
        "/tasks/math/check",
        json={
            "challenge_id": challenge_id,
            "answer": "wrong",
            "response_time_seconds": 8
        },
        headers=headers
    )

    assert check_response.status_code == 200
    assert check_response.json()["is_correct"] is False


def test_phrase_task_and_correct_answer(client):
    headers = register_and_get_headers(
        client,
        "phrase@example.com"
    )

    alarm_response = create_alarm(
        client,
        headers,
        "Ввод фразы"
    )

    assert alarm_response.status_code == 201

    alarm_id = alarm_response.json()["id"]

    task_response = client.get(
        f"/tasks/phrase?alarm_id={alarm_id}",
        headers=headers
    )

    assert task_response.status_code == 200

    task = task_response.json()

    assert task["id"] is not None
    assert task["question"]
    assert "expected_answer" not in task

    expected_answer = get_expected_answer(task["id"])

    check_response = client.post(
        "/tasks/phrase/check",
        json={
            "challenge_id": task["id"],
            "answer": expected_answer,
            "response_time_seconds": 5
        },
        headers=headers
    )

    assert check_response.status_code == 200
    assert check_response.json()["is_correct"] is True


def test_task_challenge_cannot_be_used_twice(client):
    headers = register_and_get_headers(
        client,
        "twice@example.com"
    )

    alarm_response = create_alarm(
        client,
        headers,
        "Математика"
    )

    alarm_id = alarm_response.json()["id"]

    task_response = client.get(
        f"/tasks/math?alarm_id={alarm_id}",
        headers=headers
    )

    challenge_id = task_response.json()["id"]
    expected_answer = get_expected_answer(challenge_id)

    payload = {
        "challenge_id": challenge_id,
        "answer": expected_answer,
        "response_time_seconds": 5
    }

    first_response = client.post(
        "/tasks/math/check",
        json=payload,
        headers=headers
    )

    second_response = client.post(
        "/tasks/math/check",
        json=payload,
        headers=headers
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 400


def test_user_cannot_check_another_users_task(client):
    first_user_headers = register_and_get_headers(
        client,
        "first-task@example.com"
    )

    second_user_headers = register_and_get_headers(
        client,
        "second-task@example.com"
    )

    alarm_response = create_alarm(
        client,
        first_user_headers,
        "Математика"
    )

    alarm_id = alarm_response.json()["id"]

    task_response = client.get(
        f"/tasks/math?alarm_id={alarm_id}",
        headers=first_user_headers
    )

    challenge_id = task_response.json()["id"]

    response = client.post(
        "/tasks/math/check",
        json={
            "challenge_id": challenge_id,
            "answer": "10",
            "response_time_seconds": 5
        },
        headers=second_user_headers
    )

    assert response.status_code == 404


def test_statistics_and_history(client):
    headers = register_and_get_headers(
        client,
        "statistics@example.com"
    )

    math_alarm = create_alarm(
        client,
        headers,
        "Математика"
    )

    math_alarm_id = math_alarm.json()["id"]

    math_task = client.get(
        f"/tasks/math?alarm_id={math_alarm_id}",
        headers=headers
    ).json()

    math_answer = get_expected_answer(math_task["id"])

    client.post(
        "/tasks/math/check",
        json={
            "challenge_id": math_task["id"],
            "answer": math_answer,
            "response_time_seconds": 10
        },
        headers=headers
    )

    phrase_alarm = create_alarm(
        client,
        headers,
        "Ввод фразы"
    )

    phrase_alarm_id = phrase_alarm.json()["id"]

    phrase_task = client.get(
        f"/tasks/phrase?alarm_id={phrase_alarm_id}",
        headers=headers
    ).json()

    client.post(
        "/tasks/phrase/check",
        json={
            "challenge_id": phrase_task["id"],
            "answer": "неверная фраза",
            "response_time_seconds": 5
        },
        headers=headers
    )

    statistics_response = client.get(
        "/statistics",
        headers=headers
    )

    assert statistics_response.status_code == 200

    statistics = statistics_response.json()

    assert statistics["total_tasks"] == 2
    assert statistics["correct_tasks"] == 1
    assert statistics["incorrect_tasks"] == 1
    assert statistics["accuracy_percent"] == 50.0
    assert statistics["average_response_time_seconds"] == 7.5

    history_response = client.get(
        "/statistics/history",
        headers=headers
    )

    assert history_response.status_code == 200

    history = history_response.json()

    assert history["total"] == 2
    assert len(history["results"]) == 2


def test_statistics_without_token(client):
    response = client.get("/statistics")

    assert response.status_code == 401


def test_tasks_without_token(client):
    response = client.get("/tasks/math?alarm_id=1")

    assert response.status_code == 401
