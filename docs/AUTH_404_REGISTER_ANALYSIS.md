# 注册 404 Not Found 详细分析与修复方案

**补充说明**：你反馈的 404 是在**开发环境**下出现的；**正式发行版**需要走真实服务器注册/登录。下文分别分析「开发环境 404 原因」与「正式版如何保证走服务器鉴权」。

---

## 一、现象

- **开发环境**：桌面端点击「注册」后，弹窗显示 `{"detail":"Not Found"}`。
- 控制台（渲染进程 DevTools）可见：`[AuthStore] Register request` 发送 `{ username, email, password }`，`Register response` 为 `success: false`，`error: '{"detail": "Not Found"}'`。
- 客户端已发送 `username` 字段，非 identifier 问题；服务端返回的是 **404**，说明请求到达了某台服务器，但该服务器认为「路径不存在」。

---

## 二、开发环境 vs 正式发行版（原因区分）

### 2.1 开发环境 404 的原因

- 注册/登录请求由**主进程**的 `cloudAuthClient` 发出，URL = `getBaseUrl() + getAuthPathPrefix() + '/register'`（或 `/login`）。
- `getBaseUrl()` 来自 `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''`。  
  - 若两者都为空：主进程会返回「AUTH_API_BASE_URL 未配置」，**不会**发出请求，也就**不会**得到 404。  
  - 因此**一旦出现 404，说明 base 有值**，请求已发往某个 URL，且**该 URL 对应的服务器返回了 404**。
- **开发环境下 404 的典型原因**：
  1. **base 指向了错误地址**：例如主进程拿到的 base 是 Vite 开发服务器（如 `http://localhost:5177`），则请求会打到 `http://localhost:5177/auth/register`，由 Vite 返回 404（Vite 没有该路由）。多见于从 IDE/其它方式启动时未把 `AUTH_API_BASE_URL` 传给主进程。
  2. **base 正确，但 auth-api 未在该地址提供 /auth/register**：例如 `http://121.41.179.197:8000/auth/register` 返回 404，说明该 host:port 上未跑本项目的 auth-api、或路由前缀不是 `/auth`、或前面有代理未正确转发。
- **如何确认**：看**运行 `npm run dev` 的终端**（主进程）里的 `[AUTH-AUDIT] main POST <url>`，确认完整 URL；再用 curl 请求该 URL，看是否同样 404。`[AUTH-AUDIT]` 只出现在终端，**不会**出现在渲染进程 DevTools。

### 2.2 正式发行版：当前为何不会走服务器鉴权

- **正式发行版**（打包后的 .exe/.app）运行时，主进程的 `process.env` 来自**用户本机环境**，**不会**自动带上构建时在 `package.json` 里写的 `AUTH_API_BASE_URL`。
- 因此打包后：`process.env.AUTH_API_BASE_URL` 与 `process.env.VITE_AUTH_API_BASE_URL` 通常都**为空** → `getBaseUrl()` 返回 `''` → `USE_CLOUD_AUTH` 为 false → 注册/登录会走**本地 AuthService**（SQLite），**不会**请求远程 auth-api。
- 也就是说：**当前实现下，正式发行版并不会「通过服务器注册登录」**；若要「正式版必须走服务器」，需要在**打包/运行时**为鉴权接口提供一个**生产环境 base URL**（见下文修复方案）。

---

## 三、请求链路（便于定位 404 来源）

1. **渲染进程**：`AuthDialog` 调用 `register({ username: registerForm.email, email, password, confirmPassword })` → `authStore.register(data)`。
2. **authStore**：`window.authAPI.register(data)`（preload 暴露的 IPC）。
3. **主进程 IPC**：`auth:register` 处理器收到 `data`；若 `USE_CLOUD_AUTH` 为 true，则用 `data.email` 作为 identifier，调用 `cloudRegister(identifier, data.password)`。
4. **cloudAuthClient（主进程）**：
   - `getBaseUrl()` 取 `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''`。
   - `getAuthPathPrefix()` 根据 base 是否以 `/auth` 结尾决定路径前缀（`''` 或 `'/auth'`）。
   - 请求 URL = `base + prefix + '/register'`，即 `http://<base>/auth/register` 或 `http://<base>/auth/register`（base 已含 /auth 时为 `http://<base>/register`）。
   - 使用 `fetch(url, { method: 'POST', body: { username: identifier, password } })` 发起请求。
5. **服务端**：某台 HTTP 服务响应；若该服务上没有对应路由，则返回 **404**，body 常为 `{"detail":"Not Found"}`（FastAPI 默认格式）。

结论：**404 一定来自「主进程请求的那一个 URL」所对应的服务器**。要排查，必须知道这个 URL 是什么。

---

### 快速排查清单（遇 404 时按顺序做）

