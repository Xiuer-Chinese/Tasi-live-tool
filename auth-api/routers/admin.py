"""管理员接口：/admin/login 与 /admin/users/*，均需 admin token（除 login 外），并写审计日志"""
import re
import secrets
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import or_, text
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from deps import (
    auth_audit_log,
    create_admin_token,
    get_current_admin,
    hash_password,
)
from models import RefreshToken, Subscription, User
from schemas import err_wrong_password
from schemas_admin import (
    AdminLoginBody,
    AdminLoginResponse,
    AdminResetPasswordBody,
    AdminResetPasswordResponse,
    AdminUserDetail,
    AdminUserListItem,
)

router = APIRouter(prefix="/admin", tags=["admin"])


def _is_email(s: str) -> bool:
    return bool(re.match(r"^[^\s@]+@[^\s@]+\.[^\s@]+$", s))


def _is_phone(s: str) -> bool:
    return bool(re.match(r"^1[3-9]\d{9}$", s))


def _get_user_by_username(db: Session, username: str) -> Optional[User]:
    """通过邮箱或手机号解析用户（username 即 identifier）。"""
    u = (username or "").strip()
    if not u:
        return None
    if _is_email(u):
        return db.query(User).filter(User.email == u).first()
    if _is_phone(u):
        return db.query(User).filter(User.phone == u).first()
    return db.query(User).filter(or_(User.email == u, User.phone == u)).first()


def _username_of(user: User) -> str:
    return user.email or user.phone or user.id


def _trial_end_ts(db: Session, user_id: str) -> Optional[int]:
    row = db.execute(
        text("SELECT end_ts FROM trials WHERE username = :u"),
        {"u": user_id},
    ).fetchone()
    return int(row[0]) if row and row[0] is not None else None


def _trial_start_ts(db: Session, user_id: str) -> Optional[int]:
    row = db.execute(
        text("SELECT start_ts FROM trials WHERE username = :u"),
        {"u": user_id},
    ).fetchone()
    return int(row[0]) if row and row[0] is not None else None


# ----- POST /admin/login -----
@router.post("/login", response_model=AdminLoginResponse)
def admin_login(body: AdminLoginBody, request: Request):
    req_id = str(uuid.uuid4())
    if (body.username or "").strip() != settings.ADMIN_USERNAME:
        auth_audit_log(req_id, str(request.url), "admin_login", None, "failure", {"reason": "wrong_username"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_wrong_password(),
        )
    if (body.password or "") != settings.ADMIN_PASSWORD:
        auth_audit_log(req_id, str(request.url), "admin_login", None, "failure", {"reason": "wrong_password"})
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=err_wrong_password(),
        )
    token = create_admin_token()
    auth_audit_log(req_id, str(request.url), "admin_login", settings.ADMIN_USERNAME, "success", {"token": "***"})
    return AdminLoginResponse(token=token)


def _req_id(request: Request) -> str:
    return getattr(request.state, "request_id", None) or str(uuid.uuid4())


# ----- GET /admin/users -----
@router.get("/users", response_model=list[AdminUserListItem])
def admin_list_users(
    request: Request,
    query: Optional[str] = None,
    page: int = 1,
    size: int = 20,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    req_id = _req_id(request)
    if page < 1:
        page = 1
    if size < 1 or size > 100:
        size = 20
    offset = (page - 1) * size
    q = db.query(User)
    if query and query.strip():
        q = q.filter(
            or_(
                User.email.ilike(f"%{query.strip()}%"),
                User.phone.ilike(f"%{query.strip()}%"),
                User.id.ilike(f"%{query.strip()}%"),
            )
        )
    users = q.order_by(User.created_at.desc()).offset(offset).limit(size).all()
    items = []
    for u in users:
        trial_end = _trial_end_ts(db, u.id)
        items.append(
            AdminUserListItem(
                username=_username_of(u),
                user_id=u.id,
                created_at=u.created_at.isoformat() if u.created_at else None,
                disabled=(u.status or "active") != "active",
                trial_end=trial_end,
                plan=getattr(u, "plan", None) or "free",
            )
        )
    auth_audit_log(req_id, str(request.url), "list_users", None, "success", {"count": len(items), "page": page})
    return items


# ----- GET /admin/users/{username} -----
@router.get("/users/{username}", response_model=AdminUserDetail)
def admin_get_user(
    username: str,
    request: Request,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    req_id = _req_id(request)
    user = _get_user_by_username(db, username)
    if not user:
        auth_audit_log(req_id, str(request.url), "get_user", username, "failure", {"reason": "not_found"})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "user_not_found", "message": "用户不存在"})
    trial_end = _trial_end_ts(db, user.id)
    trial_start = _trial_start_ts(db, user.id)
    auth_audit_log(req_id, str(request.url), "get_user", _username_of(user), "success", {"user_id": user.id})
    return AdminUserDetail(
        username=_username_of(user),
        user_id=user.id,
        created_at=user.created_at.isoformat() if user.created_at else None,
        disabled=(user.status or "active") != "active",
        trial_end=trial_end,
        trial_start=trial_start,
        plan=getattr(user, "plan", None) or "free",
        last_login_at=user.last_login_at.isoformat() if user.last_login_at else None,
    )


