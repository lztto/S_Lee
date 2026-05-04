from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_role, Role

router = APIRouter(prefix="/reservations", tags=["reservations"])


# ─── Pydantic 스키마 ───

class ReservationCreate(BaseModel):
    slot_id: str


# ─── 예약 생성 (핵심 - 동시성 제어) ───
@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_reservation(
    data: ReservationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # client만 예약 가능
    require_role(current_user, [Role.CLIENT])

    # ─── 핵심: SELECT FOR UPDATE ───
    # 슬롯 조회 + 잠금 (다른 요청은 이 트랜잭션이 끝날 때까지 대기)
    result = await db.execute(
        text("""
            SELECT id, counselor_id, start_time, end_time, is_available
            FROM time_slots
            WHERE id = :slot_id
            FOR UPDATE
        """),
        {"slot_id": data.slot_id}
    )
    slot = result.fetchone()

    # 슬롯 존재 확인
    if not slot:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="슬롯을 찾을 수 없습니다"
        )

    # 이미 예약된 슬롯 확인
    if not slot.is_available:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="이미 예약된 슬롯입니다"
        )

    # 본인 슬롯은 예약 불가
    if str(slot.counselor_id) == current_user["id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="본인의 슬롯은 예약할 수 없습니다"
        )

    # 슬롯 예약 불가 처리
    await db.execute(
        text("UPDATE time_slots SET is_available = false WHERE id = :slot_id"),
        {"slot_id": data.slot_id}
    )

    # 예약 생성
    result = await db.execute(
        text("""
            INSERT INTO reservations (slot_id, client_id)
            VALUES (:slot_id, :client_id)
            RETURNING id, slot_id, client_id, status, created_at
        """),
        {"slot_id": data.slot_id, "client_id": current_user["id"]}
    )
    reservation = result.fetchone()

    return {
        "data": {
            "id": str(reservation.id),
            "slot_id": str(reservation.slot_id),
            "client_id": str(reservation.client_id),
            "status": reservation.status,
            "start_time": str(slot.start_time),
            "end_time": str(slot.end_time),
            "created_at": str(reservation.created_at),
        },
        "message": "예약이 완료되었습니다"
    }


# ─── 내 예약 목록 조회 (고객) ───
@router.get("/me")
async def get_my_reservations(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        text("""
            SELECT
                r.id, r.status, r.created_at,
                ts.start_time, ts.end_time,
                u.name as counselor_name,
                u.email as counselor_email
            FROM reservations r
            JOIN time_slots ts ON ts.id = r.slot_id
            JOIN users u ON u.id = ts.counselor_id
            WHERE r.client_id = :client_id
            ORDER BY ts.start_time DESC
        """),
        {"client_id": current_user["id"]}
    )
    reservations = result.fetchall()

    return {
        "data": [
            {
                "id": str(r.id),
                "status": r.status,
                "start_time": str(r.start_time),
                "end_time": str(r.end_time),
                "counselor_name": r.counselor_name,
                "counselor_email": r.counselor_email,
                "created_at": str(r.created_at),
            }
            for r in reservations
        ],
        "message": "success",
        "total": len(reservations)
    }


# ─── 예약 취소 ───
@router.patch("/{reservation_id}/cancel")
async def cancel_reservation(
    reservation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 예약 조회
    result = await db.execute(
        text("""
            SELECT r.id, r.client_id, r.slot_id, r.status
            FROM reservations r
            WHERE r.id = :reservation_id
            FOR UPDATE
        """),
        {"reservation_id": reservation_id}
    )
    reservation = result.fetchone()

    if not reservation:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="예약을 찾을 수 없습니다")

    if str(reservation.client_id) != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인 예약만 취소할 수 있습니다")

    if reservation.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="이미 취소된 예약입니다")

    await db.execute(
        text("UPDATE reservations SET status = 'cancelled' WHERE id = :id"),
        {"id": reservation_id}
    )
    await db.execute(
        text("UPDATE time_slots SET is_available = true WHERE id = :slot_id"),
        {"slot_id": str(reservation.slot_id)}
    )

    return {"data": None, "message": "예약이 취소되었습니다"}


# ─── 상담사의 예약 목록 조회 ───
@router.get("/counselor/me")
async def get_counselor_reservations(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT
                r.id, r.status, r.created_at,
                ts.start_time, ts.end_time,
                u.name as client_name,
                u.email as client_email,
                u.phone as client_phone
            FROM reservations r
            JOIN time_slots ts ON ts.id = r.slot_id
            JOIN users u ON u.id = r.client_id
            WHERE ts.counselor_id = :counselor_id
            ORDER BY ts.start_time DESC
        """),
        {"counselor_id": current_user["id"]}
    )
    reservations = result.fetchall()

    return {
        "data": [
            {
                "id": str(r.id),
                "status": r.status,
                "start_time": str(r.start_time),
                "end_time": str(r.end_time),
                "client_name": r.client_name,
                "client_email": r.client_email,
                "client_phone": r.client_phone,
                "created_at": str(r.created_at),
            }
            for r in reservations
        ],
        "message": "success",
        "total": len(reservations)
    }