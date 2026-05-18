"""Shared API dependencies."""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
 
from app.db.session import get_db
from app.core.security import decode_access_token
 
# ─── JWT 토큰 추출 ───
bearer_scheme = HTTPBearer()
 
 
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> dict:
    """
    요청 헤더의 JWT 토큰을 검증하고 현재 유저 정보 반환
 
    모든 인증이 필요한 API에서 Depends(get_current_user)로 사용
    
    사용 예시:
    @router.get("/slots")
    async def get_slots(current_user = Depends(get_current_user)):
        ...
    """
    # 토큰 디코딩
    payload = decode_access_token(credentials.credentials)
 
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="유효하지 않은 토큰입니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
 
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="토큰에 유저 정보가 없습니다",
            headers={"WWW-Authenticate": "Bearer"},
        )
 
    # DB에서 유저 조회
    result = await db.execute(
        text("SELECT id, email, name, role, is_active FROM users WHERE id = :id"),
        {"id": user_id}
    )
    user = result.fetchone()
 
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="존재하지 않는 유저입니다",
        )
 
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다",
        )
 
    return {
        "id": str(user.id),
        "email": user.email,
        "name": user.name,
        "role": user.role,
    }