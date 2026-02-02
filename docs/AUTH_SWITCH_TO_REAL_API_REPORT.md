# 从 Mock 切换到真实 auth-api — 执行报告（最小改动）

**日期**: 2025-02-02  
**目标**: 在保留 Mock 能力的前提下，使指定运行条件下桌面应用真实调用 http://121.41.179.197:8000，服务器能收到 /register、/login。  
**约束**: 不改订阅/收费、不改 UI、不重构 authStore。

---

## 一、已完成的改动（文件路径 + diff 摘要）

### A. 显式鉴权模式开关（核心）

| 文件路径 | 变更摘要 |
|----------|----------|
| **electron/preload/auth.ts** | `USE_MOCK_AUTH` 逻辑改为：当 `process.env.USE_REAL_AUTH === 'true'` 时**强制** `USE_MOCK_AUTH = false`；否则沿用原逻辑（`USE_MOCK_AUTH === 'true'` 或 `NODE_ENV === 'development' && USE_REAL_AUTH !== 'true'`）。preload 在 USE_REAL_AUTH 为 true 时不得短路 __useMock。 |
| **electron/main/ipc/auth.ts** | 同上：`USE_REAL_AUTH === 'true'` 时强制 `USE_MOCK_AUTH = false`，与 preload 约定一致。 |

**diff 摘要**：

- **preload/auth.ts**（约第 4–11 行）  
  - 原：`const USE_MOCK_AUTH = process.env.USE_MOCK_AUTH === 'true' \|\| (process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')`  
  - 现：`const USE_MOCK_AUTH = process.env.USE_REAL_AUTH === 'true' ? false : (process.env.USE_MOCK_AUTH === 'true' \|\| (...))`，并增加注释“显式鉴权模式开关”。

- **main/ipc/auth.ts**（约第 7–14 行）  
  - 原：同上单行 `USE_MOCK_AUTH`。  
  - 现：同上三元表达式 + 注释“显式鉴权模式开关：USE_REAL_AUTH === 'true' 时强制 USE_MOCK_AUTH = false”。

### B. 注入真实服务器地址（未改代码，仅确认）

- **来源**：仅允许 `AUTH_API_BASE_URL`、`VITE_AUTH_API_BASE_URL`（主进程：`electron/main/services/cloudAuthClient.ts` 的 `getBaseUrl()`；渲染进程：`src/config/authApi.ts` 的 `API_BASE_URL`，由 Vite 注入 `VITE_AUTH_API_BASE_URL`）。
- **可打印**：主进程启动时 `[AUTH-AUDIT] startup config` 含 `effectiveBase`；发起请求前 `[AUTH-AUDIT] <process> <method> <full_url>` 含完整 URL。
- **注入方式**：`package.json` 的 dev 脚本已通过 cross-env 注入上述变量（本次未改）。

### C. 接口路径对齐（已满足，未改）

- **当前代码**：`electron/main/services/cloudAuthClient.ts` 中 `cloudRegister` 使用 `POST '/register'`，`cloudLogin` 使用 `POST '/login'`（约第 74、102 行）。
- **与服务器一致**：真实服务器为 POST /register、POST /login；未新增 refresh/me/订阅逻辑。

### D. 审计日志（已满足，未改）

- **主进程**：`cloudAuthClient.ts` 的 `request()` 内、`fetch(url)` 前：`console.log('[AUTH-AUDIT]', process.type ?? 'main', method, url)`。
- **渲染进程**：`src/services/apiClient.ts` 的 `request()` 内、`fetch(url)` 前：`console.log('[AUTH-AUDIT]', processType ?? 'renderer', method, url)`。
- 格式为 `[AUTH-AUDIT] <process> <method> <full_url>`。

---

## 二、交付验收（必须做到）

### 1. 本地运行（dev 或打包运行）

- **条件**：运行前需让 Electron 主进程/preload 拿到 `USE_REAL_AUTH=true` 及云鉴权 base（如 `AUTH_API_BASE_URL=http://121.41.179.197:8000`、`VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000`）。  
  - **dev**：在项目根执行 `npm run dev`（脚本已通过 cross-env 注入上述变量）。  
  - **打包运行**：见 `docs/PROD_AUTH_ENV.md`，在启动 exe 前设置相同环境变量。
- **验收**：在桌面端执行一次「注册（新用户名）」→「登录」后，在运行 dev 的终端（或打包运行时的主进程日志）中应出现：
  - `[AUTH-AUDIT] ... POST http://121.41.179.197:8000/register`
  - `[AUTH-AUDIT] ... POST http://121.41.179.197:8000/login`

### 2. 服务器侧

- **验收**：在 auth-api 所在机器执行 `docker compose logs --tail=80 auth-api`，应看到新的 **POST /register**、**POST /login** 请求。

### 3. 清空 users.db 后再次注册

- **验收**：清空服务器 `users` 表后，在桌面端再次注册新用户；在服务器执行 Python 查询（或等效）确认 `users.db` 中重新出现新用户记录。

---

## 三、回滚要点

| 改动 | 回滚方式 |
|------|----------|
| preload/auth.ts | 将 `USE_MOCK_AUTH` 恢复为单行：`process.env.USE_MOCK_AUTH === 'true' \|\| (process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')` |
| main/ipc/auth.ts | 同上，恢复原单行 `USE_MOCK_AUTH` 定义 |

---

## 四、若仍无请求时的排查

- 若按上述方式运行后终端仍无 `[AUTH-AUDIT] ... POST .../register`、`.../login`：
  1. 查看终端是否出现 `[AUTH-AUDIT] startup config`，确认其中 `USE_MOCK_AUTH`、`USE_CLOUD_AUTH`、`effectiveBase` 的值。
  2. 若 `USE_MOCK_AUTH` 仍为 true 或 `effectiveBase` 为 `(none)`，说明 Electron 进程未收到 env：请确认在同一 shell 中执行 `npm run dev`（勿在 IDE 中单独启动 Electron 且未继承 env）；打包运行则需在启动 exe 前设置环境变量（见 `docs/PROD_AUTH_ENV.md`）。

---

*本报告仅记录本次最小改动与验收步骤，未改订阅/收费、未改 UI、未重构 authStore。*
