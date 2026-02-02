# 登录/注册 username 与 identifier 兼容修复

**目标**：修复“开发环境无法注册/登录：username required，但客户端发 identifier”。  
**策略**：服务端兼容 username/identifier 二选一，客户端统一发送 username；改动可回滚。

---

## 一、修改文件列表

| 文件 | 改动概要 |
|------|----------|
| `auth-api/schemas.py` | LoginBody/RegisterBody 接受 `username` 或 `identifier`，内部统一为 `username`（Pydantic v2 AliasChoices） |
| `auth-api/routers/auth.py` | 注册/登录路由从 `body.identifier` 改为 `body.username` |
| `electron/main/services/cloudAuthClient.ts` | register/login 请求体改为 `{ username: identifier, password }`，路径改为 `/auth/register`、`/auth/login` |
| `docs/AUTH_USERNAME_IDENTIFIER_FIX.md` | 本交付说明（diff 摘要、回滚、最小验收） |

**未改**：`package.json` dev 脚本已包含 `USE_REAL_AUTH=true`、`USE_MOCK_AUTH=false`、`AUTH_API_BASE_URL`、`VITE_AUTH_API_BASE_URL`；Electron 启动时已有 `[AUTH-AUDIT] startup config`，请求前已有 `[AUTH-AUDIT] <process> <method> <full_url>`。渲染进程不直连 register/login（经 IPC → cloudAuthClient），故 `src/services/apiClient.ts`、`preload/auth.ts` 无需改。

---

## 二、关键 diff 摘要

### auth-api/schemas.py

- **原**：`RegisterBody` / `LoginBody` 仅字段 `identifier: str`。
- **现**：  
  - 引入 `AliasChoices`，用 `_username_field()` 生成 `username: str = Field(..., validation_alias=AliasChoices("username", "identifier"))`。  
  - `RegisterBody`：`username: str = _username_field()`，`password: str = Field(..., min_length=6)`。  
  - `LoginBody`：`username: str = _username_field()`，`password: str`。  
- 请求体传 `username` 或 `identifier` 任一即可，路由统一使用 `body.username`。

### auth-api/routers/auth.py

- `register(body)`：`identifier = (body.username or "").strip()`（原 `body.identifier`）。
- `login(body)`：同上。

### electron/main/services/cloudAuthClient.ts

- `cloudRegister`：  
  - 路径 `'/register'` → `'/auth/register'`。  
  - body `{ identifier, password }` → `{ username: identifier, password }`。  
- `cloudLogin`：  
  - 路径 `'/login'` → `'/auth/login'`。  
  - body `{ identifier, password }` → `{ username: identifier, password }`。  

**说明**：base URL 应为鉴权服务根（如 `http://121.41.179.197:8000`）。客户端会根据 base 是否以 `/auth` 结尾自动选择路径：base 不含 `/auth` 时请求 `/auth/register`、`/auth/login`；base 含 `/auth` 时请求 `/register`、`/login`，避免出现 `/auth/auth/register` 导致 404。

---

## 三、Pydantic 版本与实现方式

- **当前依赖**：`auth-api/requirements.txt` 中 `pydantic==2.10.3`，为 **Pydantic v2**。  
- **实现**：使用 **v2** 的 `validation_alias=AliasChoices("username", "identifier")`，使请求体可传 `username` 或 `identifier`，模型内统一为 `username`。  
- **未实现 v1**：若将来降级到 Pydantic v1，需在 `LoginBody`/`RegisterBody` 上增加 `root_validator(pre=True)`，在 raw 输入中把 `identifier` 映射到 `username` 再校验。

---

## 四、回滚说明

1. **auth-api**  
   - `schemas.py`：恢复 `RegisterBody`/`LoginBody` 仅含 `identifier: str`（去掉 `_username_field` 与 `AliasChoices`）。  
   - `routers/auth.py`：`body.username` 改回 `body.identifier`。  

