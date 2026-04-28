"""Backend entrypoint."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
 
from app.core.config import settings
 
# ─── FastAPI 앱 생성 ───
app = FastAPI(
    title="프라이빗 심리/코칭 예약 플랫폼",
    description="DevTriple 팀 - 상담사 예약 및 일지 관리 API",
    version="1.0.0",
    docs_url="/docs",      # Swagger UI 주소
    redoc_url="/redoc",    # ReDoc 주소
)
 
# ─── CORS 설정 ───
# 프론트엔드(React)에서 API 호출 허용
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,       # 개발: http://localhost:5173
        "https://vercel.app",        # 배포: Vercel 도메인
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 

# ─── 라우터 등록 ───
from app.api.v1 import counselors
app.include_router(counselors.router, prefix="/api/v1")
 
 
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