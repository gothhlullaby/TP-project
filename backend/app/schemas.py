from typing import Literal
from datetime import datetime
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator
)


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    is_active: bool


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AlarmBase(BaseModel):
    time: str = Field(
        pattern=r"^([01]\d|2[0-3]):[0-5]\d$"
    )

    days: list[int] = Field(default_factory=list)

    task: Literal["Математика", "Ввод фразы"] = "Математика"

    level: Literal["лёгкая", "средняя", "сложная"] = "средняя"

    melody: str = Field(
        default="Утренний свет",
        max_length=100
    )

    volume: int = Field(
        default=70,
        ge=0,
        le=100
    )

    enabled: bool = True

    @field_validator("days")
    @classmethod
    def validate_days(cls, days):
        if any(day < 0 or day > 6 for day in days):
            raise ValueError(
                "Дни недели должны быть от 0 до 6"
            )

        if len(days) != len(set(days)):
            raise ValueError(
                "Дни недели не должны повторяться"
            )

        return days


class AlarmCreate(AlarmBase):
    pass


class AlarmUpdate(AlarmBase):
    pass


class AlarmResponse(AlarmBase):
    model_config = ConfigDict(from_attributes=True)

    id: int

# Схема выдаваемого задания
class TaskChallengeResponse(BaseModel):
    id: int
    task_type: Literal["math", "phrase"]
    level: Literal["лёгкая", "средняя", "сложная"]
    question: str
    created_at: datetime


# Схема отправки математического ответа
class MathAnswer(BaseModel):
    challenge_id: int
    answer: str = Field(min_length=1, max_length=255)
    response_time_seconds: float | None = Field(
        default=None,
        ge=0
    )


# Схема отправки фразы
class PhraseAnswer(BaseModel):
    challenge_id: int
    answer: str = Field(min_length=1, max_length=255)
    response_time_seconds: float | None = Field(
        default=None,
        ge=0
    )


# Схема результата проверки задания
class TaskCheckResponse(BaseModel):
    challenge_id: int
    result_id: int
    is_correct: bool
    message: str


# Схема сохранённого результата
class TaskResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    alarm_id: int
    challenge_id: int
    task_type: str
    level: str
    is_correct: bool
    response_time_seconds: float | None
    created_at: datetime


# Схема общей статистики
class StatisticsResponse(BaseModel):
    total_tasks: int
    correct_tasks: int
    incorrect_tasks: int
    accuracy_percent: float
    average_response_time_seconds: float | None


# Схема истории выполнения заданий
class StatisticsHistoryResponse(BaseModel):
    results: list[TaskResultResponse]
    total: int