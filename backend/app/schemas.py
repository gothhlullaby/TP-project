from typing import Literal

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
