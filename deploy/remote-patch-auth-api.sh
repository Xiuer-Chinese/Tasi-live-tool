#!/usr/bin/env bash
# 在 ECS 上执行：备份 main.py、插入 subscriptions 表、追加订阅函数
set -e

cd /opt/auth-api

echo "[1/5] 备份 main.py"
cp -a app/main.py app/main.py.bak.$(date +%Y%m%d_%H%M%S)

echo "[2/5] 检查 main.py 是否存在"
test -f app/main.py

echo "[3/5] 自动插入 subscriptions 表（紧跟 users 表创建后）"
python3 - <<'PY'
from pathlib import Path
p = Path("app/main.py")
s = p.read_text(encoding="utf-8")

if "CREATE TABLE IF NOT EXISTS subscriptions" in s:
    print("subscriptions table already exists, skip")
else:
    marker = "CREATE TABLE IF NOT EXISTS users"
    idx = s.find(marker)
    if idx == -1:
        raise SystemExit("Cannot find users table creation in main.py")

    lines = s.splitlines(True)
    pos = 0
    start_line = None
    for i, line in enumerate(lines):
        pos += len(line)
        if pos >= idx and start_line is None:
            start_line = i
            break
    if start_line is None:
        raise SystemExit("Cannot map index to line")

    end_line = None
    for j in range(start_line, min(start_line+200, len(lines))):
        if lines[j].strip() == ")":
            end_line = j
            break
    if end_line is None:
        raise SystemExit("Cannot find end of users conn.execute() block")

    insert = "\n    conn.execute(\n        \"CREATE TABLE IF NOT EXISTS subscriptions (\"\n        \"account TEXT PRIMARY KEY,\"\n        \"plan TEXT NOT NULL,\"\n        \"expires_at INTEGER NOT NULL,\"\n        \"updated_at INTEGER NOT NULL\"\n        \")\"\n    )\n"
    lines.insert(end_line+1, insert)
    p.write_text("".join(lines), encoding="utf-8")
    print("Inserted subscriptions table.")
PY

echo "[4/5] 追加订阅函数（若不存在则追加到文件末尾）"
python3 - <<'PY'
from pathlib import Path
p = Path("app/main.py")
s = p.read_text(encoding="utf-8")

if "def plan_features" in s and "def upsert_subscription" in s:
    print("subscription helper functions already exist, skip")
else:
    block = """

# ===== Subscription helpers =====

def now_ts() -> int:
    import time
    return int(time.time())

def plan_features(plan: str) -> dict:
    plan = (plan or "free").lower()
    if plan == "enterprise":
        return {"max_accounts": 30, "ai_enabled": True}
    if plan == "pro":
        return {"max_accounts": 5, "ai_enabled": True}
    return {"max_accounts": 1, "ai_enabled": False}

def get_subscription(conn, account: str) -> tuple:
    row = conn.execute(
        "SELECT plan, expires_at FROM subscriptions WHERE account=?",
        (account,)
    ).fetchone()

    if not row:
        return ("free", 4102444800)

    plan, expires_at = row[0], int(row[1])
    if expires_at < now_ts():
        return ("free", expires_at)
    return (plan, expires_at)

def upsert_subscription(conn, account: str, plan: str, expires_at: int):
    conn.execute(
        "INSERT INTO subscriptions(account, plan, expires_at, updated_at) "
        "VALUES(?, ?, ?, ?) "
        "ON CONFLICT(account) DO UPDATE SET plan=excluded.plan, expires_at=excluded.expires_at, updated_at=excluded.updated_at",
        (account, plan, int(expires_at), now_ts())
    )
"""
    p.write_text(s + block, encoding="utf-8")
    print("Appended subscription helpers block.")
PY

echo "[5/5] 输出关键片段确认"
grep -n "CREATE TABLE IF NOT EXISTS subscriptions" app/main.py || true
grep -n "Subscription helpers" app/main.py || true
