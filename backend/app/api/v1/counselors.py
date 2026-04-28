"""Counselor routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/counselors", tags=["counselors"])


# ─── 상담사 목록 조회 ───
# 누구나 접근 가능 (로그인 불필요)
@router.get("/")
async def get_counselors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, name, email, created_at
            FROM users
            WHERE role = 'counselor'
            AND is_active = true
            ORDER BY created_at DESC
        """)
    )
    counselors = result.fetchall()

    return {
        "data": [
            {
                "id": str(row.id),
                "name": row.name,
                "email": row.email,
                "created_at": str(row.created_at),
            }
            for row in counselors
        ],
        "message": "success",
        "total": len(counselors)
    }


# ─── 상담사 상세 조회 ───
@router.get("/{counselor_id}")
async def get_counselor(
    counselor_id: str,
    db: AsyncSession = Depends(get_db)
):
    # 상담사 정보 조회
    result = await db.execute(
        text("""
            SELECT id, name, email, created_at
            FROM users
            WHERE id = :id
            AND role = 'counselor'
            AND is_active = true
        """),
        {"id": counselor_id}
    )
    counselor = result.fetchone()

    if not counselor:
        raise HTTPException(status_code=404, detail="상담사를 찾을 수 없습니다")

    # 해당 상담사의 예약 가능한 슬롯 조회
    slots_result = await db.execute(
        text("""
            SELECT id, start_time, end_time, is_available
            FROM time_slots
            WHERE counselor_id = :counselor_id
            AND is_available = true
            AND start_time > NOW()
            ORDER BY start_time ASC
        """),
        {"counselor_id": counselor_id}
    )
    slots = slots_result.fetchall()

    return {
        "data": {
            "id": str(counselor.id),
            "name": counselor.name,
            "email": counselor.email,
            "created_at": str(counselor.created_at),
            "available_slots": [
                {
                    "id": str(slot.id),
                    "start_time": str(slot.start_time),
                    "end_time": str(slot.end_time),
                    "is_available": slot.is_available,
                }
                for slot in slots
            ]
        },
        "message": "success"
    }