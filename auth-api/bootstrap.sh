#!/bin/bash
set -e

# 1. 检查并安装 python3 / python3-venv / pip
apt-get update -qq
apt-get install -y python3 python3-venv python3-pip

# 2. 在 /opt/auth-api 创建 venv
cd /opt/auth-api
python3 -m venv .venv

# 3. 激活 venv
# shellcheck source=/dev/null
source .venv/bin/activate

# 4. pip install -r requirements.txt
pip install -q -r requirements.txt

# 5. 创建 .env（SQLite + JWT_SECRET）
mkdir -p /data
cat > .env << 'EOF'
DATABASE_URL=sqlite:////data/auth.db
JWT_SECRET=change-me-in-production
CORS_ORIGINS=*
EOF

# 6. nohup 启动 uvicorn
pkill -f "uvicorn app.main:app" 2>/dev/null || true
sleep 1
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 >> /opt/auth-api/uvicorn.log 2>&1 &
sleep 2

# 7. 输出校验命令
echo "--- 校验：监听端口 ---"
ss -tlnp | grep 8000
echo "--- 校验：/docs ---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8000/docs
echo "--- 校验：/auth/register ---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://127.0.0.1:8000/auth/register -H "Content-Type: application/json" -d '{"identifier":"t@t.com","password":"123456"}'
echo "--- 校验：/auth/login ---"
curl -s -o /dev/null -w "HTTP %{http_code}\n" -X POST http://127.0.0.1:8000/auth/login -H "Content-Type: application/json" -d '{"identifier":"t@t.com","password":"123456"}'
