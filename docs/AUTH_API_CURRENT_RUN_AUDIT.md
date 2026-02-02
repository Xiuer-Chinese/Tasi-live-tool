# 当前运行配置下 Auth-API 请求审计

本文档回答：桌面应用在「当前运行配置」下，登录/注册/checkAuth 是否实际向 auth-api 发起 HTTP 请求，以及完整 base URL 来源与可复现验证方式。

---

## 1️⃣ 静态代码审计

### 1.1 login / register / checkAuth / refresh 完整调用链

| 操作 | 调用链 | 实际发 HTTP 的位置（若未短路） |
|------|--------|-------------------------------|
| **login** | `authStore.login` → `window.authAPI.login(credentials)` → preload `authAPI.login` → 若未 Mock 则 `ipcRenderer.invoke('auth:login')` → main `auth:login` handler → 若云鉴权则 `cloudLogin()` → `cloudAuthClient.request('POST','/auth/login',…)` → **主进程 fetch(url)** | 主进程 **cloudAuthClient.request** 内 `fetch(url)` |
| **register** | `authStore.register` → `window.authAPI.register(data)` → preload `authAPI.register` → 若未 Mock 则 `ipcRenderer.invoke('auth:register')` → main `auth:register` handler → 若云鉴权则 `cloudRegister()` → `cloudAuthClient.request('POST','/auth/register',…)` → **主进程 fetch(url)** | 同上 |
| **checkAuth** | `authStore.checkAuth` → 无 token 则直接未登录；有 token 则 `getMe()` → **apiClient.requestWithRefresh('GET','/me')** → **apiClient.request** 内 **fetch(url)**（渲染进程） | 渲染进程 **apiClient.request** 内 `fetch(url)`；若 401 则 **doRefresh** → **request('POST','/auth/refresh',…)** → 同上 fetch |
| **refresh** | 仅在被 getMe 触发 401 时：`apiClient.doRefresh` → `request('POST','/auth/refresh',…)` → **apiClient.request** 内 **fetch(url)** | 渲染进程 **apiClient.request** |

- **主进程**：login/register/restoreSession/getCurrentUser/validateToken 的云鉴权分支 → **electron/main/services/cloudAuthClient.ts** 的 `request()` → `fetch(url)`。
- **渲染进程**：getMe、refresh（POST /auth/refresh）→ **src/services/apiClient.ts** 的 `request()` → `fetch(url)`。

### 1.2 短路到 MockAuth 或本地 AuthService 的条件

| 层级 | 条件 | 行为 |
|------|------|------|
| **Preload** | `USE_MOCK_AUTH === true` | login/register/validateToken/getCurrentUser/logout 直接返回 `{ __useMock: true, data }`，**不发起 IPC**；authStore 收到后调用 **MockAuthService**（无 HTTP）。 |
| **Main IPC** | `USE_MOCK_AUTH === true` | auth:login/register/… 直接返回 `{ __useMock: true, data }`，**不调用 cloudAuthClient 也不调用 AuthService**。 |
| **Main IPC** | `USE_CLOUD_AUTH === false` | auth:login/register 走 **AuthService.login/register**（本地 SQLite，**electron/main/services/AuthService.ts** + AuthDatabase），**不调用 cloudAuthClient**。 |

- **USE_MOCK_AUTH**：`process.env.USE_MOCK_AUTH === 'true'` 或 `(process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')`（**electron/main/ipc/auth.ts** 第 8–10 行，**electron/preload/auth.ts** 第 6–8 行）。
- **USE_CLOUD_AUTH**：`!!process.env.AUTH_API_BASE_URL || !!process.env.VITE_AUTH_API_BASE_URL`（**electron/main/ipc/auth.ts** 第 12 行）。

### 1.3 走 cloudAuthClient 的条件

