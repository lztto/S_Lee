"""Blocked slots routes — 상담사가 차단할 시간대 관리"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from datetime import date

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_role, Role

router = APIRouter(prefix="/slots", tags=["slots"])

VALID_HOURS = {10, 14, 16, 18, 20}


class BlockRequest(BaseModel):
    blocked_date: date
    start_hour: int   # 10, 14, 16, 18, 20 중 하나


class UnblockRequest(BaseModel):
    blocked_date: date
    start_hour: int


# ─── 내 차단 목록 조회 ───
@router.get("/blocked")
async def get_blocked_slots(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT id, blocked_date, start_hour, created_at
            FROM blocked_slots
            WHERE counselor_id = :counselor_id
              AND blocked_date >= CURRENT_DATE
            ORDER BY blocked_date, start_hour
        """),
        {"counselor_id": current_user["id"]}
    )
    rows = result.fetchall()
    return {
        "data": [
            {
                "id": str(r.id),
                "blocked_date": str(r.blocked_date),
                "start_hour": r.start_hour,
            }
            for r in rows
        ],
        "message": "success",
        "total": len(rows),
    }


# ─── 시간대 차단 ───
@router.post("/block", status_code=status.HTTP_201_CREATED)
async def block_slot(
    data: BlockRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    if data.start_hour not in VALID_HOURS:
        raise HTTPException(status_code=400, detail=f"유효한 시작 시간이 아닙니다. ({sorted(VALID_HOURS)})")

    if data.blocked_date < date.today():
        raise HTTPException(status_code=400, detail="과거 날짜는 차단할 수 없습니다")

    # 이미 예약된 슬롯이 있으면 차단 불가
    from datetime import datetime, timedelta, timezone
    KST_OFFSET = timedelta(hours=9)
    start_utc = datetime(
        data.blocked_date.year, data.blocked_date.month, data.blocked_date.day,
        data.start_hour, 0, tzinfo=timezone.utc
    ) - KST_OFFSET

    reserved = await db.execute(
        text("""
            SELECT r.id FROM reservations r
            JOIN time_slots ts ON r.slot_id = ts.id
            WHERE ts.counselor_id = :counselor_id
              AND ts.start_time = :start_time
              AND r.status = 'confirmed'
        """),
        {"counselor_id": current_user["id"], "start_time": start_utc}
    )
    if reserved.fetchone():
        raise HTTPException(status_code=409, detail="해당 시간에 이미 확정된 예약이 있어 차단할 수 없습니다")

    # 차단 등록 (중복이면 무시)
    await db.execute(
        text("""
            INSERT INTO blocked_slots (counselor_id, blocked_date, start_hour)
            VALUES (:counselor_id, :blocked_date, :start_hour)
            ON CONFLICT (counselor_id, blocked_date, start_hour) DO NOTHING
        """),
        {
            "counselor_id": current_user["id"],
            "blocked_date": data.blocked_date,
            "start_hour": data.start_hour,
        }
    )
    await db.commit()
    return {"data": None, "message": "해당 시간대가 차단되었습니다"}


# ─── 시간대 차단 해제 ───
@router.delete("/block")
async def unblock_slot(
    data: UnblockRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("""
            DELETE FROM blocked_slots
            WHERE counselor_id = :counselor_id
              AND blocked_date = :blocked_date
              AND start_hour = :start_hour
        """),
        {
            "counselor_id": current_user["id"],
            "blocked_date": data.blocked_date,
            "start_hour": data.start_hour,
        }
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="차단된 슬롯을 찾을 수 없습니다")

    return {"data": None, "message": "차단이 해제되었습니다"}