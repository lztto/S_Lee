"""Application configuration."""
from pydantic_settings import BaseSettings
from functools import lru_cache
 
 
class Settings(BaseSettings):
    # ─── 데이터베이스 ───
    DATABASE_URL: str
 
    # ─── JWT 인증 ───
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
 
    # ─── 서버 설정 ───
    APP_ENV: str = "development"
    APP_HOST: str = "0.0.0.0"
    APP_PORT: int = 8000
 
    # ─── CORS ───
    FRONTEND_URL: str = "http://localhost:5173"
 
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
 
 
# ─── 싱글톤 패턴 ───
# 앱 전체에서 settings 객체를 하나만 생성해서 재사용
@lru_cache()
def get_settings() -> Settings:
    return Settings()
 
 
settings = get_settings()