1. 看**运行 `npm run dev` 的终端**（主进程），找 `[AUTH-AUDIT] main POST <url>`，记下完整 URL。
2. 若 URL 是 `http://localhost:5xxx/...`：说明 base 指向了 Vite，主进程未拿到 AUTH_API_BASE_URL → 检查启动方式、或使用项目根 `.env`（见方案 1）。
3. 若 URL 是 `http://121.41.179.197:8000/auth/register`（或你的配置）：用 curl 或浏览器请求同一 URL（如 `curl -s -o /dev/null -w "%{http_code}" -X POST "http://121.41.179.197:8000/auth/register" -H "Content-Type: application/json" -d "{}"`），确认是否返回 404；并确认该 host:port 上运行的是本项目的 auth-api、路由前缀为 `/auth`。
4. **开发时鉴权请求的日志在终端，不在渲染进程 DevTools**；若只看了 DevTools，会误以为「没有打到真实 API」。

---

## 四、开发环境 404 的可能原因（按优先级）

### 原因 A：主进程拿不到 base URL，请求发到了错误地址

- **表现**：主进程里 `AUTH_API_BASE_URL`、`VITE_AUTH_API_BASE_URL` 都为空或未传入。
- **结果**：
  - 若 `getBaseUrl()` 为空，会走 `if (!base)` 返回 `AUTH_API_BASE_URL 未配置`，不会得到 404。因此你看到 404 时，说明 base **有值**。
  - 但 base 可能来自「错误来源」：例如某些环境下主进程继承了 Vite 开发服务器的地址（如 `http://localhost:5177`），则实际请求会变成 `http://localhost:5177/auth/register`，由 Vite 返回 404（Vite 没有该路由）。
- **如何确认**：看**主进程**（即运行 `npm run dev` 的终端）里是否有 `[AUTH-AUDIT] main POST http://...` 的日志，以及其中的 URL 是 `http://121.41.179.197:8000/...` 还是 `http://localhost:5xxx/...`。
- **注意**：`[AUTH-AUDIT]` 是在 **主进程** 的 `cloudAuthClient.request()` 里打的，只出现在**启动 Electron 的终端**里，**不会**出现在渲染进程 DevTools 的 Console 中。若只看了 DevTools，会误以为「没有打到真实 API」。

### 原因 B：base URL 正确，但 auth-api 未在该地址提供 /auth/register

- **表现**：主进程里 [AUTH-AUDIT] 显示的 URL 是 `http://121.41.179.197:8000/auth/register`（或你配置的 auth 基址），但该地址上的服务返回 404。
- **可能情况**：
  1. 该 host:port 上根本没跑当前项目的 auth-api（例如跑的是别的服务、或旧版本）。
  2. auth-api 的路由前缀不是 `/auth`（例如部署时挂在了别的路径下）。
  3. 前面有反向代理/网关，把 `/auth/register` 转到了错误的后端或未配置该路径。
- **如何确认**：在浏览器或用 curl 直接请求同一 URL（如 `POST http://121.41.179.197:8000/auth/register`），看是否同样 404；并确认该端口上运行的是本项目的 auth-api 且已挂载 `/auth` 前缀。

### 原因 C：路径被重复拼接成 /auth/auth/register

- **表现**：base 已设为 `http://xxx/auth`，而代码里又拼接了 `/auth`，最终请求 `http://xxx/auth/auth/register`，若服务只提供 `/auth/register` 则会 404。
- **当前实现**：已通过 `getAuthPathPrefix()` 做了兼容——base 以 `/auth` 结尾时不再加 `/auth`，只加 `/register`，最终为 `http://xxx/auth/register`。因此在「base 含 /auth」的配置下，不应再出现 `/auth/auth/register`。若你仍把 base 配成「不含 /auth」（如 `http://121.41.179.197:8000`），则路径为 `/auth/register`，也正确。

---

## 五、修复方案（待你确认后执行）

### 开发环境 404 的修复

#### 方案 1：主进程启动时加载 .env，保证 dev 下一定有 base URL（推荐）

- **目的**：即使用户从 IDE 或其它方式启动（未通过 `npm run dev` 注入 AUTH_API_BASE_URL），主进程也能从项目根目录的 `.env` 读取 `AUTH_API_BASE_URL` 或 `VITE_AUTH_API_BASE_URL`，避免 base 为空或误用其它环境变量。
- **做法**：
  - 在主进程**最早**执行的入口（如 `electron/main/index.ts` 在 `void import('./app')` 之前）调用 `dotenv/config`，或 `require('dotenv').config({ path: '...' })`，确保工作目录为项目根且 `.env` 存在时能加载。
  - 在仓库根目录增加 `.env.example`，写明 `AUTH_API_BASE_URL=http://121.41.179.197:8000` 和 `VITE_AUTH_API_BASE_URL=...`，便于开发复制为 `.env`。
- **约束**：不改变现有「优先用 process.env」的逻辑，仅在没有值时由 .env 兜底；若 npm script 已注入，则仍以 script 为准。

#### 方案 2：404 时把「请求的 URL」带回给渲染进程并展示

