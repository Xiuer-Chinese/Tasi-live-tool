"""数据表：users, refresh_tokens, subscriptions(预留)"""
from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=True)  # 邮箱或手机号统一存 identifier
    phone = Column(String(32), unique=True, index=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)
    status = Column(String(20), default="active")  # active | inactive | banned

    refresh_tokens = relationship("RefreshToken", back_populates="user")
    subscription = relationship("Subscription", back_populates="user", uselist=False)


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="refresh_tokens")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, index=True)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False, unique=True)
    plan = Column(String(32), default="free")  # free | trial | premium | enterprise
    status = Column(String(20), default="active")
    current_period_end = Column(DateTime, nullable=True)
    features_json = Column(JSON, nullable=True)  # 预留：["feature_a", "feature_b"]

    user = relationship("User", back_populates="subscription")
