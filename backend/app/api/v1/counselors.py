"""Counselor routes."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from datetime import datetime, timedelta, date, timezone

from app.db.session import get_db

router = APIRouter(prefix="/counselors", tags=["counselors"])

# KST 기준 상담 시간대 (start_hour, end_hour)
TIME_BLOCKS = [
    (10, 12),
    (14, 16),
    (16, 18),
    (18, 20),
    (20, 22),
]

KST_OFFSET = timedelta(hours=9)


def kst_to_utc(target_date: date, hour: int) -> datetime:
    """KST 날짜 + 시간 → UTC naive datetime"""
    # KST 시간을 UTC로 변환: KST - 9시간 = UTC
    kst_dt = datetime(target_date.year, target_date.month, target_date.day, hour, 0)
    utc_dt = kst_dt - KST_OFFSET  # naive UTC
    return utc_dt


def build_slots(
    counselor_id: str,
    blocked_set: set,
    existing_slots: dict,  # key: (kst_date, kst_start_hour), value: {"id": ..., "is_available": ...}
    days_ahead: int = 30,
) -> list[dict]:
    """
    오늘 포함 days_ahead일 동안 모든 슬롯 반환.
    start_time/end_time은 UTC ISO string으로 반환 (프론트에서 timeZone: Asia/Seoul 로 표시)
    """
    now_utc = datetime.now(timezone.utc).replace(tzinfo=None)  # naive UTC
    now_kst = now_utc + KST_OFFSET
    today_kst = now_kst.date()
    cutoff_utc = now_utc + timedelta(minutes=30)

    result = []

    for delta in range(0, days_ahead + 1):
        target_date = today_kst + timedelta(days=delta)

        for start_h, end_h in TIME_BLOCKS:
            # KST → UTC 변환 (naive)
            start_utc = kst_to_utc(target_date, start_h)
            end_utc   = kst_to_utc(target_date, end_h)

            # existing_slots 키: (kst_date, kst_start_hour)
            existing = existing_slots.get((target_date, start_h))

            is_reserved = bool(existing and not existing["is_available"])
            is_blocked  = (target_date, start_h) in blocked_set
            time_passed = start_utc <= cutoff_utc

            unavailable = is_reserved or is_blocked or time_passed

            slot_id = existing["id"] if existing else f"virtual_{counselor_id}_{target_date}_{start_h}"

            if is_reserved:
                reason = "reserved"
            elif is_blocked:
                reason = "blocked"
            elif time_passed:
                reason = "time_passed"
            else:
                reason = None

            # UTC ISO string으로 반환 (+00:00 suffix)
            result.append({
                "id": slot_id,
                "start_time": start_utc.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
                "end_time":   end_utc.strftime("%Y-%m-%dT%H:%M:%S+00:00"),
                "is_available": not unavailable,
                "reason": reason,
                "is_virtual": not bool(existing),
            })

    return result


@router.get("/")
async def get_counselors(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, name, email, created_at
            FROM users
            WHERE role = 'counselor' AND is_active = true
            ORDER BY created_at DESC
        """)
    )
    counselors = result.fetchall()
    return {
        "data": [
            {"id": str(r.id), "name": r.name, "email": r.email, "created_at": str(r.created_at)}
            for r in counselors
        ],
        "message": "success",
        "total": len(counselors),
    }


@router.get("/{counselor_id}")
async def get_counselor(counselor_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("""
            SELECT id, name, email, created_at
            FROM users
            WHERE id = :id AND role = 'counselor' AND is_active = true
        """),
        {"id": counselor_id}
    )
    counselor = result.fetchone()
    if not counselor:
        raise HTTPException(status_code=404, detail="상담사를 찾을 수 없습니다")

    # 차단된 슬롯 조회
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

    # 기존 time_slots 조회 — DB에서 UTC로 읽어서 KST로 변환 후 키 생성
    slots_result = await db.execute(
        text("""
            SELECT id, start_time, end_time, is_available
            FROM time_slots
            WHERE counselor_id = :counselor_id
              AND start_time >= NOW() - INTERVAL '2 hour'
        """),
        {"counselor_id": counselor_id}
    )
    existing_slots = {}
    for row in slots_result.fetchall():
        # DB의 start_time은 UTC (TIMESTAMPTZ → Python에서 aware 또는 naive UTC로 옴)
        st = row.start_time
        # SQLAlchemy+asyncpg는 timezone-aware로 반환하는 경우도 있음 → naive UTC로 통일
        if st.tzinfo is not None:
            st_utc = st.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            st_utc = st  # 이미 naive UTC

        # UTC → KST
        st_kst = st_utc + KST_OFFSET
        kst_date = st_kst.date()
        kst_hour = st_kst.hour

        existing_slots[(kst_date, kst_hour)] = {
            "id": str(row.id),
            "is_available": row.is_available,
        }

    all_slots = build_slots(
        counselor_id=counselor_id,
        blocked_set=blocked_set,
        existing_slots=existing_slots,
    )

    # profile_image 조회 시도 (없으면 None)
    profile_image = None
    try:
        pi_result = await db.execute(
            text("SELECT profile_image FROM users WHERE id = :id"),
            {"id": counselor_id}
        )
        pi_row = pi_result.fetchone()
        if pi_row and hasattr(pi_row, 'profile_image'):
            profile_image = pi_row.profile_image
    except Exception:
        pass

    return {
        "data": {
            "id": str(counselor.id),
            "name": counselor.name,
            "email": counselor.email,
            "profile_image": profile_image,
            "created_at": str(counselor.created_at),
            "available_slots": all_slots,
        },
        "message": "success",
    }