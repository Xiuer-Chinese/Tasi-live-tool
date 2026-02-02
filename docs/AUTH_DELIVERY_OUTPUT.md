# 交付输出（MD）

**日期**: 2025-02-02  
**任务**: 真实服务器连通验收闭环 + 生产固化

---

## 1) 本地终端 [AUTH-AUDIT] 日志（原文）

### 启动时已抓取（原文）

```
[AUTH-AUDIT] startup config: {
  USE_MOCK_AUTH: false,
  USE_CLOUD_AUTH: true,
  AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  VITE_AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  effectiveBase: 'http://121.41.179.197:8000'
}
```

### 注册 + 登录后预期两条（请贴入实际终端原文）

```
[AUTH-AUDIT] browser POST http://121.41.179.197:8000/register
[AUTH-AUDIT] browser POST http://121.41.179.197:8000/login
```

**您贴入的原文**：

```
（桌面端完成一次注册+登录后，将运行 npm run dev 的终端中出现的上述两行原文贴入此处）
```

---

## 2) 服务器 docker logs 片段（原文）

**执行命令**：

```bash
cd /opt/auth-api
docker compose logs --tail=50 auth-api
```

**您贴入的包含 POST /register、POST /login 的片段（原文）**：

```
（请在此贴入上述命令输出中包含 POST /register 与 POST /login 的原文片段）
```

---

## 3) 服务器 Python 查询 users.db 输出（原文）

**执行命令**：

```bash
docker compose exec auth-api sh -lc "python - <<'PY'
import sqlite3
conn=sqlite3.connect('/app/users.db')
rows=conn.execute('SELECT id, username FROM users ORDER BY id DESC LIMIT 10').fetchall()
print('latest users:')
for r in rows: print(r)
PY"
```

（若库文件为 `/data/auth.db`，将脚本内 `/app/users.db` 改为 `/data/auth.db`。）

**您贴入的完整输出（原文）**：

```
（请在此贴入上述命令的完整输出）
```

---

## 4) 生产固化方案与文件列表

| 项 | 内容 |
|----|------|
| 方案 | **方案 1**：为打包/运行提供可配置 env |
| 新增文件 | `docs/PROD_AUTH_ENV.md` |
| 修改文件 | 无（主进程启动时已有 `[AUTH-AUDIT] startup config`，见 `electron/main/ipc/auth.ts`） |
