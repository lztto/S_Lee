from fastapi import APIRouter, Depends, HTTPException, status
from pathlib import Path
from uuid import uuid4

from fastapi import UploadFile, File, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from pydantic import BaseModel, EmailStr
from datetime import date

from app.db.session import get_db
from app.core.security import hash_password, verify_password, create_access_token
from app.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

PROFILE_UPLOAD_DIR = Path(__file__).resolve().parents[2] / "static" / "uploads" / "profiles"
PROFILE_UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
MAX_PROFILE_IMAGE_SIZE = 2 * 1024 * 1024
ALLOWED_PROFILE_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}


# ─── Pydantic 스키마 ───

class SignupRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str | None = None
    birth_date: str | None = None
    gender: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ProfileUpdateRequest(BaseModel):
    profile_image: str | None = None
    bio: str | None = None


# ─── 회원가입 (무조건 client로 가입) ───
@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(data: SignupRequest, db: AsyncSession = Depends(get_db)):

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

    # 비밀번호 해싱
    hashed = hash_password(data.password)

    # 생년월일 변환
    birth_date_obj = None
    if data.birth_date:
        birth_date_obj = date.fromisoformat(data.birth_date)

    # 무조건 client로 저장
    await db.execute(
        text("""
            INSERT INTO users (email, name, hashed_password, role, phone, birth_date, gender)
            VALUES (:email, :name, :hashed_password, 'client', :phone, :birth_date, :gender)
        """),
        {
            "email": data.email,
            "name": data.name,
            "hashed_password": hashed,
            "phone": data.phone,
            "birth_date": birth_date_obj,
            "gender": data.gender,
        }
    )

    return {
        "data": {"email": data.email, "name": data.name, "role": "client"},
        "message": "회원가입이 완료되었습니다"
    }


# ─── 로그인 ───
@router.post("/login")
async def login(data: LoginRequest, db: AsyncSession = Depends(get_db)):

    result = await db.execute(
        text("SELECT id, email, name, role, hashed_password, is_active FROM users WHERE email = :email"),
        {"email": data.email}
    )
    user = result.fetchone()

    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다. 관리자에게 문의하세요"
        )

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


# ─── 내 정보 조회 ───
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


# ─── 프로필 수정 (상담사 전용) ───
@router.patch("/profile")
async def update_profile(
    data: ProfileUpdateRequest,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # 상담사만 프로필 수정 가능
    if current_user["role"] not in ["counselor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="상담사만 프로필을 수정할 수 있습니다"
        )

    await db.execute(
        text("""
            UPDATE users
            SET
                profile_image = COALESCE(:profile_image, profile_image),
                bio = COALESCE(:bio, bio)
            WHERE id = :id
        """),
        {
            "profile_image": data.profile_image,
            "bio": data.bio,
            "id": current_user["id"],
        }
    )

    # 업데이트된 정보 반환
    result = await db.execute(
        text("SELECT id, email, name, role, profile_image, bio FROM users WHERE id = :id"),
        {"id": current_user["id"]}
    )
    updated = result.fetchone()

    return {
        "data": {
            "id": str(updated.id),
            "email": updated.email,
            "name": updated.name,
            "role": updated.role,
            "profile_image": updated.profile_image,
            "bio": updated.bio,
        },
        "message": "프로필이 수정되었습니다"
    }


@router.patch("/profile/upload")
async def update_profile_with_upload(
    request: Request,
    profile_image: UploadFile | None = File(default=None),
    bio: str | None = Form(default=None),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user["role"] not in ["counselor", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="상담사만 프로필을 수정할 수 있습니다"
        )

    image_url = None
    if profile_image:
        if profile_image.content_type not in ALLOWED_PROFILE_IMAGE_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="이미지 파일만 업로드할 수 있습니다"
            )

        content = await profile_image.read()
        if len(content) > MAX_PROFILE_IMAGE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="프로필 이미지는 2MB 이하만 업로드할 수 있습니다"
            )

        ext_map = {
            "image/jpeg": ".jpg",
            "image/png": ".png",
            "image/webp": ".webp",
            "image/gif": ".gif",
        }
        file_name = f"{current_user['id']}_{uuid4().hex}{ext_map[profile_image.content_type]}"
        file_path = PROFILE_UPLOAD_DIR / file_name
        file_path.write_bytes(content)
        image_url = str(request.base_url).rstrip("/") + f"/uploads/profiles/{file_name}"

    await db.execute(
        text("""
            UPDATE users
            SET
                profile_image = COALESCE(:profile_image, profile_image),
                bio = COALESCE(:bio, bio)
            WHERE id = :id
        """),
        {
            "profile_image": image_url,
            "bio": bio,
            "id": current_user["id"],
        }
    )

    result = await db.execute(
        text("SELECT id, email, name, role, profile_image, bio FROM users WHERE id = :id"),
        {"id": current_user["id"]}
    )
    updated = result.fetchone()

    return {
        "data": {
            "id": str(updated.id),
            "email": updated.email,
            "name": updated.name,
            "role": updated.role,
            "profile_image": updated.profile_image,
            "bio": updated.bio,
        },
        "message": "프로필이 수정되었습니다"
    }
