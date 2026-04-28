# CLAUDE.md — DevTriple 프로젝트 AI 공통 규칙

> AI에게 코드 작성을 요청하기 전에 이 파일 전체를 컨텍스트로 제공하세요.
> "아래 규칙과 코드를 반드시 참고해서 작성해줘" 와 함께 붙여넣으면 됩니다.

---

## 프로젝트 개요

- **프로젝트명**: 프라이빗 심리/코칭 예약 플랫폼
- **백엔드**: FastAPI (Python), PostgreSQL (Supabase), Raw SQL
- **프론트엔드**: React + TypeScript, Axios, Zustand
- **배포**: Render.com (API), Vercel (Web), Supabase (DB)

---

## DB 테이블 구조 (변경 시 팀 전체 동의 필요)

```sql
users         → 유저 (admin / counselor / client)
time_slots    → 상담사가 등록한 예약 가능 시간
reservations  → 내담자가 한 예약 (UNIQUE로 중복 방지)
journals      → 상담 일지 (비밀보장)
reviews       → 리뷰
```

### 테이블 관계
```
users ──< time_slots       (상담사 1명이 여러 슬롯)
time_slots ──< reservations (슬롯 1개에 예약 1개)
reservations ──< journals   (예약 1개에 일지 1개)
reservations ──< reviews    (예약 1개에 리뷰 1개)
```

---

## 공통 타입 정의 (변경 시 팀 전체 동의 필요)

```typescript
// frontend/src/types/index.ts

export type Role = 'admin' | 'counselor' | 'client'

export interface User {
  id: string
  email: string
  name: string
  role: Role
  created_at: string
}

export interface Slot {
  id: string
  counselor_id: string
  start_time: string   // ISO 8601
  end_time: string     // ISO 8601
  is_available: boolean
}

export interface Reservation {
  id: string
  slot_id: string
  client_id: string
  status: 'confirmed' | 'cancelled'
  created_at: string
}

export interface Journal {
  id: string
  reservation_id: string
  counselor_id: string
  content: string
  is_private: boolean
  created_at: string
}

export interface Review {
  id: string
  reservation_id: string
  client_id: string
  counselor_id: string
  rating: number
  content: string
  created_at: string
}

export interface ApiResponse<T> {
  data: T
  message: string
}
```

---

## 이미 완성된 파일 (수정 금지)

### backend/app/core/config.py
```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
    FRONTEND_URL: str = "http://localhost:5173"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

### backend/app/db/session.py
```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### backend/app/core/security.py
```python
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_access_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
```

### backend/app/core/permissions.py
```python
from fastapi import HTTPException, status

class Role:
    ADMIN = "admin"
    COUNSELOR = "counselor"
    CLIENT = "client"

def require_role(current_user: dict, allowed_roles: list[str]):
    if current_user["role"] not in allowed_roles:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="접근 권한이 없습니다")

def require_admin(current_user: dict):
    require_role(current_user, [Role.ADMIN])

def require_counselor(current_user: dict):
    require_role(current_user, [Role.COUNSELOR, Role.ADMIN])

def require_owner_or_admin(current_user: dict, resource_user_id: str):
    if current_user["id"] != resource_user_id and current_user["role"] != Role.ADMIN:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="본인 또는 관리자만 접근할 수 있습니다")

def require_journal_access(current_user: dict, counselor_id: str, client_id: str):
    is_admin = current_user["role"] == Role.ADMIN
    is_counselor = current_user["id"] == counselor_id
    is_client = current_user["id"] == client_id
    if not (is_admin or is_counselor or is_client):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="상담 일지에 접근할 권한이 없습니다")
```

