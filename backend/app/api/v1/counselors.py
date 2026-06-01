"""Counselor routes."""
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


def kst_to_utc(target_date: date, hour: int) -> datetime:
    """KST 날짜 + 시간 → UTC naive datetime"""
    # KST 시간을 UTC로 변환: KST - 9시간 = UTC
    kst_dt = datetime(target_date.year, target_date.month, target_date.day, hour, 0)
    utc_dt = kst_dt - KST_OFFSET  # naive UTC
    return utc_dt


def build_slots(
    counselor_id: str,
    blocked_set: set,
    existing_slots: dict,
    existing_slots: dict,
    days_ahead: int = 30,
) -> list[dict]:
    now_utc = datetime.now(timezone.utc)
    now_utc = datetime.now(timezone.utc)
    now_kst = now_utc + KST_OFFSET
    today_kst = now_kst.date()
    cutoff = now_utc + timedelta(minutes=30)
    cutoff = now_utc + timedelta(minutes=30)

    result = []

    for delta in range(0, days_ahead + 1):
        target_date = today_kst + timedelta(days=delta)

        for start_h, end_h in TIME_BLOCKS:
            start_utc = datetime(
                target_date.year, target_date.month, target_date.day,
                start_h, 0, tzinfo=timezone.utc
            ) - KST_OFFSET
            end_utc = datetime(
                target_date.year, target_date.month, target_date.day,
                end_h, 0, tzinfo=timezone.utc
            ) - KST_OFFSET

            existing     = existing_slots.get((target_date, start_h))
            is_reserved  = bool(existing and not existing["is_available"])
            is_blocked   = (target_date, start_h) in blocked_set
            time_passed  = start_utc <= cutoff

            unavailable = time_passed or is_blocked or is_reserved

            if existing:
                slot_id = existing["id"]
            else:
                slot_id = f"virtual_{counselor_id}_{target_date}_{start_h}"
            start_utc = datetime(
                target_date.year, target_date.month, target_date.day,
                start_h, 0, tzinfo=timezone.utc
            ) - KST_OFFSET
            end_utc = datetime(
                target_date.year, target_date.month, target_date.day,
                end_h, 0, tzinfo=timezone.utc
            ) - KST_OFFSET

            existing     = existing_slots.get((target_date, start_h))
            is_reserved  = bool(existing and not existing["is_available"])
            is_blocked   = (target_date, start_h) in blocked_set
            time_passed  = start_utc <= cutoff

            unavailable = time_passed or is_blocked or is_reserved

            if existing:
                slot_id = existing["id"]
            else:
                slot_id = f"virtual_{counselor_id}_{target_date}_{start_h}"

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
                "id": str(r.id),
                "name": r.name,
                "email": r.email,
                "created_at": str(r.created_at),
                "profile_image": r.profile_image,
            }
            for r in counselors
        ],
        "message": "success",
        "total": len(counselors),
    }


@router.get("/{counselor_id}")
async def get_counselor(counselor_id: str, db: AsyncSession = Depends(get_db)):
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

    slots_result = await db.execute(
        text("""
            SELECT id, start_time, end_time, is_available
            FROM time_slots
            WHERE counselor_id = :counselor_id
              AND start_time >= NOW() - INTERVAL '2 hour'
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