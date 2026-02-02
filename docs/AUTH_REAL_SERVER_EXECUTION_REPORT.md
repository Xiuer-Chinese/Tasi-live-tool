# 真实服务器登录/注册连通 — 执行情况与结论报告

**报告日期**: 2025-02-02  
**任务**: 真实服务器登录/注册连通最小修复（不做订阅/收费，保持可回滚）  
**状态**: 已完成

---

## 一、任务目标与范围

| 项 | 说明 |
|----|------|
| 目标 | 开发态下桌面应用向真实 auth-api（http://121.41.179.197:8000）发起登录/注册 HTTP 请求，并可通过审计日志与服务器日志验证 |
| 范围 | 仅做对齐与开关、云鉴权 base 配置、主进程接口路径对齐、审计日志格式统一 |
| 不做 | 订阅/收费逻辑、现有 UI/门控逻辑、架构重构 |

---

## 二、执行情况

### 2.1 已完成的改动

| 序号 | 文件路径 | 变更摘要 | 目的 |
|------|----------|----------|------|
| 1 | `package.json` | dev 脚本通过 cross-env 注入环境变量；新增 devDependency `cross-env@^7.0.3` | 开发态不再短路到 Mock，主进程与 preload 拿到云鉴权 base |
| 2 | `electron/main/services/cloudAuthClient.ts` | `/auth/register` → `/register`，`/auth/login` → `/login`；审计日志格式为 `[AUTH-AUDIT] <process> <method> <full_url>` | 与服务器实际路径一致；便于验收时看到完整 URL |
| 3 | `src/services/apiClient.ts` | 审计日志格式统一为 `[AUTH-AUDIT] <process> <method> <full_url>` | 与主进程审计格式一致，便于验收 |

### 2.2 具体变更（diff 摘要）

**1) package.json**

- `scripts.dev`:  
  - 原：`"dev": "vite"`  
  - 现：`"dev": "cross-env USE_REAL_AUTH=true USE_MOCK_AUTH=false AUTH_API_BASE_URL=http://121.41.179.197:8000 VITE_AUTH_API_BASE_URL=http://121.41.179.197:8000 vite"`
- `devDependencies`: 新增 `"cross-env": "^7.0.3"`

**2) electron/main/services/cloudAuthClient.ts**

- `request<CloudAuthResponse>('POST', '/auth/register', ...)` → `'POST', '/register'`
- `request<CloudAuthResponse>('POST', '/auth/login', ...)` → `'POST', '/login'`
- 审计日志：`console.log('[AUTH-AUDIT]', process.type ?? 'main', method, url)`（在 `fetch(url)` 前）

**3) src/services/apiClient.ts**

- 审计日志：`console.log('[AUTH-AUDIT]', processType ?? 'renderer', method, url)`（在 `fetch(url)` 前）

### 2.3 依赖安装

- 已执行 `npm install`，`cross-env` 已成功安装（added 1 package）。

---

## 三、结论

### 3.1 配置与行为结论

| 项 | 结论 |
|----|------|
| 开发态是否短路到 Mock | **否**。dev 脚本显式设置 `USE_REAL_AUTH=true`、`USE_MOCK_AUTH=false`，主进程与 preload 在开发态走云鉴权分支 |
| 云鉴权 base 来源 | 主进程：`process.env.AUTH_API_BASE_URL` 或 `process.env.VITE_AUTH_API_BASE_URL`，dev 下均为 `http://121.41.179.197:8000` |
| 登录/注册请求路径 | 主进程向 `http://121.41.179.197:8000/register`、`http://121.41.179.197:8000/login` 发起 POST（与当前服务器路径一致） |
| 审计日志 | 在真正发起 fetch 前打印 `[AUTH-AUDIT] <process> <method> <full_url>`，便于在终端/控制台复现验收 |

### 3.2 验收预期（可复制结果）

**1) 启动后终端首次出现**

执行 `npm run dev` 后，在启动桌面应用的终端中应看到：

```
[AUTH-AUDIT] startup config: {
  USE_MOCK_AUTH: false,
  USE_CLOUD_AUTH: true,
  AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  VITE_AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  effectiveBase: 'http://121.41.179.197:8000'
}
```

**2) 注册 + 登录后终端审计日志**

在桌面端执行一次「注册」再「登录」后，同一终端应出现两条：

```
[AUTH-AUDIT] browser POST http://121.41.179.197:8000/register
[AUTH-AUDIT] browser POST http://121.41.179.197:8000/login
```

**3) 服务器侧**

在 auth-api 所在机器执行 `docker logs <容器> 2>&1 | tail -50`，应能看到新增的 **POST /register** 与 **POST /login**（或带网关前缀的等价路径），用于确认桌面端已向真实服务器发起请求。

### 3.3 约束遵守情况

- 未做订阅/收费逻辑  
- 未改现有 UI/门控逻辑  
- 改动集中在 env 注入 + 两条路径对齐 + 审计日志格式  
- 每个改动点已在 `docs/AUTH_REAL_SERVER_FIX.md` 中给出文件路径与回滚说明，便于回滚  

---

## 四、相关文档

| 文档 | 说明 |
|------|------|
| `docs/AUTH_REAL_SERVER_FIX.md` | 最小修复说明、diff 摘要、交付验收步骤、回滚说明 |
| `docs/AUTH_API_CURRENT_RUN_AUDIT.md` | 当前运行配置下 auth-api 请求审计（静态+运行时） |
| `docs/AUTH_API_AUDIT_REPORT.md` | auth-api 只读审计报告（地址来源、短路条件等） |

---

*本报告为本次「真实服务器登录/注册连通」最小修复的执行情况与结论汇总，格式为 Markdown，便于存档与查阅。*