- **主进程**：`USE_MOCK_AUTH === false` 且 `USE_CLOUD_AUTH === true` 时，auth:login/register/restoreSession/getCurrentUser/validateToken 会调用 **cloudLogin / cloudRegister / cloudRefresh / cloudMe**，即 **cloudAuthClient.request()** → `fetch(url)`。
- **渲染进程**：无 Mock 开关；只要调用了 getMe/doRefresh，就会用 **apiClient.request()** 向 **API_BASE_URL**（见下）发请求。

### 1.4 auth-api base URL 的唯一来源

| 用途 | 唯一来源 | 默认值 |
|------|----------|--------|
| **主进程**（login/register/refresh/me 云鉴权） | **electron/main/services/cloudAuthClient.ts**：`getBaseUrl()` = `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''` | **无**；未设置则为空串，request 直接返回错误，不发 HTTP。 |
| **渲染进程**（getMe、POST /auth/refresh） | **src/config/authApi.ts**：`API_BASE_URL = import.meta.env.MODE === 'production' ? prodBase : devBase`，其中 `devBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'http://127.0.0.1:8000'`，`prodBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'https://your-auth-api.example.com'` | 开发：`http://127.0.0.1:8000`；生产：`https://your-auth-api.example.com`（仅当未设置 VITE_AUTH_API_BASE_URL 时）。 |

- 环境变量名：主进程 **AUTH_API_BASE_URL**、**VITE_AUTH_API_BASE_URL**（主进程读取的是运行时 process.env）；渲染进程为 Vite 构建时注入的 **VITE_AUTH_API_BASE_URL** 与 **import.meta.env.MODE**。

---

## 2️⃣ 运行时可验证方案（可复现）

已在代码中增加**临时、可删除**的审计日志（前缀 `[AUTH-AUDIT]`），在真正发起 fetch 之前打印，便于不依赖人工观察、通过控制台或文件确认是否发出请求及最终 URL。

### 2.1 主进程

- **启动时**（**electron/main/ipc/auth.ts**）：在 `setupAuthHandlers()` 内打印一次当前配置：
  - `USE_MOCK_AUTH`、`USE_CLOUD_AUTH`
  - `AUTH_API_BASE_URL`、`VITE_AUTH_API_BASE_URL`、有效 base（用于云鉴权的完整 base，无则显示 `(none)`）
- **发起请求前**（**electron/main/services/cloudAuthClient.ts**）：在 `request()` 内、在 `fetch(url)` 之前打印：
  - `process.type`（主进程下为 `browser` 或 `main`）
  - 最终拼接后的 **完整 URL**

查看方式：运行 `npm run dev` 时，主进程日志在**启动该应用的终端**中输出。

### 2.2 渲染进程

- **发起请求前**（**src/services/apiClient.ts**）：在 `request()` 内、在 `fetch(url)` 之前打印：
  - `process.type`（渲染进程下为 `renderer`，若不可用则显示 `renderer`）
  - 最终拼接后的 **完整 URL**

查看方式：运行 `npm run dev` 后，打开**开发者工具（DevTools）控制台**，在渲染进程控制台中可见。

### 2.3 复现步骤

1. 执行 `npm run dev`。
2. 看**终端**：若出现 `[AUTH-AUDIT] startup config:`，则记录当前 USE_MOCK_AUTH、USE_CLOUD_AUTH 与 effectiveBase；若随后出现 `[AUTH-AUDIT] process.type= ... final URL= ...`，表示主进程向该 URL 发起了请求。
3. 进行登录/注册或触发 checkAuth（getMe/refresh）。
4. 看**渲染进程控制台**：若出现 `[AUTH-AUDIT] process.type= renderer final URL= ...`，表示渲染进程向该 URL 发起了请求。
5. 若始终无 `final URL` 的审计日志，则对应进程未向 auth-api 发起 HTTP 请求。

---

## 3️⃣ 自动判断当前配置

当前构建/运行环境（以默认 `npm run dev` 为例）下：

