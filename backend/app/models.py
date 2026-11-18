
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String
)
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )

    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )


class Alarm(Base):
    __tablename__ = "alarms"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    time: Mapped[str] = mapped_column(
        String(5),
        nullable=False
    )

    days: Mapped[list[int]] = mapped_column(
        JSON,
        nullable=False,
        default=list
    )

    task: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    level: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    melody: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )

    volume: Mapped[int] = mapped_column(
        Integer,
        default=70,
        nullable=False
    )

    enabled: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
class TaskChallenge(Base):
    __tablename__ = "task_challenges"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    alarm_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("alarms.id"),
        nullable=False,
        index=True
    )

    task_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    level: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    question: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )

    expected_answer: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )

    is_completed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

class TaskResult(Base):
    __tablename__ = "task_results"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        index=True
    )

    user_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )

    alarm_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey("alarms.id"),
        nullable=False,
        index=True
    )

    challenge_id: Mapped[int] = mapped_column(
    Integer,
    ForeignKey("task_challenges.id"),
    nullable=False,
    index=True
    )

    task_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )

    level: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )

    is_correct: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False
    )

    response_time_seconds: Mapped[float | None] = mapped_column(
        Float,
        nullable=True
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )
