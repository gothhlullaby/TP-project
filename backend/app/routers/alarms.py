
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..dependencies import get_current_user
from ..models import Alarm, User
from ..schemas import AlarmCreate, AlarmUpdate, AlarmResponse


router = APIRouter(
    prefix="/alarms",
    tags=["Alarms"]
)


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
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alarm not found"
        )

    return alarm


@router.get(
    "",
    response_model=list[AlarmResponse]
)
def get_alarms(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return (
        db.query(Alarm)
        .filter(Alarm.user_id == current_user.id)
        .order_by(Alarm.time)
        .all()
    )


@router.post(
    "",
    response_model=AlarmResponse,
    status_code=status.HTTP_201_CREATED
)
def create_alarm(
    alarm_data: AlarmCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alarm = Alarm(
        user_id=current_user.id,
        **alarm_data.model_dump()
    )

    db.add(alarm)
    db.commit()
    db.refresh(alarm)

    return alarm


@router.get(
    "/{alarm_id}",
    response_model=AlarmResponse
)
def get_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return get_owned_alarm(
        alarm_id,
        current_user,
        db
    )


@router.put(
    "/{alarm_id}",
    response_model=AlarmResponse
)
def update_alarm(
    alarm_id: int,
    alarm_data: AlarmUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alarm = get_owned_alarm(
        alarm_id,
        current_user,
        db
    )

    for field, value in alarm_data.model_dump().items():
        setattr(alarm, field, value)

    db.commit()
    db.refresh(alarm)

    return alarm


@router.patch(
    "/{alarm_id}/toggle",
    response_model=AlarmResponse
)
def toggle_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alarm = get_owned_alarm(
        alarm_id,
        current_user,
        db
    )

    alarm.enabled = not alarm.enabled

    db.commit()
    db.refresh(alarm)

    return alarm


@router.delete(
    "/{alarm_id}",
    status_code=status.HTTP_204_NO_CONTENT
)
def delete_alarm(
    alarm_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    alarm = get_owned_alarm(
        alarm_id,
        current_user,
        db
    )

    db.delete(alarm)
    db.commit()

    return None
