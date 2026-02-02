# 用户状态模型 + 查询接口 — 执行报告（只字段，不收费）

**日期**: 2025-02-02  
**目标**: 在 auth-api 中引入“用户状态”最小数据模型，并提供只读接口供客户端查询当前用户状态。  
**约束**: 不做支付、不做订阅策略、不做后台管理界面、不修改前端。

---

## 一、已完成的改动（文件路径 + diff 摘要）

### A. 数据层（SQLite）

| 文件路径 | 变更摘要 |
|----------|----------|
| **auth-api/models.py** | 在 `User` 表中新增字段：`plan = Column(String(32), default="free")`（free/trial/pro，暂只用 free）。`status`、`created_at`、`last_login_at` 已存在，未改。 |
| **auth-api/database.py** | 新增 `_ensure_user_status_columns()`：仅 SQLite 时执行；(1) 若 `users` 表存在且无 `plan` 列则 `ALTER TABLE users ADD COLUMN plan TEXT DEFAULT 'free'`；(2) `UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL OR created_at = ''`。`create_tables()` 末尾调用 `_ensure_user_status_columns()`。导入 `text`，使用 `engine.begin()` 执行并提交。 |

**diff 摘要**：

- **models.py**：在 `User` 中 `status` 行后增加 `plan = Column(String(32), default="free")`，注释为 `# free | trial | pro，暂只用 free`；`status` 注释改为 `# active | disabled`。
- **database.py**：`from sqlalchemy import create_engine, text`；`create_tables()` 末行增加 `_ensure_user_status_columns()`；新增函数 `_ensure_user_status_columns()`（内容见上）。

### B. 业务逻辑（服务器）

| 文件路径 | 变更摘要 |
|----------|----------|
| **auth-api/routers/auth.py** | **注册**：新建用户时 `last_login_at=None`、`plan="free"`（仅登录时更新 `last_login_at`）。**登录**：保持原有逻辑，登录成功后 `user.last_login_at = datetime.utcnow()` 并 `db.commit()`，未引入订阅/收费判断。 |

**diff 摘要**：

- **auth.py register**：`User(..., last_login_at=now, ...)` 改为 `last_login_at=None`，并增加 `plan="free"`。

### C. 新增接口（只读）

| 文件路径 | 变更摘要 |
|----------|----------|
| **auth-api/schemas.py** | 新增响应模型 `UserStatusResponse(BaseModel)`：`username: str`，`status: str = "active"`，`plan: str = "free"`，`created_at: Optional[str] = None`，`last_login_at: Optional[str] = None`。 |
| **auth-api/routers/auth.py** | 新增 `GET /auth/status`（即 `GET /auth/status`）：依赖 `get_current_user`（Bearer Token），仅返回当前登录用户的 `UserStatusResponse`；`username` 取 `user.email or user.phone or user.id`，`created_at`/`last_login_at` 以 ISO 字符串返回。 |

**diff 摘要**：

- **schemas.py**：在 `MeResponse` 后增加 `UserStatusResponse` 定义（字段见上）。
- **auth.py**：在 `deps` 导入中增加 `get_current_user`，在 `schemas` 导入中增加 `UserStatusResponse`；在文件末尾增加 `@router.get("/status", response_model=UserStatusResponse)` 与 `def user_status(user: User = Depends(get_current_user))`，返回 `UserStatusResponse(...)`。

### D. 权限约束

- `GET /auth/status` 使用 `Depends(get_current_user)`，仅能基于当前 access token 返回当前登录用户状态。
- 不支持查询他人、不支持列表。

---

## 二、验收要求

1. **新用户注册后**：`users` 表包含 `status`、`plan`、`created_at`（`last_login_at` 可为 NULL）。
2. **登录一次后**：该用户的 `last_login_at` 被更新。
3. **客户端请求 `GET /auth/status`**（Header: `Authorization: Bearer <access_token>`）：返回与数据库一致的 `username`、`status`、`plan`、`created_at`、`last_login_at`（字段可少不可多）。

---

## 三、回滚要点

| 改动 | 回滚方式 |
|------|----------|
| models.py | 删除 `User.plan` 列定义。 |
| database.py | 删除 `_ensure_user_status_columns()` 及 `create_tables()` 中对它的调用；移除 `text` 导入。 |
| auth.py register | 恢复 `last_login_at=now`，移除 `plan="free"`。 |
| schemas.py | 删除 `UserStatusResponse`。 |
| auth.py GET /auth/status | 删除 `user_status` 路由及对 `get_current_user`、`UserStatusResponse` 的导入。 |

---

*本报告仅记录数据模型与只读接口改动，未做支付、订阅策略、后台 UI 或前端修改。*