### backend/app/api/v1/dependencies.py
```python
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.core.security import decode_access_token

bearer_scheme = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db)
) -> dict:
    payload = decode_access_token(credentials.credentials)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 토큰입니다")

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="토큰에 유저 정보가 없습니다")

    result = await db.execute(
        text("SELECT id, email, name, role, is_active FROM users WHERE id = :id"),
        {"id": user_id}
    )
    user = result.fetchone()

    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="존재하지 않는 유저입니다")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="비활성화된 계정입니다")

    return {"id": str(user.id), "email": user.email, "name": user.name, "role": user.role}
```

---

## 백엔드 규칙

### API 응답 형식 (반드시 이 구조 사용)
```python
# 성공
return {"data": result, "message": "success"}

# 목록
return {"data": items, "message": "success", "total": len(items)}

# 실패
raise HTTPException(status_code=404, detail="찾을 수 없습니다")
```

### DB 쿼리 (Raw SQL만 사용)
```python
# 올바른 방식
result = await db.execute(
    text("SELECT * FROM time_slots WHERE counselor_id = :id"),
    {"id": counselor_id}
)
rows = result.fetchall()

# 동시성 제어 (예약 생성 시 반드시 사용)
async with db.begin():
    result = await db.execute(
        text("SELECT * FROM time_slots WHERE id = :id FOR UPDATE"),
        {"id": slot_id}
    )
```

### 인증 (반드시 Depends 방식 사용)
```python
@router.post("/reservations")
async def create_reservation(
    data: ReservationCreate,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    ...
```

### 라우터 기본 구조
```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.session import get_db
from app.api.v1.dependencies import get_current_user

router = APIRouter(prefix="/기능명", tags=["기능명"])

@router.get("/")
async def get_items(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(text("SELECT * FROM 테이블명"))
    items = result.fetchall()
    return {"data": [dict(row._mapping) for row in items], "message": "success"}
```

---

## 디자인 가이드 (모든 페이지 반드시 준수)

> 팀원들이 각자 페이지를 만들 때 아래 색상과 폰트를 반드시 사용해야 합니다.
> 이 가이드를 따르면 모든 페이지가 자연스럽게 같은 분위기를 유지합니다.

### 컬러 팔레트
```
배경색         #FAF8F5   (크림 베이지 — body, 페이지 전체 배경)
카드/서피스    #FFFFFF   (카드, 모달, 입력창 배경)
포인트 색      #C4A882   (강조 텍스트, 아이콘, 뱃지, 구분선 포인트)
기본 텍스트    #2C2420   (제목, 버튼, 주요 텍스트)
보조 텍스트    #9E8E84   (설명, placeholder, 부제목)
구분선/테두리  #EDE8E0   (border, divider)
버튼 배경      #2C2420   (primary 버튼)
버튼 텍스트    #FAF8F5   (primary 버튼 텍스트)
뱃지 배경      #F5F0E8   (상태 뱃지 배경)
```

### 폰트
```
제목 폰트   Playfair Display  (h1, h2, 카드 이름, 로고)
본문 폰트   DM Sans           (나머지 모든 텍스트)

Google Fonts 로드 방법:
import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;1,400&family=DM+Sans:wght@300;400;500&display=swap')
```

### 컴포넌트 스타일 가이드
```
카드
  border-radius: 16px (rounded-2xl)
  border: 1px solid #EDE8E0
  padding: 24~28px
  hover: translateY(-4~6px) + box-shadow 강조

버튼 (Primary)
  background: #2C2420
  color: #FAF8F5
  border-radius: 100px (rounded-full)
  padding: 8px 16px
  hover: background #C4A882

버튼 (Outline)
  border: 1px solid #DDD5C8
  color: #6B5B4E
  border-radius: 100px
  hover: border-color #2C2420

입력창
  background: #FFFFFF
  border: 1px solid #EDE8E0
  border-radius: 12px
  focus: border-color #C4A882

네비게이션
  background: rgba(250,248,245,0.92) + backdrop-filter blur
  border-bottom: 1px solid #EDE8E0
  height: 64px
  padding: 0 40px
```

