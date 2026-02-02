# 真实服务器登录/注册连通 — 最小修复说明（可回滚）

本次仅做：开发态不再短路到 Mock、配置云鉴权 base、主进程请求路径与服务器对齐、保留审计日志。不做订阅/收费、不改 UI/门控。

---

## 改动点与 diff 摘要（便于回滚）

### 1. package.json

**路径**: `package.json`

**变更**:
- `scripts.dev`: 由 `"vite"` 改为通过 `cross-env` 注入环境变量后执行 `vite`，使 Electron 主进程与 preload 在开发态拿到：
  - `USE_REAL_AUTH=true`
  - `USE_MOCK_AUTH=false`
  - `AUTH_API_BASE_URL=http://121.41.179.197:8000`
  - `VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000`
- `devDependencies`: 新增 `"cross-env": "^7.0.3"`（保证 Windows/Unix 下 dev 脚本环境变量一致）。

**回滚**: 将 `dev` 改回 `"vite"`，并删除 `cross-env` 依赖（可选）。

---

### 2. electron/main/services/cloudAuthClient.ts

**路径**: `electron/main/services/cloudAuthClient.ts`

**变更**:
- 云鉴权请求路径与服务器一致（服务器为 `/login`、`/register`）：
  - `'/auth/register'` → `'/register'`
  - `'/auth/login'` → `'/login'`
- 仅改上述两条，未改 `/auth/refresh`、`/me`。
- 审计日志格式统一为：`[AUTH-AUDIT] <process> <method> <full_url>`（在 `request()` 内、`fetch(url)` 前打印）。

**回滚**: 将 `'/register'` 改回 `'/auth/register'`，`'/login'` 改回 `'/auth/login'`；审计日志可按需还原或删除。

---

### 3. src/services/apiClient.ts

**路径**: `src/services/apiClient.ts`

**变更**:
- 审计日志格式统一为：`[AUTH-AUDIT] <process> <method> <full_url>`（在 `request()` 内、`fetch(url)` 前打印）。

**回滚**: 仅日志格式，可按需还原或删除。

---

## 交付验收（可复制结果）

### 1) 启动后终端首次出现的配置

执行：

```bash
npm install
npm run dev
```

在**启动桌面应用的终端**中，应看到首次出现的 `[AUTH-AUDIT] startup config:`，例如：

```
[AUTH-AUDIT] startup config: {
  USE_MOCK_AUTH: false,
  USE_CLOUD_AUTH: true,
  AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  VITE_AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  effectiveBase: 'http://121.41.179.197:8000'
}
```

请复制你侧实际输出的：**USE_MOCK_AUTH / USE_CLOUD_AUTH / effectiveBase**。

---

### 2) 注册 + 登录后的审计日志

在桌面端执行一次「注册」再「登录」后，在同一终端中应出现两条审计日志，例如：

```
[AUTH-AUDIT] browser POST http://121.41.179.197:8000/register
[AUTH-AUDIT] browser POST http://121.41.179.197:8000/login
```

（主进程在 Electron 下 `process.type` 常为 `browser`，若为 `main` 也会是主进程。）

请贴出你侧实际出现的这两条（或等价的两行）日志。

---

### 3) 服务器侧验证

此时在 auth-api 所在机器上执行：

```bash
docker logs <auth-api 容器名或 ID> 2>&1 | tail -50
```

应能看到新增的：

- `POST /register`（或 `/auth/register`，取决于网关/路由）
- `POST /login`（或 `/auth/login`）

用于确认桌面端已向真实服务器发起注册与登录请求。

---

## 约束与说明

- 未做订阅/收费逻辑。
- 未改现有 UI/门控逻辑。
- 若你方服务器实际路径为 `/auth/login`、`/auth/register`，请将 `cloudAuthClient.ts` 中 `'/login'`、`'/register'` 改回 `'/auth/login'`、`'/auth/register'` 即可回滚路径部分。
