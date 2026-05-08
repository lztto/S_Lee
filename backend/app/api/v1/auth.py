from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from datetime import date

from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


# ─── Pydantic 스키마 ───

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "client"  # client / counselor
    phone: str | None = None
    birth_date: str | None = None  # "YYYY-MM-DD" 형식
    gender: str | None = None      # "male" / "female" / "other"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


# ─── 회원가입 ───
@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):

    # role 유효성 검사 (admin은 회원가입으로 생성 불가)
    if data.role not in ["client", "counselor"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="역할은 client 또는 counselor만 가능합니다"
        )

    # 이메일 중복 확인
    result = await db.execute(
        text("SELECT id FROM users WHERE email = :email"),
        {"email": data.email}
    )
    if result.fetchone():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 이메일입니다"
        )

    # 비밀번호 해싱 후 저장
    hashed = hash_password(data.password)

    # 생년월일 문자열 → date 객체 변환
    birth_date_obj = None
    if data.birth_date:
        birth_date_obj = date.fromisoformat(data.birth_date)

    await db.execute(
        text("""
            INSERT INTO users (email, name, hashed_password, role, phone, birth_date, gender)
            VALUES (:email, :name, :hashed_password, :role, :phone, :birth_date, :gender)
        """),
        {
            "email": data.email,
            "name": data.name,
            "hashed_password": hashed,
            "role": data.role,
            "phone": data.phone,
            "birth_date": birth_date_obj,
            "gender": data.gender,
        }
    )

    return {
        "data": {"email": data.email, "name": data.name, "role": data.role},
        "message": "회원가입이 완료되었습니다"
    }


# ─── 로그인 ───
@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):

    # 유저 조회
    result = await db.execute(
        text("SELECT id, email, name, role, hashed_password, is_active FROM users WHERE email = :email"),
        {"email": data.email}
    )
    user = result.fetchone()

    # 유저 없거나 비밀번호 틀리면 동일한 에러 (보안상 구분 안 함)
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다"
        )

    # 비활성화 계정 확인
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다. 관리자에게 문의하세요"
        )

    # JWT 토큰 발급
    token = create_access_token(
        data={"sub": str(user.id), "role": user.role}
    )

    return {
        "data": {
            "access_token": token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "name": user.name,
                "role": user.role,
            }
        },
        "message": "로그인 성공"
    }

@router.get("/me")
async def get_me(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        text("SELECT is_active FROM users WHERE id = :id"),
        {"id": current_user["id"]}
    )
    user = result.fetchone()

    # is_active가 false일 때만 403 반환
    if user and not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다"
        )

    return {
        "data": {
            **current_user,
            "is_active": user.is_active if user else True,
        },
        "message": "success"
    }