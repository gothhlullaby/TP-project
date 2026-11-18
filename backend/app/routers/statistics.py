
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from ..database import get_db
from ..dependencies import get_current_user
from ..models import TaskResult, User
from ..schemas import (
    StatisticsResponse,
    StatisticsHistoryResponse
)


router = APIRouter(
    prefix="/statistics",
    tags=["Statistics"]
)


@router.get(
    "",
    response_model=StatisticsResponse
)
def get_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TaskResult).filter(
        TaskResult.user_id == current_user.id
    )

    total_tasks = query.count()

    correct_tasks = query.filter(
        TaskResult.is_correct.is_(True)
    ).count()

    incorrect_tasks = total_tasks - correct_tasks

    accuracy_percent = (
        round(correct_tasks / total_tasks * 100, 2)
        if total_tasks > 0
        else 0.0
    )

    average_time = db.query(
        func.avg(TaskResult.response_time_seconds)
    ).filter(
        TaskResult.user_id == current_user.id,
        TaskResult.response_time_seconds.isnot(None)
    ).scalar()

    return StatisticsResponse(
        total_tasks=total_tasks,
        correct_tasks=correct_tasks,
        incorrect_tasks=incorrect_tasks,
        accuracy_percent=accuracy_percent,
        average_response_time_seconds=(
            round(float(average_time), 2)
            if average_time is not None
            else None
        )
    )


@router.get(
    "/history",
    response_model=StatisticsHistoryResponse
)
def get_statistics_history(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(TaskResult).filter(
        TaskResult.user_id == current_user.id
    )

    total = query.count()

    results = (
        query
        .order_by(TaskResult.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return StatisticsHistoryResponse(
        results=results,
        total=total
    )
