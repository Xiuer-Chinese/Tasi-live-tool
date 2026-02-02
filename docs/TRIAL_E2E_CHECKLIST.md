# 试用闭环端到端验收清单

本文档提供可复现的端到端验收步骤、预期输出与命令示例（curl）。不涉及支付/订阅/订单。

## 前提

- 7 天试用闭环已实现：`GET /auth/status`（含 trial）、`POST /auth/trial/start`、前端门控/弹窗。
- 调试接口 `POST /auth/trial/debug/expire` 仅在 **ENABLE_ADMIN_DEBUG=true** 时可用。

---

## 1. 新用户注册登录 → 非测试平台 → 弹窗 → 点「免费试用 7 天」→ 切换成功

**步骤：**

1. 使用未开通试用的账号登录（或新注册后登录）。
2. 在应用内选择「非测试平台」（需试用门控的平台）。
3. 预期：弹出订阅/试用弹窗（开通试用）。
4. 点击「免费试用 7 天」。
5. 预期：
   - 请求 `POST /auth/trial/start` 成功（200）。
   - 弹窗关闭，执行待执行动作（如切换平台）。
   - 控制台可见 `[USER-STATUS]` 等日志，`userStatus.trial` 为已开通状态。

**验证：**

- 再次调用 `GET /auth/status`（见下方 curl），响应中 `trial.is_active === true`，`trial.is_expired === false`。

---

## 2. 调用 debug expire → 刷新 userStatus → 自动弹「试用已结束」

**步骤：**

1. 在已开通试用且未到期的前提下，调用 **POST /auth/trial/debug/expire**（需先设置 `ENABLE_ADMIN_DEBUG=true` 并携带 access_token，见下方 curl）。
2. 预期：接口 200，返回的 `trial.is_expired === true`（或 `trial_end_at` 为过去时间）。
3. 在客户端：刷新页面或触发重新拉取用户状态（如重新进入需门控的页面），应拉取 `GET /auth/status` 得到已过期状态。
4. 预期：自动弹出「试用已结束」弹窗（文案为试用已结束，可再次开通试用云云）。

**注意：** 未设置 `ENABLE_ADMIN_DEBUG=true` 时，`POST /auth/trial/debug/expire` 返回 404。

---

## 3. 在「试用已结束」弹窗点「免费试用 7 天」→ 明确提示「试用已使用完毕」，不放行

**步骤：**

1. 保持上一步「试用已结束」状态（已调用过 debug/expire，且未再改库）。
2. 在弹窗中点击「免费试用 7 天」。
3. 预期：
   - 请求 `POST /auth/trial/start` 返回 **409**，body 含 `"code": "trial_already_used"`。
   - 弹窗**不关闭**，弹窗内展示错误文案：**「试用已使用完毕，如需继续使用请升级」**。
   - **不**执行切换平台等待执行动作（不放行）。

---

## 4. 命令示例（curl）

以下将 `BASE_URL` 替换为实际鉴权服务地址（如 `http://121.41.179.197:8000` 或 `http://localhost:8000`），`ACCESS_TOKEN` 替换为登录后获得的 access_token。

### GET /auth/status

```bash
curl -s -X GET "%BASE_URL%/auth/status" -H "Authorization: Bearer %ACCESS_TOKEN%"
```

**预期（已开通且未过期）：** 200，JSON 中含 `trial`，例如 `"trial": { "is_active": true, "is_expired": false }`。

**预期（已过期）：** 200，`trial.is_expired === true`。

---

### POST /auth/trial/start

**首次开通或试用中（幂等）：**

```bash
curl -s -X POST "%BASE_URL%/auth/trial/start" -H "Authorization: Bearer %ACCESS_TOKEN%" -H "Content-Type: application/json"
```

- 首次开通：200，返回当前用户 status，含 `trial`。
- 已在试用中（未到期）：200，幂等返回当前 status。

**已过期后再次点击「免费试用 7 天」：**

- 预期：**409**，响应体示例：
  ```json
  { "detail": { "code": "trial_already_used", "message": "trial ended; cannot restart" } }
  ```

---

### POST /auth/trial/debug/expire（仅 ENABLE_ADMIN_DEBUG=true）

**仅在服务端设置环境变量 `ENABLE_ADMIN_DEBUG=true` 时可用**，用于将当前用户的 `trial_end_at` 设为过去时间（如 now - 1 minute），便于验收「试用已结束」弹窗与「不可再次试用」提示。

```bash
curl -s -X POST "%BASE_URL%/auth/trial/debug/expire" -H "Authorization: Bearer %ACCESS_TOKEN%" -H "Content-Type: application/json"
```

- **ENABLE_ADMIN_DEBUG=true**：预期 200，返回的 status 中 `trial.is_expired === true`。
- **未设置或为 false**：预期 **404**（Not found）。

---

## 5. 验收检查表（简要）

| 场景 | 预期 |
|------|------|
| 新用户点「免费试用 7 天」 | 200，弹窗关闭，可切换平台 |
| 试用中再次点「免费试用 7 天」 | 200 幂等，行为同上 |
| 调用 debug/expire 后刷新状态 | 自动弹「试用已结束」 |
| 试用已结束后点「免费试用 7 天」 | 409，弹窗内提示「试用已使用完毕，如需继续使用请升级」，不关闭、不放行 |
| debug/expire 未开环境变量 | 404 |

---

## 6. 约束说明

- 不做支付、订阅、订单表。
- 不新增后台 UI。
- 平台门控主逻辑不变，仅补齐错误提示与调试通道。
