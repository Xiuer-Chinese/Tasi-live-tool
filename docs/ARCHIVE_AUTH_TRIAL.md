# 鉴权与试用对接存档

**存档日期**：2025-02-02  
**范围**：前端鉴权/试用对接、后端 auth-api GET /auth/status 与 /auth/trial/* 行为及验证方式。

---

## 一、后端 auth-api（已实现且可用）

### 1. 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /auth/login | 登录，返回 `token` 或 `access_token` |
| POST | /auth/register | 注册 |
| GET | /auth/status | 需 Bearer，返回用户状态（含 plan、trial，trial 来自 trials 表） |
| POST | /auth/trial/start | 需 Bearer + Body `{ "username": "当前登录用户名" }`，开通/续期 7 天试用 |
| GET | /auth/trial/status?username=xxx | 需 Bearer，返回 `has_trial`、`active`、`start_ts`、`end_ts` |

### 2. GET /auth/status 返回结构（满足前端 UserStatus）

- `username`、`status`、`plan`（free | trial | pro）
- `created_at`、`last_login_at`（可选）
- `trial`：`{ start_at?, end_at?, is_active, is_expired }`（试用来自 **trials** 表，与 /auth/trial/* 一致）

### 3. 关键后端文件

- `auth-api/routers/auth.py`：register、login、/auth/status、/auth/trial/start、/auth/trial/status；`build_user_status_response(user, db)` 从 trials 表读试用
- `auth-api/database.py`：`_ensure_trials_table()`，表 `trials(id, username UNIQUE, start_ts, end_ts)`
- `auth-api/schemas.py`：`UserStatusResponse`、`TrialOut`

### 4. 验证用 curl（示例 base：`http://121.41.179.197:8000`）

```bash
# 登录
curl -s -X POST "http://121.41.179.197:8000/auth/login" \
  -H "Content-Type: application/json" -d '{"username":"账号","password":"密码"}'

# 查状态（替换 YOUR_TOKEN）
curl -s -X GET "http://121.41.179.197:8000/auth/status" \
  -H "Authorization: Bearer YOUR_TOKEN"

# 开通试用
curl -s -X POST "http://121.41.179.197:8000/auth/trial/start" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" -d '{"username":"当前登录用户名"}'

# 查试用状态
curl -s -X GET "http://121.41.179.197:8000/auth/trial/status?username=当前登录用户名" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

更多见：`auth-api/docs/TRIAL_START_CURL.md`、`auth-api/docs/AUTH_STATUS_CURL.md`。

---

## 二、前端（Electron + React）

### 1. 状态与数据流

- **authStore.userStatus**：全局试用/用户状态，来源有二（整段替换，无合并）：
  - 登录/checkAuth 后：`getUserStatus()` → **GET /auth/status** → `set({ userStatus })`
  - 点击「免费试用 7 天」成功：`startTrial()` → **POST /auth/trial/start**，再 `getTrialStatus(username)` → **GET /auth/trial/status**，拼成 `UserStatus` → `set({ userStatus })`
- **门控**：`gateStore` 用 `userStatus?.plan === 'pro' || userStatus?.trial?.is_active === true` 判断是否需弹订阅/试用弹窗
- **试用弹窗**：`SubscribeDialog`，`trialExpired` 来自 `userStatus?.trial?.is_expired === true && userStatus?.plan !== 'pro'`

### 2. 前端 UserStatus 类型（与 GET /auth/status 约定一致）

- 定义：`src/types/auth.ts` 第 118–131 行
- 字段：`username`、`status`、`plan`、`created_at?`、`last_login_at?`、`trial?: { start_at?, end_at?, is_active?, is_expired? }`

### 3. 关键前端文件

| 文件 | 作用 |
|------|------|
| `src/services/apiClient.ts` | `getUserStatus()`（GET /auth/status）、`startTrial()`（POST /auth/trial/start，body 含 `username`）、`getTrialStatus(username)`（GET /auth/trial/status）；非 200 时透传后端 detail |
| `src/stores/authStore.ts` | 存 token/user/userStatus；`startTrialAndRefresh()` 编排 trial/start → trial/status 并写 userStatus |
| `src/components/auth/SubscribeDialog.tsx` | 「免费试用 7 天」按钮，调 `startTrialAndRefresh()`，失败时展示后端 detail |
| `src/components/auth/AuthProvider.tsx` | 用 userStatus 控制试用到期弹窗、离线提示 |
| `src/stores/gateStore.ts` | 按 userStatus 做功能门控（需订阅/试用） |
| `src/config/authApiBase.ts` | `AUTH_API_BASE`（如 `http://121.41.179.197:8000`） |

### 4. 未使用/遗留

- `src/stores/trialStore.ts`：本地 trial 状态（trialStartedAt、trialEndsAt、Date.now() 判断），**未被任何组件引用**，仅作遗留；前端试用判断**不依赖**该 store。

---

## 三、约束与约定（存档时遵守）

- 不删除、不破坏现有 **/auth/trial/start**、**/auth/trial/status**。
- 前端**不**唯一依赖 GET /auth/trial/status，而是统一依赖 **authStore.userStatus**；userStatus 可由 GET /auth/status 或「trial/start + trial/status」写入。
- 不引入新的 mock / 本地写死试用逻辑；错误信息用后端返回的 detail，不吞掉。
- POST /auth/trial/start 的 Body 必须包含 `username`（当前登录用户名），且需 `Authorization: Bearer <token>`。

---

## 四、相关文档索引

- `docs/FRONTEND_TRIAL_FLOW.md`：前端试用调用流程与关键代码位置
- `docs/AUTH_EVIDENCE_CHAIN_FIX.md`：注册/登录证据链与成功判定
- `auth-api/docs/TRIAL_START_CURL.md`：trial/start、trial/status 的 curl
- `auth-api/docs/AUTH_STATUS_CURL.md`：GET /auth/status 的 curl
