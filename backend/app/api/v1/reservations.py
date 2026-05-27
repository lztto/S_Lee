from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_role, Role

router = APIRouter(prefix="/reservations", tags=["reservations"])

KST_OFFSET = timedelta(hours=9)
VALID_HOURS = {10, 14, 16, 18, 20}
BLOCK_HOURS = {(10, 12), (14, 16), (16, 18), (18, 20), (20, 22)}


class ReservationCreate(BaseModel):
    # slot_id가 "virtual_..."이면 자동 생성, 실제 UUID면 기존 슬롯 사용
    slot_id: str
    # virtual 슬롯일 때 필요한 정보
    counselor_id: str | None = None
    start_time: str | None = None   # ISO 8601


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_reservation(
    data: ReservationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내담자: 예약 생성 — 가상 슬롯이면 자동으로 time_slots에 생성"""
    require_role(current_user, [Role.CLIENT, Role.ADMIN])

    is_virtual = data.slot_id.startswith("virtual_")

    if is_virtual:
        # virtual 슬롯 → counselor_id, start_time 필수
        if not data.counselor_id or not data.start_time:
            raise HTTPException(status_code=400, detail="가상 슬롯 예약 시 counselor_id와 start_time이 필요합니다")

        # ISO string 파싱 → naive UTC
        # sessionStorage 경유 시 '+' → ' ' 변환 문제 방지
        raw = data.start_time.replace("Z", "+00:00").replace(" ", "+")
        parsed = datetime.fromisoformat(raw)
        if parsed.tzinfo is not None:
            start_dt = parsed.astimezone(timezone.utc).replace(tzinfo=None)
        else:
            start_dt = parsed  # 이미 naive UTC로 가정
        kst_hour = (start_dt + KST_OFFSET).hour

        if kst_hour not in VALID_HOURS:
            raise HTTPException(status_code=400, detail="유효하지 않은 상담 시간대입니다")

        # end_time 계산 (2시간)
        end_dt = start_dt + timedelta(hours=2)

        # 차단된 시간인지 확인
        kst_date = (start_dt + KST_OFFSET).date()
        blocked = await db.execute(
            text("""
                SELECT id FROM blocked_slots
                WHERE counselor_id = :counselor_id
                  AND blocked_date = :blocked_date
                  AND start_hour = :start_hour
            """),
            {"counselor_id": data.counselor_id, "blocked_date": kst_date, "start_hour": kst_hour}
        )
        if blocked.fetchone():
            raise HTTPException(status_code=409, detail="해당 시간은 상담이 불가합니다")

        # 이미 예약된 슬롯인지 확인 (SELECT FOR UPDATE)
        existing_slot = await db.execute(
            text("""
                SELECT id, is_available FROM time_slots
                WHERE counselor_id = :counselor_id
                  AND start_time = :start_time
                FOR UPDATE
            """),
            {"counselor_id": data.counselor_id, "start_time": start_dt}
        )
        slot_row = existing_slot.fetchone()

        if slot_row:
            if not slot_row.is_available:
                raise HTTPException(status_code=409, detail="이미 예약된 시간입니다")
            actual_slot_id = str(slot_row.id)
        else:
            # 슬롯 자동 생성
            new_slot = await db.execute(
                text("""
                    INSERT INTO time_slots (counselor_id, start_time, end_time, is_available)
                    VALUES (:counselor_id, :start_time, :end_time, FALSE)
                    RETURNING id
                """),
                {
                    "counselor_id": data.counselor_id,
                    "start_time": start_dt,
                    "end_time": end_dt,
                }
            )
            actual_slot_id = str(new_slot.fetchone().id)

        counselor_id_for_check = data.counselor_id

    else:
        # 실제 슬롯 ID — 기존 방식 (SELECT FOR UPDATE)
        existing_slot = await db.execute(
            text("""
                SELECT id, counselor_id, is_available FROM time_slots
                WHERE id = :slot_id
                FOR UPDATE
            """),
            {"slot_id": data.slot_id}
        )
        slot_row = existing_slot.fetchone()

        if not slot_row:
            raise HTTPException(status_code=404, detail="슬롯을 찾을 수 없습니다")
        if not slot_row.is_available:
            raise HTTPException(status_code=409, detail="이미 예약된 슬롯입니다")

        actual_slot_id = data.slot_id
        counselor_id_for_check = str(slot_row.counselor_id)

    # 본인 슬롯 예약 방지
    if counselor_id_for_check == current_user["id"]:
        raise HTTPException(status_code=400, detail="본인 슬롯은 예약할 수 없습니다")

    # 예약 생성 — ON CONFLICT: 같은 slot_id로 이미 예약된 경우 기존 예약 반환 (중복 실행 방지)
    res = await db.execute(
        text("""
            INSERT INTO reservations (slot_id, client_id, status)
            VALUES (:slot_id, :client_id, 'confirmed')
            ON CONFLICT (slot_id) DO NOTHING
            RETURNING id, slot_id, client_id, status, created_at
        """),
        {"slot_id": actual_slot_id, "client_id": current_user["id"]}
    )
    reservation = res.fetchone()

    # ON CONFLICT로 INSERT 스킵된 경우 → 기존 예약 조회
    if reservation is None:
        existing_res = await db.execute(
            text("SELECT id, slot_id, client_id, status, created_at FROM reservations WHERE slot_id = :slot_id"),
            {"slot_id": actual_slot_id}
        )
        reservation = existing_res.fetchone()

    # 슬롯 비활성화
    await db.execute(
        text("UPDATE time_slots SET is_available = FALSE WHERE id = :id"),
        {"id": actual_slot_id}
    )
    await db.commit()

    return {
        "data": {
            "id": str(reservation.id),
            "slot_id": str(reservation.slot_id),
            "client_id": str(reservation.client_id),
            "status": reservation.status,
            "created_at": reservation.created_at.isoformat(),
        },
        "message": "예약이 완료되었습니다"
    }


@router.get("/me")
async def get_my_reservations(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내담자: 내 예약 목록"""
    require_role(current_user, [Role.CLIENT, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT r.id, r.slot_id, r.client_id, r.status, r.created_at,
                   ts.start_time AS slot_start_time, ts.end_time AS slot_end_time,
                   u.name AS counselor_name,
                   j.id AS journal_id, rv.id AS review_id
            FROM reservations r
            JOIN time_slots ts ON r.slot_id = ts.id
            JOIN users u ON ts.counselor_id = u.id
            LEFT JOIN journals j ON j.reservation_id = r.id
            LEFT JOIN reviews rv ON rv.reservation_id = r.id
            WHERE r.client_id = :client_id
            ORDER BY ts.start_time DESC
        """),
        {"client_id": current_user["id"]},
    )
    rows = result.fetchall()
    items = []
    for row in rows:
        m = dict(row._mapping)
        items.append({
            "id": str(m["id"]),
            "slot_id": str(m["slot_id"]),
            "client_id": str(m["client_id"]),
            "status": m["status"],
            "created_at": m["created_at"].isoformat() if m["created_at"] else None,
            "counselor_name": m["counselor_name"],
            "journal_id": str(m["journal_id"]) if m["journal_id"] else None,
            "review_id": str(m["review_id"]) if m["review_id"] else None,
            "slot": {
                "start_time": m["slot_start_time"].isoformat() if m["slot_start_time"] else None,
                "end_time": m["slot_end_time"].isoformat() if m["slot_end_time"] else None,
            },
        })
    return {"data": items, "message": "success", "total": len(items)}


@router.get("/counselor")
async def get_counselor_reservations(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """상담사: 내 예약 목록"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT r.id, r.slot_id, r.client_id, r.status, r.created_at,
                   ts.start_time AS slot_start_time, ts.end_time AS slot_end_time,
                   u.name AS client_name, j.id AS journal_id
            FROM reservations r
            JOIN time_slots ts ON r.slot_id = ts.id
            JOIN users u ON r.client_id = u.id
            LEFT JOIN journals j ON j.reservation_id = r.id
            WHERE ts.counselor_id = :counselor_id
            ORDER BY ts.start_time DESC
        """),
        {"counselor_id": current_user["id"]},
    )
    rows = result.fetchall()
    items = []
    for row in rows:
        m = dict(row._mapping)
        items.append({
            "id": str(m["id"]),
            "slot_id": str(m["slot_id"]),
            "client_id": str(m["client_id"]),
            "status": m["status"],
            "created_at": m["created_at"].isoformat() if m["created_at"] else None,
            "client_name": m["client_name"],
            "journal_id": str(m["journal_id"]) if m["journal_id"] else None,
            "slot": {
                "start_time": m["slot_start_time"].isoformat() if m["slot_start_time"] else None,
                "end_time": m["slot_end_time"].isoformat() if m["slot_end_time"] else None,
            },
        })
    return {"data": items, "message": "success", "total": len(items)}


@router.patch("/{reservation_id}/cancel")
async def cancel_reservation(
    reservation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내담자: 예약 취소"""
    require_role(current_user, [Role.CLIENT, Role.ADMIN])

    result = await db.execute(
        text("SELECT r.id, r.client_id, r.status, r.slot_id FROM reservations r WHERE r.id = :id"),
        {"id": reservation_id},
    )
    reservation = result.fetchone()

    if not reservation:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다")
    if str(reservation.client_id) != current_user["id"] and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=403, detail="본인 예약만 취소할 수 있습니다")
    if reservation.status == "cancelled":
        raise HTTPException(status_code=400, detail="이미 취소된 예약입니다")

    await db.execute(
        text("UPDATE reservations SET status = 'cancelled' WHERE id = :id"),
        {"id": reservation_id},
    )
    await db.execute(
        text("UPDATE time_slots SET is_available = TRUE WHERE id = :slot_id"),
        {"slot_id": str(reservation.slot_id)},
    )
    await db.commit()
    return {"data": None, "message": "예약이 취소되었습니다"}