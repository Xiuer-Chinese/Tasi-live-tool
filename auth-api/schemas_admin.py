"""Admin API 请求/响应模型"""
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class AdminLoginBody(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    token: str


class AdminUserListItem(BaseModel):
    username: str  # email 或 phone
    user_id: str
    created_at: Optional[str] = None
    disabled: bool = False  # status != "active"
    trial_end: Optional[int] = None  # trials.end_ts 或 null
    plan: str = "free"


class AdminUserDetail(AdminUserListItem):
    last_login_at: Optional[str] = None
    trial_start: Optional[int] = None


class AdminResetPasswordBody(BaseModel):
    new_password: Optional[str] = Field(None, min_length=6)


class AdminResetPasswordResponse(BaseModel):
    ok: bool = True
    temp_password: Optional[str] = None  # 未传 new_password 时返回临时密码
    message: str = ""
