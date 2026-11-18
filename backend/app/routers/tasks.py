import random
import re
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Alarm, TaskChallenge, TaskResult, User
from ..schemas import (
    TaskChallengeResponse,
    MathAnswer,
    PhraseAnswer,
    TaskCheckResponse
)


router = APIRouter(
    prefix="/tasks",
    tags=["Tasks"]
)


PHRASES = [
    "Я просыпаюсь вовремя",
    "Сегодня отличный день",
    "Пора начинать новое утро",
    "Мой день начинается сейчас",
    "Я готов к новым задачам",
    "Каждое утро дает новые возможности"
]


def get_owned_alarm(
    alarm_id: int,
    user: User,
    db: Session
) -> Alarm:
    alarm = db.query(Alarm).filter(
        Alarm.id == alarm_id,
        Alarm.user_id == user.id
    ).first()

    if alarm is None:
        raise HTTPException(
            status_code=404,
            detail="Alarm not found"
        )

    return alarm


def generate_math_task(level: str) -> tuple[str, str]:
    if level == "лёгкая":
        a = random.randint(1, 20)
        b = random.randint(1, 20)
        operation = random.choice(["+", "-"])

        if operation == "-":
            a, b = max(a, b), min(a, b)
            answer = a - b
        else:
            answer = a + b

    elif level == "средняя":
        a = random.randint(2, 15)
        b = random.randint(2, 15)
        operation = random.choice(["+", "-", "*"])

        if operation == "+":
            answer = a + b
        elif operation == "-":
            a, b = max(a, b), min(a, b)
            answer = a - b
        else:
            answer = a * b

    else:
        operation = random.choice(["*", "/"])

        if operation == "*":
            a = random.randint(10, 30)
            b = random.randint(5, 20)
            answer = a * b
        else:
            b = random.randint(2, 12)
            answer = random.randint(2, 20)
            a = b * answer

        if operation == "/":
            a, b = a, b

    question = f"{a} {operation} {b}"

    if operation == "/" and level == "сложная":
        question = f"{a} / {b}"

    return question, str(answer)


def generate_phrase_task() -> tuple[str, str]:
    phrase = random.choice(PHRASES)

    question = (
        "Запомните фразу и введите её в поле ответа: "
        f"{phrase}"
    )

    return question, phrase


def normalize_phrase(value: str) -> str:
    return " ".join(value.casefold().split())


def check_math_answer(
    user_answer: str,
    correct_answer: str
) -> bool:
    try:
        return Decimal(user_answer.strip()) == Decimal(correct_answer)
    except (InvalidOperation, ValueError):
        return False


def save_task_result(
    challenge: TaskChallenge,
    user: User,
    is_correct: bool,
    response_time_seconds: float | None,
    db: Session
) -> TaskCheckResponse:

    result = TaskResult(
        user_id=user.id,
        alarm_id=challenge.alarm_id,
        challenge_id=challenge.id,
        task_type=challenge.task_type,
        level=challenge.level,
        is_correct=is_correct,
        response_time_seconds=response_time_seconds
    )

    challenge.is_completed = True

    db.add(result)
    db.commit()
    db.refresh(result)

    message = (
        "Правильный ответ!"
        if is_correct
        else "Неправильный ответ. Попробуйте ещё раз в следующий раз."
    )

    return TaskCheckResponse(
        challenge_id=challenge.id,
        result_id=result.id,
        is_correct=is_correct,
        message=message
    )


def get_owned_challenge(
    challenge_id: int,
    task_type: str,
    user: User,
    db: Session
) -> TaskChallenge:

    challenge = db.query(TaskChallenge).filter(
        TaskChallenge.id == challenge_id,
        TaskChallenge.user_id == user.id,
        TaskChallenge.task_type == task_type
    ).first()

    if challenge is None:
        raise HTTPException(
            status_code=404,
            detail="Task challenge not found"
        )

    if challenge.is_completed:
        raise HTTPException(
            status_code=400,
            detail="This task has already been completed"
        )

    return challenge


@router.get(
    "/math",
    response_model=TaskChallengeResponse
)
def get_math_task(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alarm = get_owned_alarm(
        alarm_id,
        current_user,
        db
    )

    if alarm.task != "Математика":
        raise HTTPException(
            status_code=400,
            detail="This alarm does not use math tasks"
        )

    question, answer = generate_math_task(alarm.level)

    challenge = TaskChallenge(
        user_id=current_user.id,
        alarm_id=alarm.id,
        task_type="math",
        level=alarm.level,
        question=question,
        expected_answer=answer
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    return TaskChallengeResponse(
        id=challenge.id,
        task_type="math",
        level=challenge.level,
        question=challenge.question,
        created_at=challenge.created_at
    )


@router.post(
    "/math/check",
    response_model=TaskCheckResponse
)
def check_math_task(
    answer_data: MathAnswer,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    challenge = get_owned_challenge(
        answer_data.challenge_id,
        "math",
        current_user,
        db
    )

    is_correct = check_math_answer(
        answer_data.answer,
        challenge.expected_answer
    )

    return save_task_result(
        challenge,
        current_user,
        is_correct,
        answer_data.response_time_seconds,
        db
    )


@router.get(
    "/phrase",
    response_model=TaskChallengeResponse
)
def get_phrase_task(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alarm = get_owned_alarm(
        alarm_id,
        current_user,
        db
    )

    if alarm.task != "Ввод фразы":
        raise HTTPException(
            status_code=400,
            detail="This alarm does not use phrase tasks"
        )

    question, answer = generate_phrase_task()

    challenge = TaskChallenge(
        user_id=current_user.id,
        alarm_id=alarm.id,
        task_type="phrase",
        level=alarm.level,
        question=question,
        expected_answer=answer
    )

    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    return TaskChallengeResponse(
        id=challenge.id,
        task_type="phrase",
        level=challenge.level,
        question=challenge.question,
        created_at=challenge.created_at
    )


@router.post(
    "/phrase/check",
    response_model=TaskCheckResponse
)
def check_phrase_task(
    answer_data: PhraseAnswer,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    challenge = get_owned_challenge(
        answer_data.challenge_id,
        "phrase",
        current_user,
        db
    )

    is_correct = (
        normalize_phrase(answer_data.answer)
        == normalize_phrase(challenge.expected_answer)
    )

    return save_task_result(
        challenge,
        current_user,
        is_correct,
        answer_data.response_time_seconds,
        db
    )