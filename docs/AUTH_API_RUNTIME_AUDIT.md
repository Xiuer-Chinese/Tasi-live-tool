# 强制审计：桌面应用运行时实际使用的 auth-api 地址

**约束**：未修改任何代码；结论基于代码与运行路径，无假设。

---

## 一、代码层确认（逐文件）

### 1.1 所有可能决定 auth-api 地址的来源

| 来源类型 | 文件 | 变量/表达式 | 作用范围 |
|----------|------|-------------|----------|
| **import.meta.env** | src/config/authApi.ts 第 5-8 行 | `VITE_AUTH_API_BASE_URL`（可选）、`MODE` | 仅渲染进程；Vite 构建时注入，运行时只读 |
| | | `devBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'http://127.0.0.1:8000'` | 开发构建未注入时的默认值 |
| | | `prodBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'https://your-auth-api.example.com'` | 生产构建未注入时的默认值 |
| | | `API_BASE_URL = MODE === 'production' ? prodBase : devBase` | 渲染进程 getMe/refresh 使用的 base |
| **process.env**（主进程） | electron/main/services/cloudAuthClient.ts 第 12 行 | `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''` | 主进程云鉴权 HTTP 请求的 base；**无默认值**，未设置则为空串 |
| **process.env**（主进程） | electron/main/ipc/auth.ts 第 12 行 | `USE_CLOUD_AUTH = !!process.env.AUTH_API_BASE_URL \|\| !!process.env.VITE_AUTH_API_BASE_URL` | 主进程是否走云鉴权 |
| **process.env**（preload） | electron/preload/auth.ts 第 6-8 行 | `USE_MOCK_AUTH = process.env.USE_MOCK_AUTH === 'true' \|\| (process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')` | 是否在 preload 层直接返回 __useMock，不发起 IPC |
| **process.env**（主进程） | electron/main/ipc/auth.ts 第 8-10 行 | 同上 USE_MOCK_AUTH | 主进程是否在 IPC 内直接返回 __useMock，不调 cloud* |
| **默认 fallback** | src/config/authApi.ts | 仅渲染进程：dev 时 `'http://127.0.0.1:8000'`，prod 时 `'https://your-auth-api.example.com'` | 仅当未设置 VITE_AUTH_API_BASE_URL 时生效；**主进程无 fallback** |

### 1.2 登录/注册 vs 用户状态类接口（getMe / check / refresh）

| 请求类型 | 入口 | 执行进程 | 使用的 base 来源 | 是否可能发 HTTP |
|----------|------|----------|------------------|-----------------|
| **登录 login** | authStore.login → window.authAPI.login | 先 preload，再（若未短路）主进程 IPC | 主进程：getBaseUrl() = process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? '' | 仅当 USE_MOCK_AUTH 为 false 且 USE_CLOUD_AUTH 为 true 且 base 非空 |
| **注册 register** | authStore.register → window.authAPI.register | 同上 | 同上 | 同上 |
| **getMe** | authStore.checkAuth → getMe() | 渲染进程（apiClient） | API_BASE_URL（authApi.ts，import.meta.env） | 仅当调用 getMe 且 API_BASE_URL 有效时 |
| **refresh** | apiClient.doRefresh | 渲染进程 | 同上 | 同上 |
| **restoreSession** | 启动时 auth:restoreSession | 主进程 IPC | 主进程 getBaseUrl() | 仅当 USE_CLOUD_AUTH 为 true 且 base 非空 |

### 1.3 请求发生的进程

| 操作 | 第一层 | 第二层 | 第三层 | 实际发 HTTP 的进程（若发） |
|------|--------|--------|--------|---------------------------|
| 登录/注册 | 渲染进程 authStore | preload authAPI.login/register | 主进程 ipc auth:login/register → cloudAuthClient 或 AuthService | **主进程**（仅云鉴权且 base 已配置时） |
| getMe / refresh | 渲染进程 apiClient | 直接 fetch(API_BASE_URL + path) | 无 | **渲染进程** |

---

## 二、运行时路径判断

### 2.1 “当前运行条件”的两种典型情况

- **A. 开发运行（npm run dev）**  
  - Electron 主进程 / preload 的 `process.env.NODE_ENV` 在 Vite/Electron 生态下通常为 `'development'`。  
  - 条件：`process.env.NODE_ENV === 'development'` 且未设置 `process.env.USE_REAL_AUTH`。  
  - **electron/preload/auth.ts 第 6-8 行**：  
    `USE_MOCK_AUTH = true`。  
  - **行为**：preload 的 `login`/`register` 在第 17-20、27-28 行直接 `return { __useMock: true, data }`，**不调用 ipcRenderer.invoke('auth:login'/'auth:register')**，主进程云鉴权与本地 AuthService 均不会执行。  
  - 渲染进程 authStore 收到 `__useMock` 后调用 **MockAuthService**（src/services/MockAuthService.ts），纯内存，**不发起任何 HTTP**。  
  - **结论（A）**：登录/注册**未发起 HTTP 请求**；短路发生在 **preload 层**。

