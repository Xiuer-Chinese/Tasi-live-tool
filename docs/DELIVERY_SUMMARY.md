# 交付总结汇总

本文档汇总近期鉴权与试用相关交付：修改文件列表、关键 diff、回滚说明、最小验收步骤。详细步骤见各专项文档。

---

## 一、交付概览

| 交付项 | 目标 | 专项文档 |
|--------|------|----------|
| **试用闭环发布级打磨** | 试用已到期时前端明确提示「试用已使用完毕」；提供 debug/expire 到期模拟；端到端验收清单 | `docs/TRIAL_E2E_CHECKLIST.md` |
| **登录/注册 username 与 identifier 兼容** | 修复开发环境 422「username required」；服务端兼容 username/identifier，客户端统一发 username | `docs/AUTH_USERNAME_IDENTIFIER_FIX.md` |

---

## 二、修改文件列表（合并）

### 服务端 auth-api

| 文件 | 改动概要 |
|------|----------|
| `auth-api/schemas.py` | LoginBody/RegisterBody 接受 `username` 或 `identifier`，统一为 `username`（Pydantic v2 AliasChoices） |
| `auth-api/routers/auth.py` | 注册/登录用 `body.username`；试用已过期时 POST /auth/trial/start 返回 409 `trial_already_used`；新增 POST /auth/trial/debug/expire（ENABLE_ADMIN_DEBUG=true） |

### 客户端 Electron / 前端

| 文件 | 改动概要 |
|------|----------|
| `electron/main/services/cloudAuthClient.ts` | register/login 请求体改为 `{ username: identifier, password }`，路径 `/auth/register`、`/auth/login` |
| `src/services/apiClient.ts` | startTrial 返回 ApiResult&lt;UserStatus&gt;，便于拿到 409 的 error.code |
| `src/stores/authStore.ts` | startTrialAndRefresh 返回 `{ success, status }` 或 `{ success: false, errorCode?, message? }` |
| `src/components/auth/SubscribeDialog.tsx` | 捕获 trial_already_used 时弹窗内展示「试用已使用完毕，如需继续使用请升级」，不关弹窗、不放行 |

### 文档

| 文件 | 说明 |
|------|------|
| `docs/TRIAL_E2E_CHECKLIST.md` | 试用闭环端到端验收步骤与 curl 示例 |
| `docs/AUTH_USERNAME_IDENTIFIER_FIX.md` | 登录/注册兼容修复的 diff、回滚、最小验收 |
| `docs/DELIVERY_SUMMARY.md` | 本汇总 |

---

## 三、关键 diff 摘要

### 试用闭环

- **auth-api/routers/auth.py**  
  - POST /auth/trial/start：若 trial_end_at 存在且 now ≥ trial_end_at，返回 409，`detail.code = "trial_already_used"`。  
  - POST /auth/trial/debug/expire：仅当 ENABLE_ADMIN_DEBUG=true 时存在，将当前用户 trial_end_at 设为过去。  
- **src**：apiClient.startTrial 返回 ApiResult；authStore.startTrialAndRefresh 返回带 errorCode 的结果；SubscribeDialog 对 trial_already_used 做明确提示。

### 登录/注册兼容

- **auth-api/schemas.py**：`username: str = Field(..., validation_alias=AliasChoices("username", "identifier"))`，RegisterBody/LoginBody 均用该字段。  
- **auth-api/routers/auth.py**：register/login 中 `identifier = (body.username or "").strip()`。  
- **cloudAuthClient.ts**：register/login 的 body 为 `{ username: identifier, password }`，路径为 `/auth/register`、`/auth/login`。

---

## 四、Pydantic 与实现方式

- **当前**：auth-api 使用 **Pydantic v2**（2.10.3）。  
- **实现**：登录/注册请求体通过 `validation_alias=AliasChoices("username", "identifier")` 兼容两种字段名，模型内统一为 `username`。  
- **v1**：未实现；若降级到 v1，需在 LoginBody/RegisterBody 上增加 `root_validator(pre=True)` 做 identifier→username 映射。

