"""Authorization rules."""
from fastapi import HTTPException, status
 
 
# ─── 역할 상수 정의 ───
class Role:
    ADMIN = "admin"
    COUNSELOR = "counselor"
    CLIENT = "client"
 
 
# ─── 역할 기반 접근 제어 함수 ───
 
def require_role(current_user: dict, allowed_roles: list[str]):
    """
    특정 역할만 접근 가능하도록 제한
    
    사용 예시:
    require_role(current_user, [Role.ADMIN])
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])
    """
    if current_user["role"] not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="접근 권한이 없습니다"
        )
 
 
def require_admin(current_user: dict):
    """관리자만 접근 가능"""
    require_role(current_user, [Role.ADMIN])
 
 
def require_counselor(current_user: dict):
    """상담사 이상만 접근 가능 (상담사, 관리자)"""
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])
 
 
def require_owner_or_admin(current_user: dict, resource_user_id: str):
    """
    본인 또는 관리자만 접근 가능
    
    사용 예시: 내 예약 조회, 내 일지 조회
    """
    if (current_user["id"] != resource_user_id and
            current_user["role"] != Role.ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="본인 또는 관리자만 접근할 수 있습니다"
        )
 
 
def require_journal_access(current_user: dict, counselor_id: str, client_id: str):
    """
    상담 일지 접근 권한 체크
    - 해당 상담사 본인
    - 해당 내담자 본인
    - 관리자
    만 열람 가능
    """
    is_admin = current_user["role"] == Role.ADMIN
    is_counselor = current_user["id"] == counselor_id
    is_client = current_user["id"] == client_id
 
    if not (is_admin or is_counselor or is_client):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="상담 일지에 접근할 권한이 없습니다"
        )