# 真实服务器连通验收闭环 + 生产固化 — 交付输出

**日期**: 2025-02-02  
**约束**: 不改业务、不加收费；仅验证与生产 env 文档。

---

## 执行情况摘要

| 步骤 | 状态 | 说明 |
|------|------|------|
| A1–A2 | 已执行 | 已在项目根执行 `npm run dev`，并从运行终端抓取到包含 `[AUTH-AUDIT]`、`effectiveBase`、`http://121.41.179.197:8000` 的原文（见 A2）。 |
| A3 | 待您执行 | 需您在桌面端完成一次「注册」+「登录」后，将终端中出现的两条 `[AUTH-AUDIT] ... POST .../register` 与 `.../login` 原文贴入 A3。 |
| B | 待您执行 | 需您在服务器执行 B1 命令，将包含 POST /register、POST /login 的日志片段贴入 B2。 |
| C | 待您执行 | 需您在服务器执行 C1 命令，将 Python 查询 users.db 的完整输出贴入 C2。 |
| D | 已完成 | 采用方案 1；已新增 `docs/PROD_AUTH_ENV.md`；主进程启动时已有 `[AUTH-AUDIT] startup config`（无代码修改）。 |

---

## A) 本地验收

### A1) 执行命令

在项目根目录执行：

```bash
npm run dev
```

### A2) 运行终端中抓取的包含关键字的行（原样输出）

以下为实际抓取到的包含 `[AUTH-AUDIT]`、`effectiveBase`、`http://121.41.179.197:8000` 的终端输出（原样）：

```
[AUTH-AUDIT] startup config: {
  USE_MOCK_AUTH: false,
  USE_CLOUD_AUTH: true,
  AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  VITE_AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  effectiveBase: 'http://121.41.179.197:8000'
}
```

### A3) 桌面端注册 + 登录后的两条 [AUTH-AUDIT] 日志（原文）

**说明**：需您在桌面端执行一次「注册」再「登录」后，在**运行 `npm run dev` 的同一终端**中应出现两条带完整 URL 的审计日志。请将您终端中实际出现的该两行**原文**贴入下方（若尚未执行，执行后替换占位）。

**预期格式示例**：

```
[AUTH-AUDIT] browser POST http://121.41.179.197:8000/register
[AUTH-AUDIT] browser POST http://121.41.179.197:8000/login
```

**您贴入的原文（请替换下方占位）**：

```
（请在此贴入终端中出现的两条 [AUTH-AUDIT] ... POST http://121.41.179.197:8000/register 与 .../login 的原文）
```

### A4) 结论

- **本地 dev 是否真实命中服务器**：**是**（在您完成 A3 并看到上述两条 POST 日志的前提下）。
- **依据**：终端出现 `[AUTH-AUDIT] startup config` 且 `effectiveBase: 'http://121.41.179.197:8000'`、`USE_MOCK_AUTH: false`、`USE_CLOUD_AUTH: true`，说明开发态未短路到 Mock 且主进程会向该 base 发请求；若再出现 `[AUTH-AUDIT] ... POST http://121.41.179.197:8000/register` 与 `.../login`，则证明注册与登录请求已发往该服务器。

---

## B) 服务器验收

### B1) 在服务器执行并输出最后 50 行

```bash
cd /opt/auth-api
docker compose logs --tail=50 auth-api
```

### B2) 结论与日志片段（原文）

**是否出现新的 POST /register 与 POST /login**：（是/否）

**您贴入的 docker logs 中出现 POST /register 与 POST /login 的片段（原文）**：

```
（请在此贴入服务器执行上述命令后，输出中包含 POST /register 与 POST /login 的原文片段）
```

---

## C) 服务器数据库落库验收（Python）

### C1) 在服务器执行

（若 auth-api 使用 SQLite 且库文件为 `/data/auth.db`，请将下面脚本中的 `/app/users.db` 改为 `/data/auth.db`。）

```bash
docker compose exec auth-api sh -lc "python - <<'PY'
import sqlite3
conn=sqlite3.connect('/app/users.db')
rows=conn.execute('SELECT id, username FROM users ORDER BY id DESC LIMIT 10').fetchall()
print('latest users:')
for r in rows: print(r)
PY"
```

### C2) 输出（原文）

**您贴入的「最新 10 条用户」输出（原文）**：

```
（请在此贴入上述命令的完整输出，确认刚注册的用户名出现在列表中）
```

---

## D) 生产固化

### 选择方案

**方案 1（推荐）：为打包/运行提供可配置 env**

### 已完成内容

1. **新增文档** `docs/PROD_AUTH_ENV.md`  
   - 写清生产需设置的环境变量：`AUTH_API_BASE_URL`、`VITE_AUTH_API_BASE_URL`、`USE_REAL_AUTH`、`USE_MOCK_AUTH`  
   - 说明 Windows 下设置方式及验证方式（主进程启动时查看 `[AUTH-AUDIT] startup config`）

2. **主进程启动时审计日志（仅验证，未改逻辑）**  
   - 现有实现已满足：`electron/main/ipc/auth.ts` 中 `setupAuthHandlers()` 在注册 IPC 时调用 `logAuthAuditConfig()`，主进程（含打包后运行）启动并加载 IPC 时会打印一次 `[AUTH-AUDIT] startup config: { ... }`。  
   - 打包后只要在运行环境中设置上述 env，主进程即可读取并打印；无需修改 electron-builder 或启动入口。

### 修改/新增文件列表

| 类型 | 文件路径 |
|------|----------|
| 新增 | `docs/PROD_AUTH_ENV.md` |
| 无修改 | 未改业务代码；主进程审计日志已存在于 `electron/main/ipc/auth.ts` |

---

## E) 交付汇总

| 项 | 内容 |
|----|------|
| 1) 本地终端两条 [AUTH-AUDIT] register/login 原文 | 见 **A3**：需您完成桌面端注册+登录后，将终端中该两行原文贴入该节。 |
| 2) 服务器 docker logs 中 POST /register、POST /login 片段原文 | 见 **B2**：需您在服务器执行 B1 后，将包含上述请求的片段贴入该节。 |
| 3) 服务器 Python 查询 users.db 输出原文 | 见 **C2**：需您在服务器执行 C1 后，将完整输出贴入该节。 |
| 4) 生产固化方案与文件列表 | **方案 1**；新增 `docs/PROD_AUTH_ENV.md`，无业务代码修改。 |

---

*若任一步出现「不符合预期」，请将该步的原始输出贴出并停止后续步骤，勿自行猜测修复。*
