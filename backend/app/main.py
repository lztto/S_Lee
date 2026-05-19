"""Backend entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings


# ─── FastAPI 앱 생성 ───
app = FastAPI(
    title="S.LEE — Secret Counseling",
    description="S.LEE Secret Counseling API",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# ─── CORS 설정 ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",   # ← 추가
        "http://localhost:3000",   # ← 추가 (혹시 몰라서)
        "https://vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 라우터 등록 ───
from app.api.v1 import auth, counselors, reservations, slots, admin, reviews, journals

app.include_router(auth.router, prefix="/api/v1")
app.include_router(counselors.router, prefix="/api/v1")
app.include_router(reservations.router, prefix="/api/v1")
app.include_router(slots.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")  
app.include_router(journals.router, prefix="/api/v1")


# ─── 헬스체크 ───
@app.get("/")
async def health_check():
    return {
        "data": {
            "status": "healthy",
            "service": "프라이빗 심리/코칭 예약 플랫폼",
            "version": "1.0.0",
            "environment": settings.APP_ENV,
        },
        "message": "success"
    }