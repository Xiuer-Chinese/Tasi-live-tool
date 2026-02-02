"""POST /auth/register, /auth/login, /auth/refresh"""
import hashlib
import re
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_password,
    security,
    verify_password,
)
from models import RefreshToken, Subscription, User
from schemas import (
    AuthResponse,
    ErrorDetail,
    LoginBody,
    RefreshBody,
    RefreshResponse,
    RegisterBody,
    UserOut,
    err_account_exists,
    err_invalid_params,
    err_wrong_password,
    err_token_invalid,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def is_email(s: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", s))


def is_phone(s: str) -> bool:
    return bool(re.match(r"^1[3-9]\d{9}$", s))


def token_hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterBody, db: Session = Depends(get_db)):
    identifier = (body.identifier or "").strip()
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_invalid_params("请输入手机号或邮箱"),
        )
    if not is_email(identifier) and not is_phone(identifier):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_invalid_params("请输入有效的手机号或邮箱"),
        )

    if is_email(identifier):
        existing = db.query(User).filter(User.email == identifier).first()
    else:
        existing = db.query(User).filter(User.phone == identifier).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_account_exists(),
        )

    user_id = str(uuid.uuid4())
    password_hash = hash_password(body.password)
    now = datetime.utcnow()
    user = User(
        id=user_id,
        email=identifier if is_email(identifier) else None,
        phone=identifier if is_phone(identifier) else None,
        password_hash=password_hash,
        created_at=now,
        last_login_at=now,
        status="active",
    )
    db.add(user)

    # 预留：创建默认订阅
    sub = Subscription(
        id=str(uuid.uuid4()),
        user_id=user_id,
        plan="free",
        status="active",
        current_period_end=None,
        features_json=[],
    )
    db.add(sub)

    access_token = create_access_token(user_id)
    refresh_raw = create_refresh_token(user_id)
    refresh_hashed = token_hash(refresh_raw)
    expires_at = now + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    rt = RefreshToken(
        id=str(uuid.uuid4()),
        user_id=user_id,
        token_hash=refresh_hashed,
        expires_at=expires_at,
    )
    db.add(rt)
    db.commit()
    db.refresh(user)

    return AuthResponse(
        user=UserOut(
            id=user.id,
            email=user.email,
            phone=user.phone,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            status=user.status,
        ),
        access_token=access_token,
        refresh_token=refresh_raw,
    )


@router.post("/login", response_model=AuthResponse)
def login(body: LoginBody, db: Session = Depends(get_db)):
    identifier = (body.identifier or "").strip()
    if not identifier:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=err_invalid_params("请输入手机号或邮箱"),
        )

    if is_email(identifier):
        user = db.query(User).filter(User.email == identifier).first()
    else:
        user = db.query(User).filter(User.phone == identifier).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_wrong_password(),
        )
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "account_disabled", "message": "账户已被禁用"},
        )
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_wrong_password(),
        )

    user.last_login_at = datetime.utcnow()
    db.commit()
    db.refresh(user)

    access_token = create_access_token(user.id)
    refresh_raw = create_refresh_token(user.id)
    refresh_hashed = token_hash(refresh_raw)
    expires_at = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    rt = RefreshToken(
        id=str(uuid.uuid4()),
        user_id=user.id,
        token_hash=refresh_hashed,
        expires_at=expires_at,
    )
    db.add(rt)
    db.commit()

    return AuthResponse(
        user=UserOut(
            id=user.id,
            email=user.email,
            phone=user.phone,
            created_at=user.created_at,
            last_login_at=user.last_login_at,
            status=user.status,
        ),
        access_token=access_token,
        refresh_token=refresh_raw,
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(
    body: Optional[RefreshBody] = Body(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    """校验 refresh_token（JWT type=refresh），成功仅返回新 access_token。支持 JSON body.refresh_token 或 Authorization: Bearer <refresh_token>"""
    raw = (body.refresh_token if body and body.refresh_token else "").strip() or (
        credentials.credentials if credentials else ""
    )
    if not raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    user_id = decode_refresh_token(raw)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user or user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_token_invalid(),
        )
    new_access = create_access_token(user.id)
    return RefreshResponse(access_token=new_access)
