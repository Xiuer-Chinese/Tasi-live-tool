"""请求/响应 Pydantic 模型，预留订阅字段"""
from datetime import datetime
from typing import Any, List, Optional

from pydantic import BaseModel, Field


# ----- 请求 -----
class RegisterBody(BaseModel):
    identifier: str = Field(..., description="邮箱或手机号")
    password: str = Field(..., min_length=6)


class LoginBody(BaseModel):
    identifier: str
    password: str


class RefreshBody(BaseModel):
    refresh_token: str


# ----- 响应：用户（不含密码） -----
class UserOut(BaseModel):
    id: str
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime
    last_login_at: Optional[datetime] = None
    status: str

    class Config:
        from_attributes = True


# ----- 订阅预留 -----
class SubscriptionOut(BaseModel):
    plan: str = "free"
    status: str = "active"
    current_period_end: Optional[datetime] = None
    features: List[str] = Field(default_factory=list)


# ----- 认证响应 -----
class TokensOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ----- GET /me -----
class MeResponse(BaseModel):
    user: UserOut
    subscription: SubscriptionOut


# ----- 错误规范 -----
class ErrorDetail(BaseModel):
    code: str
    message: str


# 统一错误码：account_exists | wrong_password | invalid_params | token_invalid
def err_account_exists() -> dict:
    return {"code": "account_exists", "message": "账号已存在"}


def err_wrong_password() -> dict:
    return {"code": "wrong_password", "message": "用户名或密码错误"}


def err_invalid_params(msg: str = "参数错误") -> dict:
    return {"code": "invalid_params", "message": msg}


def err_token_invalid() -> dict:
    return {"code": "token_invalid", "message": "token 失效或已过期"}
