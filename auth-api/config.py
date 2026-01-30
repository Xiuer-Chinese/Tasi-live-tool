"""Auth API 配置：从环境变量读取，便于阿里云/本地部署"""
import os
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # 数据库：阿里云 RDS 或本地 MySQL
    DATABASE_URL: str = "mysql+pymysql://root:password@127.0.0.1:3306/auth_db"
    # JWT
    JWT_SECRET: str = "change-me-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    # CORS：先放开 * 测通，生产可改为 Electron 或具体域名
    CORS_ORIGINS: str = "*"

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
# 支持从环境变量覆盖
if os.getenv("DATABASE_URL"):
    settings.DATABASE_URL = os.getenv("DATABASE_URL")
if os.getenv("JWT_SECRET"):
    settings.JWT_SECRET = os.getenv("JWT_SECRET")
