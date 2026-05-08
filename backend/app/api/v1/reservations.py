from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_role, Role

router = APIRouter(prefix="/reservations", tags=["reservations"])


class ReservationCreate(BaseModel):
    slot_id: str


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_reservation(
    data: ReservationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내담자: 예약 생성 (SELECT FOR UPDATE로 동시성 제어)"""
    require_role(current_user, [Role.CLIENT, Role.ADMIN])

    # SELECT FOR UPDATE — get_db()가 이미 트랜잭션을 시작하므로 async with db.begin() 사용 안 함
    result = await db.execute(
        text("""
            SELECT id, counselor_id, is_available
            FROM time_slots
            WHERE id = :slot_id
            FOR UPDATE
        """),
        {"slot_id": data.slot_id}
    )
    slot = result.fetchone()

    if not slot:
        raise HTTPException(status_code=404, detail="슬롯을 찾을 수 없습니다")

    if not slot.is_available:
        raise HTTPException(status_code=409, detail="이미 예약된 슬롯입니다")

    if str(slot.counselor_id) == current_user["id"]:
        raise HTTPException(status_code=400, detail="본인 슬롯은 예약할 수 없습니다")

    res = await db.execute(
        text("""
            INSERT INTO reservations (slot_id, client_id, status)
            VALUES (:slot_id, :client_id, 'confirmed')
            RETURNING id, slot_id, client_id, status, created_at
        """),
        {"slot_id": data.slot_id, "client_id": current_user["id"]}
    )
    reservation = res.fetchone()

    await db.execute(
        text("UPDATE time_slots SET is_available = FALSE WHERE id = :slot_id"),
        {"slot_id": data.slot_id}
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
    """내담자: 내 예약 목록 조회"""
    require_role(current_user, [Role.CLIENT, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT
                r.id,
                r.slot_id,
                r.client_id,
                r.status,
                r.created_at,
                ts.start_time   AS slot_start_time,
                ts.end_time     AS slot_end_time,
                u.name          AS counselor_name,
                j.id            AS journal_id,
                rv.id           AS review_id
            FROM reservations r
            JOIN time_slots ts ON r.slot_id = ts.id
            JOIN users u       ON ts.counselor_id = u.id
            LEFT JOIN journals j  ON j.reservation_id = r.id
            LEFT JOIN reviews  rv ON rv.reservation_id = r.id
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
    """상담사: 내 슬롯의 예약 목록 조회"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT
                r.id,
                r.slot_id,
                r.client_id,
                r.status,
                r.created_at,
                ts.start_time   AS slot_start_time,
                ts.end_time     AS slot_end_time,
                u.name          AS client_name,
                j.id            AS journal_id
            FROM reservations r
            JOIN time_slots ts ON r.slot_id = ts.id
            JOIN users u       ON r.client_id = u.id
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
        text("""
            SELECT r.id, r.client_id, r.status, r.slot_id
            FROM reservations r
            WHERE r.id = :reservation_id
        """),
        {"reservation_id": reservation_id},
    )
    reservation = result.fetchone()

    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예약을 찾을 수 없습니다")

    if str(reservation.client_id) != current_user["id"] and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인 예약만 취소할 수 있습니다")

    if reservation.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 취소된 예약입니다")

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