"""Backend entrypoint."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import settings

UPLOAD_ROOT = Path(__file__).resolve().parent / "static" / "uploads"
UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)


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
        "https://s-lee-frontend.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_ROOT), name="uploads")

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
