# 桌面应用 Auth-API 只读审计报告

---

## 1. 全项目关键词命中（与 auth-api 相关部分）

以下仅保留与「auth-api 地址 / 鉴权」直接相关的命中；npm 注册表、平台登录页等已略去。

### 1.1 `http://` / `https://` / `localhost` / `127.0.0.1`（鉴权相关）

| 文件路径 | 代码片段 |
|----------|----------|
| **src/config/authApi.ts** | `const devBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'http://127.0.0.1:8000'`<br>`const prodBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'https://your-auth-api.example.com'` |
| electron/main/app.ts | `let host = '127.0.0.1'`（用于等待 Vite 开发服务器）<br>`!validatedURL?.startsWith('http://localhost:')`（开发环境 loadURL 校验） |
| package.json | `"VITE_DEV_SERVER_URL": "http://127.0.0.1:7777/"`（仅 debug，非 auth） |
| .vscode/.debug.env | `VITE_DEV_SERVER_URL=http://127.0.0.1:7777/` |
| auth-api/.env.example | `DATABASE_URL=...@127.0.0.1:3306/...`（后端 DB，非桌面请求） |
| deploy/README.md、docs/AUTH_API_VERIFY.md、auth-api/bootstrap.sh 等 | 文档/脚本中的 `http://127.0.0.1:8000` 示例，非桌面应用源码中的默认地址 |

### 1.2 `auth` / `api` / `login` / `register`（鉴权链路）

| 文件路径 | 代码片段 |
|----------|----------|
| **src/config/authApi.ts** | `export const API_BASE_URL = import.meta.env.MODE === 'production' ? prodBase : devBase`<br>`isCloudAuthEnabled(): import.meta.env.VITE_AUTH_API_BASE_URL` |
| **src/services/apiClient.ts** | `import { API_BASE_URL } from '@/config/authApi'`<br>`const url = \`${API_BASE_URL.replace(...)}${path}\``（GET /me、POST /auth/refresh） |
| **src/stores/authStore.ts** | `window.authAPI.login(credentials)` / `window.authAPI.register(data)`；若返回 `__useMock` 则再调 `MockAuthService.login/register` |
| **electron/main/ipc/auth.ts** | `USE_MOCK_AUTH` / `USE_CLOUD_AUTH`；`auth:login` / `auth:register` 等 handle；云鉴权时调 `cloudLogin` / `cloudRegister` |
| **electron/main/services/cloudAuthClient.ts** | `getBaseUrl(): process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''`<br>`request('POST', '/auth/register'...)` / `request('POST', '/auth/login'...)` 等 |
| **electron/preload/auth.ts** | `authAPI.login` / `authAPI.register` 等；若 `USE_MOCK_AUTH` 则直接返回 `{ __useMock: true, data }`，不发起 IPC |

### 1.3 `baseURL` / `API_BASE` / `AUTH_API` / `VITE_` / `process.env` / `import.meta.env`

| 文件路径 | 代码片段 |
|----------|----------|
| **src/config/authApi.ts** | `devBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'http://127.0.0.1:8000'`<br>`prodBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'https://your-auth-api.example.com'`<br>`API_BASE_URL = import.meta.env.MODE === 'production' ? prodBase : devBase`<br>`isCloudAuthEnabled(): import.meta.env.VITE_AUTH_API_BASE_URL` |
| **electron/main/services/cloudAuthClient.ts** | `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''` |
| **electron/main/ipc/auth.ts** | `process.env.USE_MOCK_AUTH` / `process.env.NODE_ENV` / `process.env.USE_REAL_AUTH`<br>`USE_CLOUD_AUTH = !!process.env.AUTH_API_BASE_URL \|\| !!process.env.VITE_AUTH_API_BASE_URL` |
| **electron/preload/auth.ts** | `process.env.USE_MOCK_AUTH` / `process.env.NODE_ENV` / `process.env.USE_REAL_AUTH`（与 main 一致逻辑） |
| electron/main/app.ts | `process.env.VITE_DEV_SERVER_URL` / `process.env.VITE_PUBLIC`（窗口加载，非 auth） |

---

## 2. 特别检查结论

### 2.1 是否存在 mock / fake / local auth 逻辑

- **存在，且被引用。**
- **electron/main/ipc/auth.ts**（约 8–10 行）：`USE_MOCK_AUTH = process.env.USE_MOCK_AUTH === 'true' || (process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')`；在 `auth:register` / `auth:login` 等中若 `USE_MOCK_AUTH` 为 true 则直接返回 `{ __useMock: true, data }`，不调云 API 也不调本地 DB。
- **electron/preload/auth.ts**（约 6–8、17–31 行）：同一 `USE_MOCK_AUTH` 条件；为 true 时 register/login 等直接返回 `{ __useMock: true, data }`，不发起 IPC。
- **src/stores/authStore.ts**（约 76–81、155–160 行）：若 `window.authAPI.login/register` 返回带 `__useMock`，则再调用 **src/services/MockAuthService.ts** 的 `MockAuthService.login` / `MockAuthService.register`（纯内存/本地存储，无 HTTP）。
- **electron/main/ipc/auth.ts**（约 68、100 行）：当 `!USE_CLOUD_AUTH` 时走 `AuthService.register(data)` / `AuthService.login(credentials)`（本地 SQLite，**electron/main/services/AuthService.ts** + **AuthDatabase.ts**）。

### 2.2 是否存在 dev / test / production 分支

- **存在。**
- **src/config/authApi.ts**：`API_BASE_URL = import.meta.env.MODE === 'production' ? prodBase : devBase`；dev 默认 `http://127.0.0.1:8000`，production 默认 `https://your-auth-api.example.com`（均可在各自分支被 `VITE_AUTH_API_BASE_URL` 覆盖）。
- **electron/main/ipc/auth.ts** 与 **electron/preload/auth.ts**：`NODE_ENV === 'development'` 且未设 `USE_REAL_AUTH` 时 `USE_MOCK_AUTH === true`，即开发环境默认走 Mock，生产默认走真实（主进程还受 `USE_CLOUD_AUTH` 控制是否用云）。

### 2.3 是否存在未启用但仍被引用的旧 auth 实现

- **未发现“未启用但仍被引用”的旧 auth。**
- 当前两条真实鉴权路径均在使用：云鉴权（main 的 cloudLogin/cloudRegister + 渲染进程的 apiClient getMe/refresh）、本地鉴权（AuthService + AuthDatabase，main 且 USE_CLOUD_AUTH 为 false 时）。MockAuthService 仅在收到 `__useMock` 时由 authStore 调用，属于明确启用的分支。

---

## 3. 四个问题的逐条回答

### a) 当前登录/注册请求最终发往哪个 URL（完整 URL）

- **当主进程走云鉴权时（USE_CLOUD_AUTH 为 true 且 USE_MOCK_AUTH 为 false）**  
  - 登录/注册由**主进程**执行：`cloudAuthClient.getBaseUrl()` 得到 base，再请求 `POST {base}/auth/login`、`POST {base}/auth/register`。  
  - 因此**最终发往的完整 URL = `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL` 的值 + `/auth/login` 或 `/auth/register`**（主进程运行时环境变量，无默认值；若两者都未设置则 base 为空，request 直接返回错误，不发 HTTP）。

- **当渲染进程使用 API（getMe / refresh）时**  
  - 使用 **src/config/authApi.ts** 的 `API_BASE_URL`：开发构建为 `import.meta.env.VITE_AUTH_API_BASE_URL ?? 'http://127.0.0.1:8000'`；生产构建为 `import.meta.env.VITE_AUTH_API_BASE_URL ?? 'https://your-auth-api.example.com'`。  
  - 故 getMe/refresh 的完整 URL = 上述 base + `/me` 或 `/auth/refresh`（由 Vite 在构建时注入的 `import.meta.env` 决定，未注入时用上述默认）。

- **当 USE_MOCK_AUTH 为 true 或 USE_CLOUD_AUTH 为 false 且走本地 AuthService 时**  
  - Mock：不发任何 HTTP，登录/注册不发往任何 URL。  
  - 本地 AuthService：仅访问本地 SQLite，不涉及 auth-api URL。

### b) 这个 URL 是硬编码、配置文件，还是环境变量注入的

- **主进程（登录/注册云鉴权）**  
  - **完全由环境变量注入**：`process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL`（**electron/main/services/cloudAuthClient.ts** 第 12 行）。  
  - 无默认 base；未设置则 `getBaseUrl()` 返回 `''`，不发起请求。

- **渲染进程（getMe / refresh）**  
  - **由 Vite 构建时注入的 `import.meta.env` 决定**（**src/config/authApi.ts** 第 5–8 行）：可覆盖变量为 `VITE_AUTH_API_BASE_URL`；未设置时开发默认 `http://127.0.0.1:8000`，生产默认 `https://your-auth-api.example.com`（这两处为源码中的默认值，属“未配置时的回退”，不是运行时配置文件）。

- **结论**：未在代码中发现 121.41.179.197 或其它生产 IP/域名的硬编码；auth-api 的“当前实际使用地址”完全由环境变量 / 构建时变量决定。

### c) 是否存在“服务器登录失败但本地仍放行”的逻辑

