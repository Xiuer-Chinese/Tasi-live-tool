"""POST /auth/register, /auth/login, /auth/refresh, /auth/trial/start"""
import hashlib
import re
import time
import uuid
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import text

from config import settings
from database import get_db
from deps import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
    get_current_user,
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
    TrialOut,
    UserOut,
    UserStatusResponse,
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


def build_user_status_response(user: User, db: Optional[Session] = None) -> UserStatusResponse:
    """拼装 /auth/status 返回结构（含 plan、trial）。trial 优先从 trials 表读取（与 /auth/trial/* 一致）。"""
    username = user.email or user.phone or user.id
    plan = getattr(user, "plan", None) or "free"
    trial: Optional[TrialOut] = None

    if db is not None:
        row = db.execute(
            text("SELECT start_ts, end_ts FROM trials WHERE username = :u"),
            {"u": user.id},
        ).fetchone()
        if row and row[0] is not None and row[1] is not None:
            start_ts, end_ts = row[0], row[1]
            now_ts = int(time.time())
            is_active = end_ts > now_ts
            is_expired = end_ts <= now_ts
            trial = TrialOut(
                start_at=datetime.utcfromtimestamp(start_ts).isoformat() + "Z" if start_ts else None,
                end_at=datetime.utcfromtimestamp(end_ts).isoformat() + "Z" if end_ts else None,
                is_active=is_active,
                is_expired=is_expired,
            )
            if is_active:
                plan = "trial"
        else:
            trial = TrialOut(is_active=False, is_expired=False)
    else:
        trial_start_at = getattr(user, "trial_start_at", None)
        trial_end_at = getattr(user, "trial_end_at", None)
        now = datetime.utcnow()
        end_dt = trial_end_at
        is_active = end_dt is not None and now < end_dt
        is_expired = end_dt is not None and now >= end_dt
        trial = TrialOut(
            start_at=trial_start_at.isoformat() if trial_start_at else None,
            end_at=trial_end_at.isoformat() if trial_end_at else None,
            is_active=is_active,
            is_expired=is_expired,
        )
        if is_active:
            plan = "trial"

    return UserStatusResponse(
        username=username,
        status=user.status or "active",
        plan=plan,
        created_at=user.created_at.isoformat() if user.created_at else None,
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
        trial=trial,
    )


@router.post("/register", response_model=AuthResponse)
def register(body: RegisterBody, db: Session = Depends(get_db)):
    identifier = (body.username or "").strip()
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
        last_login_at=None,
        status="active",
        plan="free",
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
    identifier = (body.username or "").strip()
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


@router.get("/status", response_model=UserStatusResponse)
def user_status(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """GET /auth/status：需 Bearer Token，仅返回当前登录用户的状态（只读，含 plan、trial）。trial 来自 trials 表。"""
    return build_user_status_response(user, db)


TRIAL_DAYS = 7


@router.post("/trial/start")
def trial_start(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    """POST /auth/trial/start：开启 7 天试用，需 Authorization: Bearer <token>。未过期则返回当前 end_ts，否则 upsert 新 7 天。"""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少 token")
    token = credentials.credentials.strip()
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少 token")
    username = decode_access_token(token)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    # username 即 JWT payload 的 sub（当前为 user_id）
    now_ts = int(time.time())
    row = db.execute(
        text("SELECT start_ts, end_ts FROM trials WHERE username = :u"),
        {"u": username},
    ).fetchone()
    if row and row[1] and row[1] > now_ts:
        return {"success": True, "trialEndsAt": row[1]}
    start_ts = now_ts
    end_ts = start_ts + 7 * 24 * 3600
    db.execute(
        text(
            "INSERT OR REPLACE INTO trials(username, start_ts, end_ts) VALUES (:u, :s, :e)"
        ),
        {"u": username, "s": start_ts, "e": end_ts},
    )
    db.commit()
    return {"success": True, "trialEndsAt": end_ts}


@router.get("/trial/status")
def trial_status(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
):
    """GET /auth/trial/status：需 Bearer token，只读返回当前用户试用状态。"""
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="缺少 token")
    username = decode_access_token(credentials.credentials.strip())
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    row = db.execute(
        text("SELECT end_ts FROM trials WHERE username = :u"),
        {"u": username},
    ).fetchone()
    if not row or row[0] is None:
        return {"hasTrial": False, "trialEndsAt": None, "isActive": False}
    end_ts = row[0]
    now_ts = int(time.time())
    return {
        "hasTrial": True,
        "trialEndsAt": end_ts,
        "isActive": end_ts > now_ts,
    }


def _admin_debug_enabled() -> bool:
    import os
    return os.getenv("ENABLE_ADMIN_DEBUG", "").strip().lower() == "true"


@router.post("/trial/debug/expire", response_model=UserStatusResponse)
def trial_debug_expire(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """POST /auth/trial/debug/expire：仅当 ENABLE_ADMIN_DEBUG=true 时可用；将当前用户 trial_end_at 设为过去，用于验收“到期弹窗”。"""
    if not _admin_debug_enabled():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    try:
        now = datetime.utcnow()
        user.trial_end_at = now - timedelta(minutes=1)
        db.commit()
        db.refresh(user)
        return build_user_status_response(user)
    except Exception as e:
        import logging
        logging.getLogger(__name__).exception("trial/debug/expire failed: %s", e)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="debug expire failed")
