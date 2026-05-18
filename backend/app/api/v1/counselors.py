from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta, date, timezone

from app.db.session import get_db

router = APIRouter(prefix="/counselors", tags=["counselors"])

TIME_BLOCKS = [
    (10, 12),
    (14, 16),
    (16, 18),
    (18, 20),
    (20, 22),
]

KST_OFFSET = timedelta(hours=9)


def build_slots(
    counselor_id: str,
    blocked_set: set,       # {(date, start_hour), ...}
    existing_slots: dict,   # {(date, start_hour): {"id": ..., "is_available": ...}}
    days_ahead: int = 30,
) -> list[dict]:
    """
    오늘 포함 days_ahead일 동안 모든 슬롯을 반환.
    - is_available=True  → 예약 가능 (선택 가능)
    - is_available=False → 예약 불가 (회색 빗금 표시용)

    불가 사유:
      1. 시작 30분 전 이미 지남 (시간 초과)
      2. blocked_slots 에 차단됨
      3. time_slots 에 is_available=False (예약 완료)
    """
    now_utc = datetime.now(timezone.utc)
    now_kst = now_utc + KST_OFFSET
    today_kst = now_kst.date()
    cutoff = now_utc + timedelta(minutes=30)  # 30분 후가 예약 가능 최소 기준

    result = []

    for delta in range(0, days_ahead + 1):   # 0 = 오늘 포함
        target_date = today_kst + timedelta(days=delta)

        for start_h, end_h in TIME_BLOCKS:
            # UTC 변환
            start_utc = datetime(
                target_date.year, target_date.month, target_date.day,
                start_h, 0, tzinfo=timezone.utc
            ) - KST_OFFSET
            end_utc = datetime(
                target_date.year, target_date.month, target_date.day,
                end_h, 0, tzinfo=timezone.utc
            ) - KST_OFFSET

            # 불가 사유 판단
            time_passed  = start_utc <= cutoff                          # 30분 이내 또는 지남
            is_blocked   = (target_date, start_h) in blocked_set       # 상담사 차단
            existing     = existing_slots.get((target_date, start_h))
            is_reserved  = existing and not existing["is_available"]    # 예약 완료

            unavailable = time_passed or is_blocked or is_reserved

            # 슬롯 ID
            if existing:
                slot_id = existing["id"]
            else:
                slot_id = f"virtual_{counselor_id}_{target_date}_{start_h}"

            # 불가 사유 라벨 (프론트 표시용)
            if time_passed:
                reason = "time_passed"
            elif is_blocked:
                reason = "blocked"
            elif is_reserved:
                reason = "reserved"
            else:
                reason = None

            result.append({
                "id": slot_id,
                "start_time": start_utc.isoformat(),
                "end_time": end_utc.isoformat(),
                "is_available": not unavailable,
                "reason": reason,          # None | "time_passed" | "blocked" | "reserved"
                "is_virtual": not bool(existing),
            })

    return result


# ─── 상담사 목록 조회 (누구나 접근 가능) ───
@router.get("/")
async def get_counselors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, name, email, created_at, profile_image
            FROM users
            WHERE role = 'counselor' AND is_active = true
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
                "profile_image": row.profile_image,
            }
            for row in counselors
        ],
        "message": "success",
        "total": len(counselors),
    }


# ─── 상담사 상세 + 전체 슬롯 (누구나) ───
@router.get("/{counselor_id}")
async def get_counselor(counselor_id: str, db: AsyncSession = Depends(get_db)):
    # 상담사 정보
    result = await db.execute(
        text("""
            SELECT id, name, email, created_at, profile_image
            FROM users
            WHERE id = :id AND role = 'counselor' AND is_active = true
        """),
        {"id": counselor_id}
    )
    counselor = result.fetchone()
    if not counselor:
        raise HTTPException(status_code=404, detail="상담사를 찾을 수 없습니다")

    # 차단된 슬롯
    blocked_result = await db.execute(
        text("""
            SELECT blocked_date, start_hour
            FROM blocked_slots
            WHERE counselor_id = :counselor_id
              AND blocked_date >= CURRENT_DATE
        """),
        {"counselor_id": counselor_id}
    )
    blocked_set = {(row.blocked_date, row.start_hour) for row in blocked_result.fetchall()}

    # 기존 time_slots (예약 여부 확인)
    slots_result = await db.execute(
        text("""
            SELECT id, start_time, end_time, is_available
            FROM time_slots
            WHERE counselor_id = :counselor_id
              AND start_time >= NOW() - INTERVAL '1 hour'
        """),
        {"counselor_id": counselor_id}
    )
    existing_slots = {}
    for row in slots_result.fetchall():
        kst_dt = row.start_time.replace(tzinfo=timezone.utc) + KST_OFFSET
        existing_slots[(kst_dt.date(), kst_dt.hour)] = {
            "id": str(row.id),
            "is_available": row.is_available,
        }

    all_slots = build_slots(
        counselor_id=counselor_id,
        blocked_set=blocked_set,
        existing_slots=existing_slots,
    )

    return {
        "data": {
            "id": str(counselor.id),
            "name": counselor.name,
            "email": counselor.email,
            "created_at": str(counselor.created_at),
            "profile_image": counselor.profile_image,
            "available_slots": all_slots,
        },
        "message": "success",
    }