- **目的**：用户无需切到终端看 [AUTH-AUDIT]，在注册失败弹窗里就能看到「实际请求的地址」，便于判断是打到了 Vite 还是真实 auth-api。
- **做法**：
  - 在 `cloudAuthClient.request()` 中，当 `res.ok === false` 时，在返回的 error 对象中增加一列，例如 `requestUrl: url`（或 `message` 中附带 URL）。
  - 主进程 `auth:register` 在收到 `cloudRegister` 的失败结果时，把该 URL 一并通过 IPC 返回给渲染进程（例如放在 `error` 字符串或额外字段中）。
  - 渲染进程（authStore 或 AuthDialog）在展示「注册失败」时，若存在请求 URL，则显示为「注册失败：Not Found (请求地址: xxx)」或类似文案。
- **约束**：不改变 404 时的 HTTP 语义，仅增加可观测性。

#### 方案 3：文档与排查清单（必做）

- **目的**：以后遇到 404 能按步骤自检。
- **做法**：
  - 在 `docs/AUTH_404_REGISTER_ANALYSIS.md`（或交付总结）中增加「排查清单」：
    1. 看**终端**（主进程）里的 `[AUTH-AUDIT] main POST <url>`，确认完整 URL。
    2. 若 URL 是 `http://localhost:5xxx/...`，说明 base 指向了 Vite，需检查主进程是否拿到 AUTH_API_BASE_URL（含 .env 与启动方式）。
    3. 若 URL 是 `http://121.41.179.197:8000/auth/register`，用 curl/浏览器请求同一 URL，确认 auth-api 是否在该地址提供 POST /auth/register；并确认服务已启动、路由前缀为 `/auth`。
  - 在 README 或 AUTH 相关文档中注明：开发时鉴权请求的日志在**终端**，不在渲染进程 DevTools。

### 正式发行版走服务器鉴权的修复

- **目标**：打包后的应用在用户机器上运行时，注册/登录必须请求远程 auth-api，而不是本地 SQLite。
- **现状**：主进程 base URL 仅来自 `process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL`，打包后通常为空，故正式版会走本地鉴权。
- **可选做法**（任选其一或组合）：
  1. **生产默认 base URL（推荐）**：在主进程 `cloudAuthClient.getBaseUrl()` 中，当 `process.env` 两项都为空且 `app.isPackaged === true` 时，使用一个**生产环境默认 base URL**（如 `https://your-auth-api.example.com` 或你们真实鉴权服务地址）。该默认值可写在常量或单独配置文件（如 `electron/platformConfig.js` 或 `config/authApi.production.ts`），便于发版前修改。
  2. **构建时注入**：在 `npm run build` / `npm run dist` 时通过 Vite 的 `define` 或环境变量，把生产环境 AUTH_API_BASE_URL 写进主进程 bundle；打包后的主进程从 `process.env.AUTH_API_BASE_URL` 读取（需确保 Vite 主进程构建会替换该变量）。这样发版时用不同 build 脚本即可切换生产/测试环境。
  3. **外置配置文件**：打包时把 `auth-api-base-url.json` 等放入 `extraResources`，主进程启动时读取；用户或运维可在安装目录修改该文件，无需重打包即可改鉴权地址。

**已实现**：在 `cloudAuthClient.getBaseUrl()` 里当 `app.isPackaged && !base` 时返回 `DEFAULT_PRODUCTION_AUTH_API_BASE_URL`（常量在 `electron/main/services/cloudAuthClient.ts`）。发版前请将该常量改为正式鉴权服务地址；若需多环境，可再考虑构建时注入或外置配置。

---

## 六、建议执行顺序

1. **先做方案 3**：在文档里写好排查步骤，并请你本地按步骤确认一次——看终端里的 [AUTH-AUDIT] 实际 URL，以及用 curl 请求该 URL 是否 404。这样能确定是「base 错了」还是「服务/路由错了」。
2. **再按需做方案 1**：若确认是 base 未设置或设错（例如打到了 localhost:5xxx），再在主进程加 .env 加载和 .env.example。
3. **可选方案 2**：若希望所有用户都能在界面上看到请求地址，再加 404 时回传 URL 并展示。
4. **正式版**：按需做「生产默认 base URL」或构建时注入/外置配置，保证发行版走服务器鉴权。

---

## 七、需要你确认的点

1. **开发环境**：你是否已经看过**运行 `npm run dev` 的终端**里的 `[AUTH-AUDIT] main POST http://...`？里面的完整 URL 是什么？（若是 localhost:5xxx，多半是 base 指向了 Vite；若是 121.41.179.197:8000，则偏服务端未提供 /auth/register。）
2. **开发环境修复**：上述「方案 1 / 2 / 3」是否都采纳，还是只采纳其中一部分（例如仅 3，或 3+1，或 3+1+2）？
3. **正式发行版**：是否采纳「生产默认 base URL」方案（在 `getBaseUrl()` 里当 `app.isPackaged && !base` 时返回你们正式鉴权服务地址）？若采纳，请提供正式环境 base URL（或说明从现有 `electron/platformConfig.js` / 其它配置文件读取）。
4. 项目根目录是否允许新增 `.env.example`，以及主进程入口是否允许在最早处加一行 `dotenv/config`（或等价的 `require('dotenv').config()`）？

你确认后，我按你的选择给出具体修改位置和补丁（文件列表 + 关键 diff）。
