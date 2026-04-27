"""Database session setup."""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
 
# ─── 비동기 엔진 생성 ───
# Supabase PostgreSQL에 비동기로 연결
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.APP_ENV == "development",  # 개발 환경에서만 SQL 로그 출력
    pool_size=5,          # 기본 연결 풀 크기
    max_overflow=10,      # 최대 추가 연결 수
    pool_timeout=30,      # 연결 대기 시간 (초)
    pool_recycle=1800,    # 30분마다 연결 재생성 (Supabase 연결 끊김 방지)
)
 
# ─── 세션 팩토리 ───
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,  # 커밋 후에도 객체 속성 유지
    autocommit=False,
    autoflush=False,
)
 
# ─── DB 세션 의존성 주입 ───
# FastAPI의 Depends()에서 사용
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
 