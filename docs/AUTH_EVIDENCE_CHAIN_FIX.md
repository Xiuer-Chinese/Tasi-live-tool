# 鉴权证据链修复交付说明

## 目标与约束（已满足）

- **注册**：POST /register 返回 200 + `{"success":true}` 时 UI 显示成功。
- **登录**：POST /login 返回 200 + `{"token":"..."}` 时拿到 token 并写入 store/本地存储。
- **失败**：UI 显示后端返回的 `detail` 或错误信息。
- **证据链**：主进程统一 `logAuthCall` 打印 requestId、URL、method、脱敏 body、status、response.data；成功条件仅依据后端返回，不使用 hasUser/hasToken 等推断。

---

## 一、修改过的关键文件列表

| 文件 | 变更摘要 |
|------|----------|
| `electron/main/services/cloudAuthClient.ts` | ① 新增 `logAuthCall(requestId, method, url, bodySanitized, status, responseData)` 统一日志；② `request()` 内生成 requestId，请求前/后打印 BEFORE/AFTER 及完整 `logAuthCall`；③ `cloudRegister` 成功条件改为 `status===200 && data.success===true`；④ `cloudLogin` 成功条件改为 `status===200 && data.token` 存在，并将 `data.token` 映射为返回的 `access_token`。 |
| `electron/main/ipc/auth.ts` | ① 注册成功：不再要求 `res.access_token && res.refresh_token && res.user` 全有，有 token 才写存储；② 登录成功：不再要求 `res.refresh_token && res.user`，仅需 `res.access_token`，无 refresh_token 时用 access_token 占位。 |
| `src/stores/authStore.ts` | ① 注册成功：仅看 `response.success === true`，不再要求 `response.user && response.token`；② 登录成功：仅看 `response.success && response.token`，无 user 时用 `safeUserFromUsername(credentials.username)`；③ 注册/登录均增加 requestId 与响应日志（含 success、status、detail）便于证据链核对。 |

---

## 二、真实运行日志示例（主进程终端）

主进程发起请求，日志在 **Electron 主进程终端**（非 DevTools Console）输出。示例：

```text
[AUTH-AUDIT] BEFORE 1738xxxxx-abc12de POST http://121.41.179.197:8000/register {"username":"test@example.com","password":"***"} 2025-02-02T12:00:00.000Z
[AUTH-AUDIT] {
  requestId: '1738xxxxx-abc12de',
  method: 'POST',
  url: 'http://121.41.179.197:8000/register',
  body: '{"username":"test@example.com","password":"***"}',
  status: 200,
  responseData: { success: true },
  timestamp: '2025-02-02T12:00:00.100Z'
}
[AUTH-AUDIT] AFTER 1738xxxxx-abc12de 200 100ms
```

登录示例：

```text
[AUTH-AUDIT] BEFORE 1738xxxxx-xyz78fg POST http://121.41.179.197:8000/login {"username":"test@example.com","password":"***"} 2025-02-02T12:00:01.000Z
[AUTH-AUDIT] {
  requestId: '1738xxxxx-xyz78fg',
  method: 'POST',
  url: 'http://121.41.179.197:8000/login',
  body: '{"username":"test@example.com","password":"***"}',
  status: 200,
  responseData: { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' },
  timestamp: '2025-02-02T12:00:01.050Z'
}
[AUTH-AUDIT] AFTER 1738xxxxx-xyz78fg 200 50ms
```

失败时（如 401）会看到 `responseData` 中含 `detail`，并透传到 UI。

---

## 三、根因说明：之前为什么显示「注册失败/登录失败」

**原因：前端成功条件与后端实际响应结构不一致。**

1. **后端实际返回**
   - **POST /register** 成功：`200` +  body `{"success": true}`，**无** `user`、`access_token`、`refresh_token`。
   - **POST /login** 成功：`200` + body `{"token": "..."}`，字段名为 **`token`** 而非 `access_token`，且**无** `user`、`refresh_token`。

2. **修复前前端逻辑**
   - **cloudAuthClient**：登录成功时按 `CloudAuthResponse` 取 `data.access_token`、`data.user`，而后端只给 `data.token`，导致 `access_token` 为 undefined，下游认为失败。
   - **IPC (auth.ts)**：注册/登录均要求 `res.access_token && res.refresh_token && res.user` 三者全有才返回成功并写存储。注册接口根本不返回这三项，登录只返回 `token`，因此 IPC 一律返回 `success: false`。
   - **authStore**：注册要求 `response.success && response.user && response.token`，登录要求 `response.success && response.user && response.token`。因 IPC 已因上一步返回失败，且后端无 `user`，导致 UI 显示「注册失败」「登录失败」。

3. **修复后**
   - **成功条件与后端一致**：注册只看 `status===200 && data.success===true`；登录只看 `status===200 && data.token` 存在，并将 `data.token` 映射为 `access_token`。
   - **不再依赖** `user`/`refresh_token` 推断成功；无 user 时登录由前端用 `safeUserFromUsername(identifier)` 补全展示用 user。
   - **错误信息**：继续使用 IPC 透传的 `detail`（来自后端 `response.data.detail`），失败时 UI 优先显示该 detail。

---

## 四、验收步骤

1. 配置 `AUTH_API_BASE_URL=http://121.41.179.197:8000`（或 `.env`），并确保 `USE_REAL_AUTH=true`（或 dev 脚本已启用真实鉴权）。
2. 启动应用，打开主进程终端（Electron 主进程 stdout）。
3. 在前端执行 **注册**：填写账号密码并提交。
   - 主进程终端应出现：`status 200`、`responseData: { success: true }`。
   - UI 应显示注册成功（不再显示「注册失败」）。
4. 在前端执行 **登录**：同一账号密码提交。
   - 主进程终端应出现：`status 200`、`responseData: { token: "..." }`。
   - DevTools Console 可见 `[AuthStore] Login response [requestId]: { success: true, hasToken: true }`。
   - token 已写入 store/本地存储，可刷新页面仍保持已登录。
5. 失败场景（如错误密码）：Network/主进程日志可见非 2xx 或 body 含 `detail`；UI 应显示「登录失败（401）：Invalid credentials」等后端 detail，而不是仅「登录失败」。

完成以上步骤即视为证据链修复验收通过。
