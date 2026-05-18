"""JWT and password helpers."""
from datetime import datetime, timedelta
from typing import Optional
 
from jose import JWTError, jwt
from passlib.context import CryptContext
 
from app.core.config import settings
 
# ─── 비밀번호 해싱 설정 ───
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
 
 
# ─── 비밀번호 관련 함수 ───
 
def hash_password(password: str) -> str:
    """평문 비밀번호를 bcrypt로 해싱"""
    return pwd_context.hash(password)
 
 
def verify_password(plain_password: str, hashed_password: str) -> bool:
    """입력한 비밀번호와 해시된 비밀번호 비교"""
    return pwd_context.verify(plain_password, hashed_password)
 
 
# ─── JWT 토큰 관련 함수 ───
 
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    JWT 액세스 토큰 생성
    
    data: 토큰에 담을 정보 (user_id, role 등)
    expires_delta: 만료 시간 (없으면 설정값 사용)
    """
    to_encode = data.copy()
 
    # 만료 시간 설정
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(
            minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES
        )
 
    to_encode.update({"exp": expire})
 
    # JWT 토큰 생성
    encoded_jwt = jwt.encode(
        to_encode,
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM
    )
 
    return encoded_jwt
 
 
def decode_access_token(token: str) -> Optional[dict]:
    """
    JWT 토큰 디코딩 및 검증
    
    유효한 토큰이면 payload 반환
    유효하지 않으면 None 반환
    """
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except JWTError:
        return None