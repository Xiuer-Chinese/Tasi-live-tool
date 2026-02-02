# 前端 → auth-api 最终对接校验

**基准**：`http://121.41.179.197:8000`，后端仅支持 `POST /login`、`POST /register`（无 `/auth` 前缀），请求体 `{"username":"...","password":"..."}`。

---

## 一、修改的文件列表与关键 diff

### 1. `src/config/authApiBase.ts`（新增）

- **作用**：唯一集中配置 auth-api 基准地址。
- **内容**：
  ```ts
  export const AUTH_API_BASE = 'http://121.41.179.197:8000'
  ```
- 所有登录/注册请求均使用 `AUTH_API_BASE` 拼接：`POST ${API_BASE}/login`、`POST ${API_BASE}/register`。

### 2. `electron/main/services/cloudAuthClient.ts`

- **基准地址**：删除 `DEFAULT_PRODUCTION_AUTH_API_BASE_URL`，改为从 `src/config/authApiBase` 引入 `AUTH_API_BASE`；`getBaseUrl()` 使用 `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? AUTH_API_BASE`，打包后无 env 时用 `AUTH_API_BASE`。
- **路径**：保持 `AUTH_ENDPOINTS = { login: '/login', register: '/register' }`，无 `/auth` 前缀。
- **请求体**：登录/注册仍只发 `{ username: identifier, password }`。
- **对接审计日志**：
  - 请求前：`[AUTH-AUDIT] method url body(脱敏) timestamp`（password 脱敏为 `***`）。
  - 请求后：`[AUTH-AUDIT] status responseBody(or statusText) duration_ms`。
  - 网络异常：`[AUTH-AUDIT] NETWORK_ERROR errName message duration_ms`。

### 3. `electron/main/ipc/auth.ts`

- **USE_CLOUD_AUTH**：改为基于 `getEffectiveBase()`（`process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? AUTH_API_BASE`），有 base 即走云鉴权。
- **logAuthAuditConfig**：启动时打印 `AUTH_API_BASE` 与 `effectiveBase`。

### 4. `src/config/authApi.ts`

- **API_BASE_URL**：改为 `import.meta.env.VITE_AUTH_API_BASE_URL ?? AUTH_API_BASE`，与 `authApiBase.ts` 一致。
- **isCloudAuthEnabled**：同样以 `AUTH_API_BASE` 为默认。

---

## 二、禁止项校验结果

- 代码中已无 `http://login` 等错误 host。
- 代码中已无 `/auth/login`、`/auth/register` 前缀（仅 `/login`、`/register`）。
- 登录/注册请求体仅含 `username`、`password`；UI 手机号/邮箱/账号名均映射到 `username`。

---

## 三、登录/注册按钮点击时控制台 [AUTH-AUDIT] 日志示例

**说明**：鉴权请求在主进程发起，日志出现在**运行 `npm run dev` 的终端**，不在渲染进程 DevTools Console。

### 点击「注册」后

**请求前（点击后立即）：**
```
[AUTH-AUDIT] POST http://121.41.179.197:8000/register {"username":"15611111111","password":"***"} 2025-02-02T12:00:00.000Z
```

**请求后（成功 200）：**
```
[AUTH-AUDIT] 200 {"user":{...},"access_token":"...","refresh_token":"..."} 150ms
```

**请求后（失败 422）：**
```
[AUTH-AUDIT] 422 {"detail":[{"loc":["body","password"],"msg":"password too short"}]} 80ms
```

**网络错误（无法连接/超时/CORS 等）：**
```
[AUTH-AUDIT] NETWORK_ERROR TypeError Failed to fetch 5000ms
```

### 点击「登录」后

**请求前：**
```
[AUTH-AUDIT] POST http://121.41.179.197:8000/login {"username":"15611111111","password":"***"} 2025-02-02T12:01:00.000Z
```

**请求后（成功 200）：**
```
[AUTH-AUDIT] 200 {"user":{...},"access_token":"...","refresh_token":"..."} 120ms
```

**请求后（失败 401）：**
```
[AUTH-AUDIT] 401 {"detail":{"code":"wrong_password","message":"用户名或密码错误"}} 50ms
```

---

## 四、成功/失败判定（已满足）

- **register**：HTTP 200 且响应体含 `user`、`access_token` 等预期字段视为成功；非 200 或无预期字段则失败，UI 展示后端 `detail`。
- **login**：以 HTTP 200 为成功基准，同上；失败时展示后端 `detail`。
- 当前实现不会出现「后端 200 但 UI 显示失败」：主进程在 200 时返回 `data`，前端据此置成功并关弹窗。

---

## 五、手动验证步骤

1. **启动**  
   - 终端执行：`npm run dev`。  
   - 确认终端出现：`[AUTH-AUDIT] startup config: { ..., AUTH_API_BASE: 'http://121.41.179.197:8000', effectiveBase: 'http://121.41.179.197:8000' }`。

2. **验证注册**  
   - 在桌面端打开注册弹窗，输入手机号/邮箱（如 `15611111111`）和密码（≥6 位）。  
   - 点击「注册」。  
   - **看终端**（不是 DevTools）：  
     - 应出现一行：`[AUTH-AUDIT] POST http://121.41.179.197:8000/register {"username":"15611111111","password":"***"} <ISO时间>`。  
     - 随后一行：`[AUTH-AUDIT] 200 <响应片段> <N>ms` 或 `[AUTH-AUDIT] 4xx <detail片段> <N>ms`。  
   - **预期**：若账号未存在且密码合法，为 200 且 UI 显示成功；若 422/409 等，UI 显示「注册失败（status）：后端 detail（请求地址：...）」。

3. **验证登录**  
   - 使用刚注册的账号或任意已存在账号，在登录弹窗输入账号与密码，点击「登录」。  
   - **看终端**：  
     - 应出现：`[AUTH-AUDIT] POST http://121.41.179.197:8000/login {"username":"...","password":"***"} <ISO时间>`。  
     - 随后：`[AUTH-AUDIT] 200 ...` 或 `[AUTH-AUDIT] 401 ...` 等。  
   - **预期**：正确账号密码为 200 且进入应用；错误密码为 401，UI 显示带 status 与 detail 的失败信息。

4. **验证错误基址/路径已移除**  
   - 全局搜索代码（不含文档）：`/auth/login`、`/auth/register`、`http://login`，应无匹配。  
   - 终端 [AUTH-AUDIT] 中的 URL 必须为 `http://121.41.179.197:8000/login` 与 `http://121.41.179.197:8000/register`。

5. **可选：断网/错误 base 测网络错误**  
   - 断网或临时改 `AUTH_API_BASE` 为无效地址后重试登录/注册，终端应出现 `[AUTH-AUDIT] NETWORK_ERROR ...` 及 duration_ms。

完成以上步骤即视为前端 → auth-api 最终对接校验通过。
