# app/api/v1/reviews.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, Field

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_role, Role

router = APIRouter(prefix="/reviews", tags=["reviews"])


class ReviewCreate(BaseModel):
    reservation_id: str
    rating: int = Field(..., ge=1, le=5)
    content: str = Field(..., min_length=1, max_length=1000)


# ─────────────────────────────────────────────────────────
# 리뷰 작성 (내담자)
# ─────────────────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_review(
    data: ReviewCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내담자: 완료된 예약에 리뷰 작성"""
    require_role(current_user, [Role.CLIENT, Role.ADMIN])

    # 예약 확인 — 본인 예약인지, 완료 상태인지
    result = await db.execute(
        text("""
            SELECT r.id, r.client_id, r.status
            FROM reservations r
            WHERE r.id = :reservation_id
        """),
        {"reservation_id": data.reservation_id},
    )
    reservation = result.fetchone()

    if not reservation:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다")
    if str(reservation.client_id) != current_user["id"]:
        raise HTTPException(status_code=403, detail="본인 예약에만 리뷰를 작성할 수 있습니다")
    if reservation.status != "confirmed":
        raise HTTPException(status_code=400, detail="완료된 예약에만 리뷰를 작성할 수 있습니다")

    # 이미 리뷰가 있는지 확인
    existing = await db.execute(
        text("SELECT id FROM reviews WHERE reservation_id = :reservation_id"),
        {"reservation_id": data.reservation_id},
    )
    if existing.fetchone():
        raise HTTPException(status_code=409, detail="이미 리뷰를 작성했습니다")

    # 리뷰 생성
    res = await db.execute(
        text("""
            INSERT INTO reviews (reservation_id, client_id, counselor_id, rating, content)
            VALUES (
                :reservation_id,
                :client_id,
                (SELECT ts.counselor_id FROM reservations r JOIN time_slots ts ON r.slot_id = ts.id WHERE r.id = :reservation_id),
                :rating,
                :content
            )
            RETURNING id, reservation_id, client_id, rating, content, created_at
        """),
        {
            "reservation_id": data.reservation_id,
            "client_id": current_user["id"],
            "rating": data.rating,
            "content": data.content,
        },
    )


# ─────────────────────────────────────────────────────────
# 상담사별 리뷰 목록 (공개)
# ─────────────────────────────────────────────────────────
@router.get("/counselor/{counselor_id}")
async def get_counselor_reviews(
    counselor_id: str,
    db: AsyncSession = Depends(get_db),
):
    """공개: 상담사별 리뷰 목록 + 평균 평점"""
    result = await db.execute(
        text("""
            SELECT rv.id, rv.rating, rv.content, rv.created_at,
                   u.name AS client_name
            FROM reviews rv
            JOIN reservations r ON rv.reservation_id = r.id
            JOIN time_slots ts ON r.slot_id = ts.id
            JOIN users u ON rv.client_id = u.id
            WHERE ts.counselor_id = :counselor_id
            ORDER BY rv.created_at DESC
        """),
        {"counselor_id": counselor_id},
    )
    rows = result.fetchall()
    items = [
        {
            "id": str(row.id),
            "rating": row.rating,
            "content": row.content,
            "client_name": row.client_name,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]

    avg_rating = round(sum(i["rating"] for i in items) / len(items), 1) if items else 0

    return {
        "data": items,
        "avg_rating": avg_rating,
        "total": len(items),
        "message": "success",
    }


# ─────────────────────────────────────────────────────────
# 내 리뷰 단건 조회 (예약 ID 기준)
# ─────────────────────────────────────────────────────────
@router.get("/me/{reservation_id}")
async def get_my_review(
    reservation_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """내담자: 특정 예약의 내 리뷰 조회"""
    require_role(current_user, [Role.CLIENT, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT id, reservation_id, client_id, rating, content, created_at
            FROM reviews
            WHERE reservation_id = :reservation_id
              AND client_id = :client_id
        """),
        {"reservation_id": reservation_id, "client_id": current_user["id"]},
    )
    review = result.fetchone()

    if not review:
        raise HTTPException(status_code=404, detail="리뷰를 찾을 수 없습니다")

    return {
        "data": {
            "id": str(review.id),
            "reservation_id": str(review.reservation_id),
            "client_id": str(review.client_id),
            "rating": review.rating,
            "content": review.content,
            "created_at": review.created_at.isoformat(),
        },
        "message": "success",
    }