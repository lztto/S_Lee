from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime
from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_role, Role

router = APIRouter(prefix="/slots", tags=["slots"])


class SlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime


@router.get("/me")
async def get_my_slots(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """상담사: 내 슬롯 목록 조회"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT id, counselor_id, start_time, end_time, is_available
            FROM time_slots
            WHERE counselor_id = :counselor_id
            ORDER BY start_time ASC
        """),
        {"counselor_id": current_user["id"]},
    )
    rows = result.fetchall()

    items = [
        {
            "id": str(row.id),
            "counselor_id": str(row.counselor_id),
            "start_time": row.start_time.isoformat(),
            "end_time": row.end_time.isoformat(),
            "is_available": row.is_available,
        }
        for row in rows
    ]

    return {"data": items, "message": "success", "total": len(items)}


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_slot(
    data: SlotCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """상담사: 슬롯 생성"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    if data.start_time >= data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료 시간은 시작 시간보다 늦어야 합니다",
        )

    if data.start_time < datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="과거 시간에는 슬롯을 만들 수 없습니다",
        )

    # 기존 슬롯과 시간 겹침 확인
    overlap = await db.execute(
        text("""
            SELECT id FROM time_slots
            WHERE counselor_id = :counselor_id
              AND is_available = TRUE
              AND start_time < :end_time
              AND end_time   > :start_time
        """),
        {
            "counselor_id": current_user["id"],
            "start_time": data.start_time,
            "end_time": data.end_time,
        },
    )
    if overlap.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="해당 시간대에 이미 슬롯이 존재합니다",
        )

    result = await db.execute(
        text("""
            INSERT INTO time_slots (counselor_id, start_time, end_time, is_available)
            VALUES (:counselor_id, :start_time, :end_time, TRUE)
            RETURNING id, counselor_id, start_time, end_time, is_available
        """),
        {
            "counselor_id": current_user["id"],
            "start_time": data.start_time,
            "end_time": data.end_time,
        },
    )
    await db.commit()
    row = result.fetchone()

    return {
        "data": {
            "id": str(row.id),
            "counselor_id": str(row.counselor_id),
            "start_time": row.start_time.isoformat(),
            "end_time": row.end_time.isoformat(),
            "is_available": row.is_available,
        },
        "message": "슬롯이 생성되었습니다",
    }


@router.delete("/{slot_id}", status_code=status.HTTP_200_OK)
async def delete_slot(
    slot_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """상담사: 슬롯 삭제 (예약된 슬롯은 삭제 불가)"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("SELECT id, counselor_id, is_available FROM time_slots WHERE id = :id"),
        {"id": slot_id},
    )
    slot = result.fetchone()

    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="슬롯을 찾을 수 없습니다")

    if str(slot.counselor_id) != current_user["id"] and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인 슬롯만 삭제할 수 있습니다")

    if not slot.is_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="예약된 슬롯은 삭제할 수 없습니다",
        )

    await db.execute(text("DELETE FROM time_slots WHERE id = :id"), {"id": slot_id})
    await db.commit()

    return {"data": None, "message": "슬롯이 삭제되었습니다"}