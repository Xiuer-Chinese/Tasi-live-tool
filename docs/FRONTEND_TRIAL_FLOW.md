# 前端试用对接流程说明

仅前端对接，未改后端。后端接口约定：

- `POST http://121.41.179.197:8000/login` → 返回 `{ token }`，登录成功后保存 token（Authorization: Bearer \<token\>）
- `POST http://121.41.179.197:8000/auth/trial/start` → Header 必须带 `Authorization: Bearer <token>`
- `GET http://121.41.179.197:8000/auth/trial/status?username={username}` → 同上 Bearer

后端返回示例：

- trial/start → `{ success: true, start_ts, end_ts }`
- trial/status → `{ has_trial: true, active: true, start_ts, end_ts }`

---

## 一、前端调用流程（按步骤）

1. **登录成功保存 token**
   - 登录由主进程 IPC（`auth:login`）调后端 `POST /login`，渲染进程 `authStore.login()` 收到 `response.token` 后写入 `authStore` 并持久化（localStorage）。
   - 之后所有需登录态请求（含 trial）从 `useAuthStore.getState().token` 取 token，由 `apiClient.requestWithRefresh` 自动带 `Authorization: Bearer <token>`。

2. **用户点击「免费试用 7 天」**
   - 触发 `SubscribeDialog` 内按钮 → `handleStartTrial()` → `authStore.startTrialAndRefresh()`。

3. **startTrialAndRefresh 内部顺序**
   - 若无 token：直接返回 `{ success: false, message: '请先登录' }`，UI 展示该信息。
   - 调 `apiClient.startTrial()`：**POST /auth/trial/start**，Header 带 `Authorization: Bearer <token>`（由 `requestWithRefresh` 注入）。
   - 若接口非 200：不吞掉错误，`apiClient` 将后端 `detail`（字符串或 `detail.message`）解析到 `error.message`，`startTrialAndRefresh` 原样返回 `message`，弹窗展示。
   - 若 200 且 `data.success === true`：再调 `apiClient.getTrialStatus(username)`：**GET /auth/trial/status?username=xxx**，同样带 Bearer。

4. **根据 trial/status 更新状态**
   - 用 `trial/status` 返回的 `has_trial`、`active`、`start_ts`、`end_ts` 拼成前端 `UserStatus`（含 `plan: 'trial'`、`trial.is_active` 等），写入 `authStore.userStatus`。

5. **弹窗与 UI**
   - `active === true`（或 trial/start 成功且拿到 trial/status 数据）：视为试用已开通，关闭试用弹窗并执行 `runPendingActionAndClear()`，顶部/其他依赖 `userStatus` 的地方显示「试用中」。
   - 非 200 或业务失败：在试用弹窗内**明确展示后端返回的 detail**（通过 `result.message`），不吞掉错误。

---

## 二、关键请求代码位置

| 步骤 | 说明 | 文件与位置 |
|------|------|------------|
| 1) 登录保存 token | 登录成功后写 token 到 store 并持久化 | `src/stores/authStore.ts`：`login` 内 `set({ token: response.token, ... })`；`partialize` 含 `token` |
| 2) 请求基址 | 渲染进程请求同一后端 base | `src/config/authApi.ts`：`API_BASE_URL`；`src/config/authApiBase.ts`：`AUTH_API_BASE`（可配置为 `http://121.41.179.197:8000`） |
| 3) 带 Token 请求 + 非 200 透传 detail | 所有鉴权请求走这里，自动带 Bearer；错误时把后端 detail 放到 `error.message` | `src/services/apiClient.ts`：`request()`（Header `Authorization`、`!res.ok` 时解析 `detail`）、`requestWithRefresh()` |
| 4) POST /auth/trial/start | 发起开通试用 | `src/services/apiClient.ts`：`startTrial()` → `requestWithRefresh('POST', '/auth/trial/start')` |
| 5) GET /auth/trial/status | 开通成功后查状态 | `src/services/apiClient.ts`：`getTrialStatus(username)` → `requestWithRefresh('GET', '/auth/trial/status?username=...')` |
| 6) 试用流程编排 | 先 start 再 status，写 userStatus，返回成功/失败 | `src/stores/authStore.ts`：`startTrialAndRefresh()` |
| 7) 按钮与错误展示 | 点击「免费试用 7 天」、展示后端 detail、成功关闭弹窗 | `src/components/auth/SubscribeDialog.tsx`：`handleStartTrial()`、`trialError` 展示 `result.message` |

---

## 三、禁止项自检

- 未使用 mock：试用请求均走 `apiClient` 真实 `fetch`，无假数据。
- 未假成功：仅当 `startTrial()` 返回 200 且 `data.success === true` 后才调 trial/status 并视为成功。
- 未改接口路径：`/auth/trial/start`、`/auth/trial/status?username=xxx` 与后端一致。
- 未跳过 status 校验：非 200 时 `result.ok === false`，错误信息通过 `error.message` 透传到 UI。

---

## 四、类型与后端字段对应

- `apiClient`：`TrialStartResponse`（success, start_ts, end_ts）、`TrialStatusResponse`（has_trial, active, start_ts, end_ts）。
- `authStore`：将 `TrialStatusResponse` 转为 `UserStatus`（plan、trial.start_at/end_at、trial.is_active、trial.is_expired）供全局展示「试用中」。