2. **Electron**  
   - `cloudAuthClient.ts`：  
     - register 路径改回 `'/register'`，body 改回 `{ identifier, password }`。  
     - login 路径改回 `'/login'`，body 改回 `{ identifier, password }`。  

3. **部署**  
   - 回滚后需同时部署 auth-api 与客户端（或保证旧客户端仍发 `identifier` 且服务端仍只认 `identifier`）。  

4. **Git**  
   - 本次修改集中在上述 3 个文件 + 本 doc，可按 commit 或分支整体回滚。

---

## 五、最小验收步骤（可复现）

### 前提

- auth-api 已启动（本地或远程，如 `http://121.41.179.197:8000`）。  
- 桌面端 `npm run dev` 且环境变量已注入：`USE_REAL_AUTH=true`、`AUTH_API_BASE_URL`、`VITE_AUTH_API_BASE_URL`（与 auth-api 基址一致，如 `http://121.41.179.197:8000`）。

### 1）清库（可选）

- 清空或重置 `users` 表（按你现有方式，如 SQL 或脚本），便于“新用户”验收。

### 2）注册

- 在桌面端打开注册，输入手机号或邮箱 + 密码，提交。  
- **预期**：  
  - 终端出现：`[AUTH-AUDIT] ... POST http://<base>/auth/register`。  
  - 服务端（如 `docker compose logs` 或 uvicorn 日志）能看到对应 POST。  
  - 注册成功（无 422 “username required”）。  

### 3）查库

- 在服务器执行查询（示例）：  
  - SQLite：`SELECT id, email, phone, created_at FROM users ORDER BY created_at DESC LIMIT 5;`  
  - 或你现有的 Python/脚本。  
- **预期**：能看到刚注册的账号（email 或 phone 与输入一致）。

### 4）登录

- 用同一账号在桌面端登录。  
- **预期**：  
  - 终端出现：`[AUTH-AUDIT] ... POST http://<base>/auth/login`。  
  - 返回 200，登录成功。  
- **错误时**：  
  - 401：凭证错误（如 wrong_password / invalid credentials）。  
  - 422：参数缺失或格式错误（应明确字段，不再出现“只认 username 不认 identifier”的歧义）。

### 5）curl 自检（可选）

- 将 `BASE`、`USER`、`PASS` 替换为实际值。  
- 注册：  
  `curl -s -X POST "%BASE%/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"%USER%\",\"password\":\"%PASS%\"}"`  
- 登录：  
  `curl -s -X POST "%BASE%/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"%USER%\",\"password\":\"%PASS%\"}"`  
- 仍兼容传 `identifier`：  
  `curl -s -X POST "%BASE%/auth/login" -H "Content-Type: application/json" -d "{\"identifier\":\"%USER%\",\"password\":\"%PASS%\"}"`  
- **预期**：以上两种 body 均能 200（或明确的 4xx 业务错误）。

---

完成以上步骤即视为“开发环境注册/登录 + username/identifier 兼容”最小验收通过。

---

## 六、注册/登录出现 404 Not Found 时

- **现象**：弹窗显示 `{"detail":"Not Found"}`。
- **可能原因**：  
  1. **base URL 配置**：`AUTH_API_BASE_URL` 应为服务根（如 `http://121.41.179.197:8000`），不要写成 `.../auth` 除非服务确实挂在该路径下。若误配为 `.../auth`，客户端已做兼容（不再拼接 `/auth`，避免 `/auth/auth/register`）。  
  2. **服务未启动或不可达**：确认 auth-api 已启动且本机/网络能访问该 host:port。  
  3. **路由不一致**：确认部署的 auth-api 与当前代码一致（含 `/auth` 前缀的 register/login/refresh）。
- **排查**：看终端 `[AUTH-AUDIT]` 打印的完整 URL，在浏览器或 curl 中请求该 URL，确认返回 200/4xx 而非 404。
