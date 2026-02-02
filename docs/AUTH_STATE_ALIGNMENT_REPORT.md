# 鉴权状态对齐报告（仅事实，不推进实现）

**用途**: 状态同步。禁止修改代码、禁止提出新方案。  
**依据**: 已确认的客观事实 + 当前代码与运行配置。

---

## 已确认的客观事实（前提）

1. 服务器 auth-api 正常运行，端口 8000 可访问。
2. 服务器使用 SQLite，数据库文件路径为 `/app/users.db`。
3. 该数据库的 users 表已被人工清空（DELETE FROM users）。
4. 清空后：桌面应用仍然可以注册/登录；服务器 docker logs 没有新增 /register /login；tcpdump 监听 8000 端口无任何流量。
5. 使用 Swagger (/docs) 调用服务器 /login，在清库后会失败（符合预期）。
6. 结论：桌面应用当前“登录成功”并不来源于该 auth-api。

---

## A. 当前桌面应用【实际生效的鉴权模式】

**结论：Mock**

- 登录/注册未向该 auth-api 发起 HTTP 请求，也未使用服务器 users.db。
- 满足“登录成功”的路径为：preload 层返回 `__useMock` → 渲染进程 `authStore` 调用 `MockAuthService`（内存/本地存储），或主进程在未走云鉴权时走本地 AuthService（本地 SQLite）。
- 结合“无任何 8000 端口流量”的观测，请求在到达主进程 `cloudAuthClient` 之前已被短路，故实际生效的鉴权模式为 **Mock**（短路发生在 preload，由 MockAuthService 完成登录/注册）。

---

## B. 登录/注册在当前运行条件下

- **是否发起 HTTP 请求**：**否**
- **短路层级**：**preload**
- **具体文件与条件**：
  - **文件**：`electron/preload/auth.ts`
  - **条件**：`USE_MOCK_AUTH === true` 时（第 18、28 行），`register` / `login` 直接 `return { __useMock: true, data }`，不调用 `ipcRenderer.invoke('auth:register'/'auth:login')`，主进程与 cloudAuthClient 均未执行，故无 HTTP 请求。

---

## C. 当前运行态下各变量实际值

（与“无请求、清库仍可登录”一致时的推断值；Electron 主进程/preload 若未收到 dev 脚本注入的环境变量，则如下。）

| 变量 | 实际值 |
|------|--------|
| **USE_MOCK_AUTH** | **true**（preload/main 中：`NODE_ENV === 'development'` 且 `USE_REAL_AUTH !== 'true'` 时条件成立） |
| **USE_REAL_AUTH** | **未定义**（在 Electron 进程中未传入或未设置） |
| **USE_CLOUD_AUTH** | **false**（主进程：`AUTH_API_BASE_URL` 与 `VITE_AUTH_API_BASE_URL` 均未传入，`!!process.env.AUTH_API_BASE_URL \|\| !!process.env.VITE_AUTH_API_BASE_URL` 为 false） |
| **AUTH_API_BASE_URL** | **未定义**（在 Electron 主进程/preload 运行时未传入） |

**证据指向**：  
- `electron/preload/auth.ts` 第 6–8 行：`USE_MOCK_AUTH` 的取值逻辑。  
- `electron/main/ipc/auth.ts` 第 8–10 行（USE_MOCK_AUTH）、第 12 行（USE_CLOUD_AUTH）。  
- 观测：无 8000 流量 → 未走 cloudAuthClient → 与“USE_MOCK_AUTH 为 true 或 USE_CLOUD_AUTH 为 false”一致；最早短路点为 preload，故 USE_MOCK_AUTH 在 preload 为 true。

---

## D. 一句话回答

**为什么服务器 users.db 被清空，但桌面应用仍可登录？**

因为当前运行条件下，桌面应用的登录/注册在 **preload 层**被 **USE_MOCK_AUTH** 短路为 Mock，直接返回 `__useMock`，不发起 IPC、不向该 auth-api 发 HTTP 请求；“登录成功”由渲染进程 **MockAuthService**（或主进程本地 AuthService）在本地完成，与服务器 users.db 无关。

---

*本报告仅做事实确认与清单列出，未修改任何代码，未提出新方案。*
