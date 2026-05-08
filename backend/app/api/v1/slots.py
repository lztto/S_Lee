from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime, timedelta, date
import pytz

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_role, Role

router = APIRouter(prefix="/slots", tags=["slots"])

KST = pytz.timezone("Asia/Seoul")

# 기본 상담 시간대 (10:00~22:00, 2시간 단위, 12:00~14:00 점심 제외)
DEFAULT_TIME_BLOCKS = [
    (10, 12),
    (14, 16),
    (16, 18),
    (18, 20),
    (20, 22),
]


def generate_slots_for_date(target_date: date) -> list[tuple[datetime, datetime]]:
    """특정 날짜의 기본 슬롯 시간대 목록 반환 (KST 기준 UTC 변환)"""
    slots = []
    for start_h, end_h in DEFAULT_TIME_BLOCKS:
        start_kst = KST.localize(datetime(target_date.year, target_date.month, target_date.day, start_h, 0))
        end_kst = KST.localize(datetime(target_date.year, target_date.month, target_date.day, end_h, 0))
        slots.append((start_kst.astimezone(pytz.utc).replace(tzinfo=None),
                       end_kst.astimezone(pytz.utc).replace(tzinfo=None)))
    return slots


class SlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime


class BulkSlotCreate(BaseModel):
    """월별 슬롯 일괄 생성 — year, month 기준으로 해당 월 전체 기본 슬롯 생성"""
    year: int
    month: int


class SlotToggle(BaseModel):
    """슬롯 활성/비활성 토글"""
    is_active: bool  # True = 활성(예약 가능), False = 비활성(상담사 휴무)


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


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def create_bulk_slots(
    data: BulkSlotCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """상담사: 특정 월 전체 기본 슬롯 일괄 생성 (이미 있는 날짜는 스킵)"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    # 해당 월의 모든 날짜 순회
    first_day = date(data.year, data.month, 1)
    if data.month == 12:
        last_day = date(data.year + 1, 1, 1) - timedelta(days=1)
    else:
        last_day = date(data.year, data.month + 1, 1) - timedelta(days=1)

    today_utc = datetime.utcnow().date()
    created_count = 0
    skipped_count = 0

    current_day = first_day
    while current_day <= last_day:
        # 오늘 이전 날짜 스킵
        if current_day <= today_utc:
            current_day += timedelta(days=1)
            continue

        slot_times = generate_slots_for_date(current_day)
        for start_utc, end_utc in slot_times:
            # 이미 존재하는 슬롯인지 확인
            existing = await db.execute(
                text("""
                    SELECT id FROM time_slots
                    WHERE counselor_id = :counselor_id
                      AND start_time = :start_time
                """),
                {"counselor_id": current_user["id"], "start_time": start_utc}
            )
            if existing.fetchone():
                skipped_count += 1
                continue

            await db.execute(
                text("""
                    INSERT INTO time_slots (counselor_id, start_time, end_time, is_available)
                    VALUES (:counselor_id, :start_time, :end_time, TRUE)
                """),
                {
                    "counselor_id": current_user["id"],
                    "start_time": start_utc,
                    "end_time": end_utc,
                }
            )
            created_count += 1

        current_day += timedelta(days=1)

    await db.commit()

    return {
        "data": {"created": created_count, "skipped": skipped_count},
        "message": f"{created_count}개 슬롯이 생성되었습니다."
    }


@router.patch("/{slot_id}/toggle")
async def toggle_slot(
    slot_id: str,
    data: SlotToggle,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """상담사: 슬롯 활성/비활성 토글 (예약된 슬롯은 비활성화 불가)"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("SELECT id, counselor_id, is_available FROM time_slots WHERE id = :id"),
        {"id": slot_id}
    )
    slot = result.fetchone()

    if not slot:
        raise HTTPException(status_code=404, detail="슬롯을 찾을 수 없습니다")

    if str(slot.counselor_id) != current_user["id"] and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=403, detail="본인 슬롯만 수정할 수 있습니다")

    # 예약된 슬롯은 비활성화 불가 (reservations 테이블 확인)
    if not data.is_active:
        reserved = await db.execute(
            text("""
                SELECT id FROM reservations
                WHERE slot_id = :slot_id AND status = 'confirmed'
            """),
            {"slot_id": slot_id}
        )
        if reserved.fetchone():
            raise HTTPException(
                status_code=409,
                detail="이미 예약된 슬롯은 비활성화할 수 없습니다"
            )

    await db.execute(
        text("UPDATE time_slots SET is_available = :is_available WHERE id = :id"),
        {"is_available": data.is_active, "id": slot_id}
    )
    await db.commit()

    return {
        "data": {"id": slot_id, "is_available": data.is_active},
        "message": "슬롯이 활성화되었습니다" if data.is_active else "슬롯이 비활성화되었습니다"
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_slot(
    data: SlotCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """상담사: 단일 슬롯 직접 생성"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    if data.start_time >= data.end_time:
        raise HTTPException(status_code=400, detail="종료 시간은 시작 시간보다 늦어야 합니다")

    if data.start_time < datetime.utcnow():
        raise HTTPException(status_code=400, detail="과거 시간에는 슬롯을 만들 수 없습니다")

    overlap = await db.execute(
        text("""
            SELECT id FROM time_slots
            WHERE counselor_id = :counselor_id
              AND start_time < :end_time
              AND end_time   > :start_time
        """),
        {"counselor_id": current_user["id"], "start_time": data.start_time, "end_time": data.end_time},
    )
    if overlap.fetchone():
        raise HTTPException(status_code=409, detail="해당 시간대에 이미 슬롯이 존재합니다")

    result = await db.execute(
        text("""
            INSERT INTO time_slots (counselor_id, start_time, end_time, is_available)
            VALUES (:counselor_id, :start_time, :end_time, TRUE)
            RETURNING id, counselor_id, start_time, end_time, is_available
        """),
        {"counselor_id": current_user["id"], "start_time": data.start_time, "end_time": data.end_time},
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


@router.delete("/{slot_id}")
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
        raise HTTPException(status_code=404, detail="슬롯을 찾을 수 없습니다")

    if str(slot.counselor_id) != current_user["id"] and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=403, detail="본인 슬롯만 삭제할 수 있습니다")

    reserved = await db.execute(
        text("SELECT id FROM reservations WHERE slot_id = :slot_id AND status = 'confirmed'"),
        {"slot_id": slot_id}
    )
    if reserved.fetchone():
        raise HTTPException(status_code=409, detail="예약된 슬롯은 삭제할 수 없습니다")

    await db.execute(text("DELETE FROM time_slots WHERE id = :id"), {"id": slot_id})
    await db.commit()

    return {"data": None, "message": "슬롯이 삭제되었습니다"}