- **B. 打包运行（exe/安装包），且未设置 AUTH_API_BASE_URL / VITE_AUTH_API_BASE_URL**  
  - 主进程 `process.env.NODE_ENV` 通常为 `'production'` 或未设置（非 development）。  
  - `USE_MOCK_AUTH` = false（除非显式 USE_MOCK_AUTH=true）。  
  - **electron/main/ipc/auth.ts 第 12 行**：  
    `USE_CLOUD_AUTH = !!process.env.AUTH_API_BASE_URL || !!process.env.VITE_AUTH_API_BASE_URL` → 未设置则 **false**。  
  - **行为**：主进程 auth:login/register 第 46-47、76-77 行不满足 USE_CLOUD_AUTH，走到第 68、100 行 `AuthService.register(data)` / `AuthService.login(credentials)`，使用 **Electron userData 下的本地 SQLite（auth.db）**，**不发起任何 HTTP**。  
  - **结论（B）**：登录/注册**未发起 HTTP 请求**；短路发生在 **主进程**（未走云鉴权，走本地 AuthService）。

- **若打包且已设置 AUTH_API_BASE_URL 或 VITE_AUTH_API_BASE_URL**  
  - USE_CLOUD_AUTH = true，主进程会调用 cloudAuthClient.getBaseUrl()，**完整 URL = 该环境变量的值 + `/auth/login` 或 `/auth/register`**。此时才会对 auth-api 发 HTTP。

### 2.2 当前运行时是否真的发起了 HTTP（登录/注册）

- 在**导致“服务器无请求、清空 users.db 仍能登录”**的这一运行条件下：  
  - **否**。登录/注册**未对 auth-api 发起 HTTP 请求**。
- 若发起了（即 USE_CLOUD_AUTH 为 true 且 base 已配置）：  
  - **完整 URL** = `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL` 的值（主进程运行时环境变量）+ 路径 `/auth/login` 或 `/auth/register`（例如 `http://121.41.179.197:8000/auth/login`）。  
  - 代码中**无** 121.41.179.197 或 8000 的硬编码；该地址仅能来自上述环境变量。

### 2.3 短路层级归纳

| 运行条件 | 短路层级 | 依据（文件:行） |
|----------|----------|------------------|
| 开发（NODE_ENV=development 且未设 USE_REAL_AUTH） | **preload** | preload/auth.ts：USE_MOCK_AUTH 为 true，login/register 直接返回 __useMock，不调用 IPC |
| 打包且未设置 AUTH_API_BASE_URL 与 VITE_AUTH_API_BASE_URL | **主进程** | main/ipc/auth.ts：USE_CLOUD_AUTH 为 false，走 AuthService.register/login，不调用 cloudAuthClient |

---

## 三、与服务器现象对齐

- **现象 1**：服务器 docker logs 在用户注册/登录时没有新增请求。  
  **解释**：在上述运行条件下，登录/注册请求在 preload 或主进程被短路，从未向服务器发起 HTTP，因此服务器收不到请求。

- **现象 2**：tcpdump 监听 8000 端口无流量。  
  **解释**：同上，桌面应用未向任何 host:8000 发起连接；若 base 未配置或为 Mock/本地 AuthService，则不会产生 8000 端口流量。

- **现象 3**：清空 users.db 后桌面应用仍“认为”可以登录。  
  **解释**：  
  - 开发时：登录走 **MockAuthService**（内存/本地存储），与服务器 users.db 无关；清空服务器 DB 不影响 Mock 数据。  
  - 打包且未配置云鉴权时：登录走主进程 **AuthService** + Electron 本机 **auth.db**（userData 目录），与服务器 users.db 无关；清空服务器 DB 不影响本机 SQLite。  
  因此“清空 users.db 仍能登录”与“未向服务器发请求”一致。

---

## 四、确定性结论（可直接复制）

```
【当前桌面应用在运行时】
- 实际 auth-api 地址（登录/注册） = 不适用（未对 auth-api 发起登录/注册的 HTTP 请求）
- 是否发起 HTTP 请求（登录/注册） = 否
- 原因 = 在导致“服务器无请求、清空 users.db 仍能登录”的运行条件下，
  要么（开发）preload 层 USE_MOCK_AUTH 为 true，login/register 直接返回 __useMock，
  渲染进程使用 MockAuthService，不发起任何 HTTP；
  要么（打包且未配置）主进程 USE_CLOUD_AUTH 为 false，auth:login/register 走
  AuthService.register/login（本地 SQLite），不调用 cloudAuthClient，不发起任何 HTTP。
  因此登录/注册请求在 preload 或主进程被短路，从未到达网络层。
```

**若将来在“已设置 AUTH_API_BASE_URL 或 VITE_AUTH_API_BASE_URL”的条件下运行**：  
- 实际 auth-api 地址（登录/注册）= **主进程运行时** `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL` 的**完整值**（含 scheme + host + port，无默认值）。  
- 例如设为 `http://121.41.179.197:8000` 时，完整 URL = `http://121.41.179.197:8000/auth/login` 与 `http://121.41.179.197:8000/auth/register`。

---

*以上结论均仅依据代码与运行路径，未修改任何代码。*
