from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.api.v1.dependencies import get_current_user
from app.core.permissions import require_admin
from pydantic import BaseModel
from typing import Literal

router = APIRouter(prefix="/admin", tags=["admin"])


# ── Pydantic 스키마 ────────────────────────────────────────

class UserStatusUpdate(BaseModel):
    is_active: bool

class UserRoleUpdate(BaseModel):
    role: Literal["admin", "counselor", "client"]


# ── 전체 유저 목록 ─────────────────────────────────────────

@router.get("/users")
async def get_all_users(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)

    result = await db.execute(
        text("""
            SELECT id, email, name, role, is_active, created_at
            FROM users
            ORDER BY created_at DESC
        """)
    )
    users = result.fetchall()
    return {
        "data": [dict(row._mapping) for row in users],
        "message": "success",
        "total": len(users),
    }


# ── 유저 활성/비활성 토글 ──────────────────────────────────

@router.patch("/users/{user_id}")
async def update_user_status(
    user_id: str,
    body: UserStatusUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)

    result = await db.execute(
        text("SELECT id FROM users WHERE id = :id"),
        {"id": user_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="유저를 찾을 수 없습니다")

    await db.execute(
        text("UPDATE users SET is_active = :is_active WHERE id = :id"),
        {"is_active": body.is_active, "id": user_id},
    )
    await db.commit()

    result = await db.execute(
        text("SELECT id, email, name, role, is_active, created_at FROM users WHERE id = :id"),
        {"id": user_id},
    )
    return {"data": dict(result.fetchone()._mapping), "message": "success"}


# ── 역할 변경 ─────────────────────────────────────────────

@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: str,
    body: UserRoleUpdate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)

    # 자기 자신 역할 변경 불가
    if current_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="본인의 역할은 변경할 수 없습니다"
        )

    result = await db.execute(
        text("SELECT id FROM users WHERE id = :id"),
        {"id": user_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="유저를 찾을 수 없습니다")

    await db.execute(
        text("UPDATE users SET role = :role WHERE id = :id"),
        {"role": body.role, "id": user_id},
    )
    await db.commit()

    result = await db.execute(
        text("SELECT id, email, name, role, is_active, created_at FROM users WHERE id = :id"),
        {"id": user_id},
    )
    return {"data": dict(result.fetchone()._mapping), "message": "역할이 변경되었습니다"}


# ── 유저 삭제 ─────────────────────────────────────────────

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)

    if current_user["id"] == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="본인 계정은 삭제할 수 없습니다"
        )

    result = await db.execute(
        text("SELECT id FROM users WHERE id = :id"),
        {"id": user_id},
    )
    if not result.fetchone():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="유저를 찾을 수 없습니다")

    await db.execute(
        text("DELETE FROM users WHERE id = :id"),
        {"id": user_id},
    )
    await db.commit()
    return {"data": None, "message": "삭제되었습니다"}

@router.post("/users/{user_id}/logout")
async def force_logout_user(
    user_id: str,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    require_admin(current_user)

    # 해당 유저 토큰 무효화 — refresh_token 컬럼 초기화
    await db.execute(
        text("UPDATE users SET refresh_token = NULL WHERE id = :id"),
        {"id": user_id},
    )
    await db.commit()
    return {"data": None, "message": "강제 로그아웃 처리되었습니다"}