- **USE_MOCK_AUTH**：由 `process.env.USE_MOCK_AUTH === 'true'` 或 `(process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')` 决定。  
  - 开发时通常 **NODE_ENV=development** 且未设 **USE_REAL_AUTH** → **USE_MOCK_AUTH = true**。
- **USE_CLOUD_AUTH**：由 `!!process.env.AUTH_API_BASE_URL || !!process.env.VITE_AUTH_API_BASE_URL` 决定。  
  - 未在启动命令或环境中设置这两项时 → **USE_CLOUD_AUTH = false**。
- **AUTH_API_BASE_URL / VITE_AUTH_API_BASE_URL**：主进程为**运行时** process.env；未设置则主进程 base 为空。  
  - 渲染进程为 Vite **构建时** `import.meta.env.VITE_AUTH_API_BASE_URL`；未设置时开发默认 `http://127.0.0.1:8000`，生产默认 `https://your-auth-api.example.com`。

**明确结论（默认 npm run dev、未设任何 auth 相关环境变量）：**

- **当前是否使用 auth-api（登录/注册）：否**  
  - 原因：preload 层 **USE_MOCK_AUTH = true**（development 且未设 USE_REAL_AUTH），login/register 直接返回 `__useMock`，不发起 IPC，主进程不执行，**从不调用 cloudAuthClient**。
- **当前是否使用 auth-api（checkAuth 的 getMe/refresh）：可能**  
  - 渲染进程 getMe/refresh 使用 **API_BASE_URL**（开发默认 `http://127.0.0.1:8000`），只要调用了 getMe 就会向该 base 发请求；但若登录走 Mock，通常无有效 token，checkAuth 可能不发起 getMe 或很快失败。
- **若使用 auth-api 时，完整 URL 是什么**  
  - 登录/注册：主进程 **effectiveBase + `/auth/login`** 或 **`/auth/register`**（effectiveBase = `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL`，当前未设则为空，故当前**未使用**）。  
  - getMe/refresh：渲染进程 **API_BASE_URL + `/me`** 或 **`/auth/refresh`**（开发默认 base = `http://127.0.0.1:8000`）。
- **若未使用（登录/注册短路），短路发生在**：**preload**（USE_MOCK_AUTH 为 true 时）。

**自动判断当前配置（可复现）**：运行 `npm run dev` 后，在**启动该应用的终端**中查看首次出现的 `[AUTH-AUDIT] startup config:` 输出，即可得到 **USE_MOCK_AUTH**、**USE_CLOUD_AUTH**、**effectiveBase** 的实际值；据此可明确「当前是否使用 auth-api」及「完整 URL」（若 effectiveBase 为 `(none)` 则登录/注册未向 auth-api 发请求）。若随后有 `[AUTH-AUDIT] process.type= ... final URL= ...`，则说明主进程向该 URL 发起了请求。渲染进程的请求可在 DevTools 控制台查看相同前缀的日志。

实际运行时可依赖 **2️⃣** 中 `[AUTH-AUDIT] startup config:` 与 `final URL` 的输出来确认上述结论。

---

## 4️⃣ 最终结论区（一句话可看懂）

- **当前登录/注册是否走 auth-api：否**
- **原因：** preload 层 **USE_MOCK_AUTH = true**（development 模式且未设 USE_REAL_AUTH），login/register 直接返回 `__useMock`，不发起 IPC，不发起网络请求。
- **实际生效的 auth-api 地址（登录/注册）：无**（未向 auth-api 发起登录/注册的 HTTP 请求）。

（checkAuth 中的 getMe/refresh 使用渲染进程 **API_BASE_URL**，开发默认 `http://127.0.0.1:8000`；仅在调用 getMe 且未在 preload 短路时才会发出请求，且与“登录/注册是否走 auth-api”独立。）

---

*本文档为运行路径审计，不涉及功能改造、收费逻辑或架构重构。审计用日志前缀为 `[AUTH-AUDIT]`，可在确认后统一删除。*