### Tailwind 자주 쓰는 클래스 조합
```tsx
// 페이지 전체 배경
<div className="min-h-screen" style={{ background: '#FAF8F5' }}>

// 카드
<div className="rounded-2xl p-7 border transition-all hover:-translate-y-1"
  style={{ background: '#fff', border: '1px solid #EDE8E0' }}>

// Primary 버튼
<button className="px-4 py-2 rounded-full text-sm font-medium transition-all"
  style={{ background: '#2C2420', color: '#FAF8F5' }}>

// Outline 버튼
<button className="px-4 py-2 rounded-full text-sm font-medium transition-all"
  style={{ border: '1px solid #DDD5C8', color: '#6B5B4E', background: 'transparent' }}>

// 포인트 텍스트
<span style={{ color: '#C4A882' }}>

// 보조 텍스트
<p className="text-sm font-light" style={{ color: '#9E8E84' }}>

// 구분선
<div className="h-px" style={{ background: '#EDE8E0' }} />

// 섹션 레이블
<p className="text-xs font-medium tracking-widest uppercase" style={{ color: '#C4A882' }}>

// 제목 폰트
<h1 style={{ fontFamily: "'Playfair Display', serif", color: '#2C2420', fontWeight: 400 }}>
```

### AI에게 페이지 만들어달라고 할 때 추가할 내용
```
디자인 규칙:
- 배경색 #FAF8F5, 카드 배경 #FFFFFF
- 포인트 색 #C4A882, 기본 텍스트 #2C2420, 보조 텍스트 #9E8E84
- 구분선/테두리 #EDE8E0
- 제목은 Playfair Display, 본문은 DM Sans
- 버튼은 rounded-full, 카드는 rounded-2xl
- MainPage.tsx 디자인 스타일과 동일하게 맞춰줘
```

---

## 프론트엔드 규칙

### API 호출 (services/ 함수만 사용)
```typescript
// services/api.ts - Axios 인스턴스
import axios from 'axios'
import { useAuthStore } from '@/store/auth'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default api
```

```typescript
// 컴포넌트에서 직접 axios 호출 금지 ❌
// services/ 함수만 사용 ✅
import { getSlots } from '@/services/slotService'
```

### 전역 상태 (Zustand만 사용)
```typescript
// store/auth.ts
import { create } from 'zustand'
import { User } from '@/types'

interface AuthStore {
  user: User | null
  token: string | null
  setAuth: (user: User, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token }),
  logout: () => set({ user: null, token: null }),
}))
```

---

## Git 규칙

```
브랜치:   feature/이름-기능명
커밋:     feat: / fix: / refactor: / chore:
PR:       develop 브랜치로만, 팀원 1명 리뷰 후 머지
```

---

## PR 전 AI 코드 리뷰 체크리스트

PR 올리기 전에 아래 프롬프트로 AI한테 검토 요청하세요.

```
이 코드를 CLAUDE.md 규칙에 맞게 검토해줘.

확인 항목:
1. API 응답이 {"data": ..., "message": ...} 구조인가?
2. DB 쿼리가 Raw SQL (text()) 방식인가?
3. 인증이 Depends(get_current_user)로 처리되는가?
4. 예약 생성 시 SELECT FOR UPDATE 트랜잭션 사용했는가?
5. 새 타입을 types/index.ts 외부에 정의하지 않았는가?
6. 컴포넌트 안에서 직접 axios 호출하지 않았는가?
7. 하드코딩된 URL이 없는가?

[코드 붙여넣기]
```

---

## 환경변수 (.env 기준)

```bash
# backend/.env
DATABASE_URL=postgresql+asyncpg://postgres.otmxmnztgfokrnaujyau:[비밀번호]@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres
SECRET_KEY=dev-secret-key-change-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
APP_ENV=development
APP_HOST=0.0.0.0
APP_PORT=8000
FRONTEND_URL=http://localhost:5173

# frontend/.env
VITE_API_URL=http://localhost:8000/api/v1
```