# ----- POST /admin/users/{username}/disable -----
@router.post("/users/{username}/disable")
def admin_disable_user(
    username: str,
    request: Request,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    req_id = _req_id(request)
    user = _get_user_by_username(db, username)
    if not user:
        auth_audit_log(req_id, str(request.url), "disable_user", username, "failure", {"reason": "not_found"})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "user_not_found", "message": "用户不存在"})
    user.status = "disabled"
    db.commit()
    db.refresh(user)
    auth_audit_log(req_id, str(request.url), "disable_user", _username_of(user), "success", {"status": "disabled"})
    return {"ok": True, "username": _username_of(user), "status": "disabled"}


# ----- POST /admin/users/{username}/enable -----
@router.post("/users/{username}/enable")
def admin_enable_user(
    username: str,
    request: Request,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    req_id = _req_id(request)
    user = _get_user_by_username(db, username)
    if not user:
        auth_audit_log(req_id, str(request.url), "enable_user", username, "failure", {"reason": "not_found"})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "user_not_found", "message": "用户不存在"})
    user.status = "active"
    db.commit()
    db.refresh(user)
    auth_audit_log(req_id, str(request.url), "enable_user", _username_of(user), "success", {"status": "active"})
    return {"ok": True, "username": _username_of(user), "status": "active"}


# ----- POST /admin/users/{username}/reset-password -----
@router.post("/users/{username}/reset-password", response_model=AdminResetPasswordResponse)
def admin_reset_password(
    username: str,
    request: Request,
    body: Optional[AdminResetPasswordBody] = None,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    req_id = _req_id(request)
    user = _get_user_by_username(db, username)
    if not user:
        auth_audit_log(req_id, str(request.url), "reset_password", username, "failure", {"reason": "not_found"})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "user_not_found", "message": "用户不存在"})
    if body and body.new_password:
        new_pass = body.new_password
    else:
        new_pass = secrets.token_urlsafe(12)
    user.password_hash = hash_password(new_pass)
    db.commit()
    if body and body.new_password:
        auth_audit_log(req_id, str(request.url), "reset_password", _username_of(user), "success", {"message": "password_updated"})
        return AdminResetPasswordResponse(message="密码已更新")
    auth_audit_log(req_id, str(request.url), "reset_password", _username_of(user), "success", {"temp_password": "***"})
    return AdminResetPasswordResponse(temp_password=new_pass, message="已生成临时密码，请妥善保管")


# ----- DELETE /admin/users/{username} -----
@router.delete("/users/{username}")
def admin_delete_user(
    username: str,
    request: Request,
    admin: str = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    req_id = _req_id(request)
    user = _get_user_by_username(db, username)
    if not user:
        auth_audit_log(req_id, str(request.url), "delete_user", username, "failure", {"reason": "not_found"})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail={"code": "user_not_found", "message": "用户不存在"})
    uid = user.id
    uname = _username_of(user)
    db.query(RefreshToken).filter(RefreshToken.user_id == uid).delete()
    db.query(Subscription).filter(Subscription.user_id == uid).delete()
    db.execute(text("DELETE FROM trials WHERE username = :u"), {"u": uid})
    db.delete(user)
    db.commit()
    auth_audit_log(req_id, str(request.url), "delete_user", uname, "success", {"deleted_user_id": uid})
    return {"ok": True, "username": uname, "message": "用户已删除"}