- **不存在“服务器返回失败却仍当作成功放行”的逻辑。**
- 当主进程走云鉴权时：`cloudLogin`/`cloudRegister` 失败会返回 `{ success: false, error: res.error }`，IPC 和 authStore 不会把登录/注册判为成功。
- **存在的是“根本不请求服务器就放行”的逻辑**：**electron/main/ipc/auth.ts** 与 **electron/preload/auth.ts** 中，当 `USE_MOCK_AUTH === true` 时，直接返回 `{ __useMock: true, data }`，不发起任何 HTTP，随后 **authStore** 用 **MockAuthService** 在本地“登录成功”。即：在开发环境（或显式设 USE_MOCK_AUTH）下**跳过服务器校验、用 Mock 放行**，而不是“请求服务器失败后仍放行”。

### d) 桌面应用是否在任何情况下真正请求过 121.41.179.197:8000

- **代码中从未出现 121.41.179.197。** 全仓库搜索 `121.41.179.197` 和 `8000`（与 auth 相关文件）未发现该 IP。
- **因此，桌面应用只有在以下情况下才会请求 121.41.179.197:8000**：主进程在**运行桌面应用时**将环境变量 `AUTH_API_BASE_URL` 或 `VITE_AUTH_API_BASE_URL` 设为 `http://121.41.179.197:8000`；或渲染进程在**构建时**将 `VITE_AUTH_API_BASE_URL` 设为该地址（仅影响 getMe/refresh，登录/注册仍由主进程 env 决定）。
- **仅凭当前仓库代码与默认配置，桌面应用不会请求 121.41.179.197:8000。**

---

## 4. 结论摘要

### 4.1 当前 auth 模式

- **混合模式**，随环境与配置切换：  
  - **Mock**：`USE_MOCK_AUTH === true`（开发默认或显式设 USE_MOCK_AUTH）时，登录/注册不请求任何 URL，由 **MockAuthService** 在渲染进程本地放行。  
  - **本地 DB**：主进程 `USE_CLOUD_AUTH === false` 时，登录/注册走 **AuthService** + SQLite（**AuthDatabase**），无 auth-api 请求。  
  - **远程（云）**：主进程 `USE_CLOUD_AUTH === true` 且 `USE_MOCK_AUTH === false` 时，登录/注册请求 `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL` + `/auth/login`、`/auth/register`；渲染进程 getMe/refresh 请求 **authApi.ts** 的 `API_BASE_URL`（受 `import.meta.env.MODE` 与 `VITE_AUTH_API_BASE_URL` 影响）。

### 4.2 桌面应用“实际使用的 auth-api 地址”从哪里来

- **主进程（登录/注册云鉴权）**  
  - **来源**：**electron/main/services/cloudAuthClient.ts** 中 `getBaseUrl()`：`process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''`。  
  - 无默认值；未设置则 base 为空，云鉴权请求不发出。

- **渲染进程（getMe / refresh）**  
  - **来源**：**src/config/authApi.ts**：`API_BASE_URL = import.meta.env.MODE === 'production' ? prodBase : devBase`；`devBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'http://127.0.0.1:8000'`；`prodBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'https://your-auth-api.example.com'`。  
  - 即：**Vite 构建时的 `import.meta.env.VITE_AUTH_API_BASE_URL` 与 `import.meta.env.MODE`**；未设置时用上述两个默认 base。

### 4.3 阻断真实服务器校验的具体原因（文件 + 行为）

- **开发环境默认走 Mock，不请求真实服务器**  
  - **electron/main/ipc/auth.ts**（第 8–10 行）：`USE_MOCK_AUTH = process.env.USE_MOCK_AUTH === 'true' || (process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')`。  
  - **electron/preload/auth.ts**（第 6–8 行）：相同条件。  
  - **行为**：在 `NODE_ENV === 'development'` 且未设置 `USE_REAL_AUTH` 时，`USE_MOCK_AUTH` 为 true；preload 的 login/register 直接返回 `{ __useMock: true, data }`，主进程 IPC 的 login/register 也直接返回 `{ __useMock: true, data }`，**从不调用 cloudAuthClient，因此从不向任何 auth-api URL 发请求**。  
  - 结果：开发环境下即使用户本机起了一个 auth-api（例如 127.0.0.1:8000），桌面应用的登录/注册仍不会打到该服务器，除非显式设置 `USE_REAL_AUTH`（并保证主进程云鉴权 base 已配置）。

- **主进程云鉴权 base 未配置时也不请求**  
  - **electron/main/services/cloudAuthClient.ts**（第 11–23 行）：`getBaseUrl()` 返回 `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''`；若 base 为空，`request()` 直接返回 `{ status: 0, error: { code: 'invalid_params', message: 'AUTH_API_BASE_URL 未配置' } }`。  
  - **行为**：打包后若未设置 `AUTH_API_BASE_URL` 或 `VITE_AUTH_API_BASE_URL`（主进程运行时），云鉴权不会向任何 URL 发请求。

---

*以上结论均仅依据代码与调用链，未修改任何代码；所有“当前实际使用的 auth-api 地址”及“从哪里来”的表述都可由上述文件与行号佐证。*
