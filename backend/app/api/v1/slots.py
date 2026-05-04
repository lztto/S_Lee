from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_counselor

router = APIRouter(prefix="/slots", tags=["slots"])


# ─── Pydantic 스키마 ───

class SlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime


# ─── 슬롯 생성 (상담사만 가능) ───
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_slot(
    data: SlotCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_counselor(current_user)

    # 시간 유효성 검사
    if data.start_time >= data.end_time:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="종료 시간이 시작 시간보다 늦어야 합니다"
        )

    # 중복 슬롯 확인
    result = await db.execute(
        text("""
            SELECT id FROM time_slots
            WHERE counselor_id = :counselor_id
            AND is_available = true
            AND (
                (start_time <= :start_time AND end_time > :start_time)
                OR (start_time < :end_time AND end_time >= :end_time)
                OR (start_time >= :start_time AND end_time <= :end_time)
            )
        """),
        {
            "counselor_id": current_user["id"],
            "start_time": data.start_time,
            "end_time": data.end_time,
        }
    )
    if result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="해당 시간대에 이미 슬롯이 존재합니다"
        )

    # 슬롯 생성
    result = await db.execute(
        text("""
            INSERT INTO time_slots (counselor_id, start_time, end_time)
            VALUES (:counselor_id, :start_time, :end_time)
            RETURNING id, counselor_id, start_time, end_time, is_available
        """),
        {
            "counselor_id": current_user["id"],
            "start_time": data.start_time,
            "end_time": data.end_time,
        }
    )
    slot = result.fetchone()

    return {
        "data": {
            "id": str(slot.id),
            "counselor_id": str(slot.counselor_id),
            "start_time": str(slot.start_time),
            "end_time": str(slot.end_time),
            "is_available": slot.is_available,
        },
        "message": "슬롯이 생성되었습니다"
    }


# ─── 특정 상담사의 슬롯 목록 조회 (누구나 가능) ───
@router.get("/counselor/{counselor_id}")
async def get_counselor_slots(
    counselor_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        text("""
            SELECT id, counselor_id, start_time, end_time, is_available
            FROM time_slots
            WHERE counselor_id = :counselor_id
            AND start_time > NOW()
            ORDER BY start_time ASC
        """),
        {"counselor_id": counselor_id}
    )
    slots = result.fetchall()

    return {
        "data": [
            {
                "id": str(slot.id),
                "counselor_id": str(slot.counselor_id),
                "start_time": str(slot.start_time),
                "end_time": str(slot.end_time),
                "is_available": slot.is_available,
            }
            for slot in slots
        ],
        "message": "success",
        "total": len(slots)
    }


# ─── 내 슬롯 목록 조회 (상담사 본인) ───
@router.get("/me")
async def get_my_slots(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_counselor(current_user)

    result = await db.execute(
        text("""
            SELECT
                ts.id, ts.start_time, ts.end_time, ts.is_available,
                r.id as reservation_id,
                u.name as client_name
            FROM time_slots ts
            LEFT JOIN reservations r ON r.slot_id = ts.id
            LEFT JOIN users u ON u.id = r.client_id
            WHERE ts.counselor_id = :counselor_id
            ORDER BY ts.start_time ASC
        """),
        {"counselor_id": current_user["id"]}
    )
    slots = result.fetchall()

    return {
        "data": [
            {
                "id": str(slot.id),
                "start_time": str(slot.start_time),
                "end_time": str(slot.end_time),
                "is_available": slot.is_available,
                "reservation_id": str(slot.reservation_id) if slot.reservation_id else None,
                "client_name": slot.client_name,
            }
            for slot in slots
        ],
        "message": "success",
        "total": len(slots)
    }


# ─── 슬롯 삭제 (상담사 본인만) ───
@router.delete("/{slot_id}")
async def delete_slot(
    slot_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_counselor(current_user)

    # 본인 슬롯인지 확인
    result = await db.execute(
        text("SELECT id, is_available FROM time_slots WHERE id = :id AND counselor_id = :counselor_id"),
        {"id": slot_id, "counselor_id": current_user["id"]}
    )
    slot = result.fetchone()

    if not slot:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="슬롯을 찾을 수 없습니다")

    # 이미 예약된 슬롯은 삭제 불가
    if not slot.is_available:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="이미 예약된 슬롯은 삭제할 수 없습니다")

    await db.execute(
        text("DELETE FROM time_slots WHERE id = :id"),
        {"id": slot_id}
    )

    return {"data": None, "message": "슬롯이 삭제되었습니다"}