---

## 五、回滚说明

### 试用闭环回滚

- **auth-api**：移除 trial/start 的 409 逻辑及 trial/debug/expire 路由。  
- **src**：apiClient.startTrial 恢复为返回 UserStatus | null；authStore.startTrialAndRefresh 恢复为返回 status | null；SubscribeDialog 去掉 trial_already_used 分支与 trialError 状态。

### 登录/注册兼容回滚

- **auth-api**：schemas 恢复仅 `identifier`；auth 路由改回 `body.identifier`。  
- **cloudAuthClient.ts**：register/login 路径改回 `'/register'`、`'/login'`，body 改回 `{ identifier, password }`。

### 部署与 Git

- 回滚后需同时部署 auth-api 与客户端（或保证旧客户端与当前服务端约定一致）。  
- 上述修改均可按 commit 或分支整体回滚。

---

## 六、最小验收步骤（合并）

### 6.1 登录/注册（开发环境必过）

1. **前提**：auth-api 已启动；桌面端 `npm run dev` 且已注入 `USE_REAL_AUTH=true`、`AUTH_API_BASE_URL`、`VITE_AUTH_API_BASE_URL`。  
2. **注册**：桌面端注册新账号 → 终端出现 `[AUTH-AUDIT] ... POST http://<base>/auth/register`，无 422「username required」。  
3. **查库**：服务器查 users 表，能看到新记录。  
4. **登录**：同一账号登录 → `[AUTH-AUDIT] ... POST http://<base>/auth/login`，返回 200；错误时为明确 401/422。

### 6.2 试用闭环（可选）

1. **新用户点「免费试用 7 天」**：200，弹窗关闭，可切换平台。  
2. **调用 debug/expire**（ENABLE_ADMIN_DEBUG=true）→ 刷新 userStatus → 自动弹「试用已结束」。  
3. **在「试用已结束」弹窗点「免费试用 7 天」**：409，弹窗内提示「试用已使用完毕，如需继续使用请升级」，不关闭、不放行。

### 6.3 curl 自检（可选）

- **注册**：`curl -s -X POST "%BASE%/auth/register" -H "Content-Type: application/json" -d "{\"username\":\"%USER%\",\"password\":\"%PASS%\"}"`  
- **登录**：`curl -s -X POST "%BASE%/auth/login" -H "Content-Type: application/json" -d "{\"username\":\"%USER%\",\"password\":\"%PASS%\"}"`  
- **兼容 identifier**：`curl -s -X POST "%BASE%/auth/login" -H "Content-Type: application/json" -d "{\"identifier\":\"%USER%\",\"password\":\"%PASS%\"}"`  
- **试用状态**：`curl -s -X GET "%BASE%/auth/status" -H "Authorization: Bearer %ACCESS_TOKEN%"`  
- **试用开通**：`curl -s -X POST "%BASE%/auth/trial/start" -H "Authorization: Bearer %ACCESS_TOKEN%" -H "Content-Type: application/json"`  
- **到期模拟**：`curl -s -X POST "%BASE%/auth/trial/debug/expire" -H "Authorization: Bearer %ACCESS_TOKEN%" -H "Content-Type: application/json"`（需 ENABLE_ADMIN_DEBUG=true）

---

## 七、约束与未改项

- 不做支付、订阅、订单表；不新增后台 UI。  
- 平台门控主逻辑不变，仅补齐错误提示与调试通道。  
- **未改**：package.json dev 脚本（已含 USE_REAL_AUTH、AUTH_API_BASE_URL 等）；Electron 已有 [AUTH-AUDIT] startup config 与请求前审计日志；渲染进程不直连 register/login，apiClient/preload 未改。

---

完成「6.1 登录/注册」即视为开发环境注册/登录与 username/identifier 兼容通过；完成「6.2 试用闭环」即视为试用闭环发布级打磨通过。
