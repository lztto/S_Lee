# app/api/v1/journals.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional

from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_role, Role

router = APIRouter(prefix="/journals", tags=["journals"])


class JournalCreate(BaseModel):
    reservation_id: str
    title: str
    content: str
    assessment: Optional[str] = None
    next_steps: Optional[str] = None
    is_private: bool = False


class JournalUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    assessment: Optional[str] = None
    next_steps: Optional[str] = None
    is_private: Optional[bool] = None


# ─────────────────────────────────────────────────────────
# 일지 작성 (상담사)
# ─────────────────────────────────────────────────────────
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_journal(
    data: JournalCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    # 예약 확인 — 본인 슬롯인지 확인
    result = await db.execute(
        text("""
            SELECT r.id, r.client_id, ts.counselor_id
            FROM reservations r
            JOIN time_slots ts ON r.slot_id = ts.id
            WHERE r.id = :reservation_id
        """),
        {"reservation_id": data.reservation_id},
    )
    reservation = result.fetchone()

    if not reservation:
        raise HTTPException(status_code=404, detail="예약을 찾을 수 없습니다")
    if str(reservation.counselor_id) != current_user["id"] and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=403, detail="본인 상담 예약에만 일지를 작성할 수 있습니다")

    # 이미 일지가 있는지 확인
    existing = await db.execute(
        text("SELECT id FROM journals WHERE reservation_id = :reservation_id"),
        {"reservation_id": data.reservation_id},
    )
    if existing.fetchone():
        raise HTTPException(status_code=409, detail="이미 작성된 일지가 있습니다")

    # 일지 생성
    res = await db.execute(
        text("""
            INSERT INTO journals (reservation_id, counselor_id, client_id, title, content, assessment, next_steps, is_private)
            VALUES (:reservation_id, :counselor_id, :client_id, :title, :content, :assessment, :next_steps, :is_private)
            RETURNING id, reservation_id, counselor_id, client_id, title, content, assessment, next_steps, is_private, created_at
        """),
        {
            "reservation_id": data.reservation_id,
            "counselor_id": current_user["id"],
            "client_id": str(reservation.client_id),
            "title": data.title,
            "content": data.content,
            "assessment": data.assessment,
            "next_steps": data.next_steps,
            "is_private": data.is_private,
        },
    )
    journal = res.fetchone()
    await db.commit()

    return {
        "data": _serialize(journal),
        "message": "일지가 작성되었습니다",
    }


# ─────────────────────────────────────────────────────────
# 내 일지 목록 조회 (상담사 — 본인이 작성한 전체)
# ─────────────────────────────────────────────────────────
@router.get("/me")
async def get_my_journals(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("""
            SELECT j.id, j.reservation_id, j.title, j.content, j.assessment,
                   j.next_steps, j.is_private, j.created_at, j.updated_at,
                   u.name AS client_name,
                   ts.start_time AS slot_start_time
            FROM journals j
            JOIN users u ON j.client_id = u.id
            JOIN reservations r ON j.reservation_id = r.id
            JOIN time_slots ts ON r.slot_id = ts.id
            WHERE j.counselor_id = :counselor_id
            ORDER BY j.created_at DESC
        """),
        {"counselor_id": current_user["id"]},
    )
    rows = result.fetchall()
    items = [
        {
            "id": str(row.id),
            "reservation_id": str(row.reservation_id),
            "title": row.title,
            "content": row.content,
            "assessment": row.assessment,
            "next_steps": row.next_steps,
            "is_private": row.is_private,
            "created_at": row.created_at.isoformat(),
            "updated_at": row.updated_at.isoformat(),
            "client_name": row.client_name,
            "slot_start_time": row.slot_start_time.isoformat() if row.slot_start_time else None,
        }
        for row in rows
    ]
    return {"data": items, "total": len(items), "message": "success"}


# ─────────────────────────────────────────────────────────
# 일지 단건 조회
# ─────────────────────────────────────────────────────────
@router.get("/{journal_id}")
async def get_journal(
    journal_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("""
            SELECT j.id, j.reservation_id, j.counselor_id, j.client_id,
                   j.title, j.content, j.assessment, j.next_steps,
                   j.is_private, j.created_at, j.updated_at,
                   uc.name AS client_name,
                   us.name AS counselor_name,
                   ts.start_time AS slot_start_time
            FROM journals j
            JOIN users uc ON j.client_id = uc.id
            JOIN users us ON j.counselor_id = us.id
            JOIN reservations r ON j.reservation_id = r.id
            JOIN time_slots ts ON r.slot_id = ts.id
            WHERE j.id = :journal_id
        """),
        {"journal_id": journal_id},
    )
    journal = result.fetchone()

    if not journal:
        raise HTTPException(status_code=404, detail="일지를 찾을 수 없습니다")

    # 비공개 일지는 작성한 상담사만 조회 가능
    if journal.is_private and str(journal.counselor_id) != current_user["id"] and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=403, detail="비공개 일지입니다")

    m = dict(journal._mapping)
    return {
        "data": {
            "id": str(m["id"]),
            "reservation_id": str(m["reservation_id"]),
            "title": m["title"],
            "content": m["content"],
            "assessment": m["assessment"],
            "next_steps": m["next_steps"],
            "is_private": m["is_private"],
            "created_at": m["created_at"].isoformat(),
            "updated_at": m["updated_at"].isoformat(),
            "client_name": m["client_name"],
            "counselor_name": m["counselor_name"],
            "slot_start_time": m["slot_start_time"].isoformat() if m["slot_start_time"] else None,
        },
        "message": "success",
    }


# ─────────────────────────────────────────────────────────
# 일지 수정 (상담사)
# ─────────────────────────────────────────────────────────
@router.patch("/{journal_id}")
async def update_journal(
    journal_id: str,
    data: JournalUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

    result = await db.execute(
        text("SELECT id, counselor_id FROM journals WHERE id = :id"),
        {"id": journal_id},
    )
    journal = result.fetchone()

    if not journal:
        raise HTTPException(status_code=404, detail="일지를 찾을 수 없습니다")
    if str(journal.counselor_id) != current_user["id"] and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=403, detail="본인 일지만 수정할 수 있습니다")

    await db.execute(
        text("""
            UPDATE journals
            SET title      = COALESCE(:title, title),
                content    = COALESCE(:content, content),
                assessment = COALESCE(:assessment, assessment),
                next_steps = COALESCE(:next_steps, next_steps),
                is_private = COALESCE(:is_private, is_private),
                updated_at = NOW()
            WHERE id = :id
        """),
        {
            "id": journal_id,
            "title": data.title,
            "content": data.content,
            "assessment": data.assessment,
            "next_steps": data.next_steps,
            "is_private": data.is_private,
        },
    )
    await db.commit()
    return {"data": None, "message": "일지가 수정되었습니다"}


# ── 직렬화 헬퍼 ──
def _serialize(row) -> dict:
    m = dict(row._mapping)
    return {
        "id": str(m["id"]),
        "reservation_id": str(m["reservation_id"]),
        "title": m["title"],
        "content": m["content"],
        "assessment": m.get("assessment"),
        "next_steps": m.get("next_steps"),
        "is_private": m["is_private"],
        "created_at": m["created_at"].isoformat(),
    }