#!/usr/bin/env bash
# Datasette 用户管理后台一键部署（只读挂载 users.db，端口 8001）
# 在服务器上执行：bash deploy-datasette.sh

set -e

echo "========== 1) 确认数据库路径 =========="
if [ -f "/opt/auth-api/data/users.db" ]; then
  DB_PATH="/opt/auth-api/data/users.db"
  echo "使用默认路径: DB_PATH=$DB_PATH"
else
  echo "默认路径不存在，在 /opt 下搜索 users.db（优先 auth-api 相关）..."
  # 优先 auth-api 相关路径
  DB_PATH=$(find /opt -path '*auth-api*' -name 'users.db' 2>/dev/null | head -1)
  if [ -z "$DB_PATH" ]; then
    DB_PATH=$(find /opt -name 'users.db' 2>/dev/null | head -1)
  fi
  if [ -z "$DB_PATH" ] || [ ! -f "$DB_PATH" ]; then
    echo "错误: 未找到 users.db。请确认数据库已部署在 /opt/auth-api/data/users.db 或 /opt 下其他位置。"
    exit 1
  fi
  echo "找到: DB_PATH=$DB_PATH"
fi

DB_DIR=$(dirname "$DB_PATH")
DB_FILE=$(basename "$DB_PATH")
echo "DB_DIR=$DB_DIR  DB_FILE=$DB_FILE"

echo ""
echo "========== 2) 启动 Datasette 容器 =========="
# 若已存在则先删除（便于重复执行）
docker rm -f datasette_users 2>/dev/null || true

docker run -d --name datasette_users --restart unless-stopped \
  -p 8001:8001 \
  -v "$DB_DIR:/data:ro" \
  datasetteproject/datasette \
  datasette "/data/$DB_FILE" --host 0.0.0.0 --port 8001

echo "容器已启动。"

echo ""
echo "========== 3) 验证 =========="
sleep 2
echo "--- docker ps | grep datasette_users ---"
docker ps | grep datasette_users || true
echo ""
echo "--- docker logs --tail 50 datasette_users ---"
docker logs --tail 50 datasette_users 2>&1
echo ""
echo "--- curl -sS http://127.0.0.1:8001/ | head -20 ---"
curl -sS http://127.0.0.1:8001/ 2>&1 | head -20

echo ""
echo "========== 4) 网络放行 =========="
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  echo "检测到 ufw 已启用，放行 8001/tcp..."
  ufw allow 8001/tcp 2>/dev/null || true
  ufw status | grep 8001 || true
fi
echo "若使用 iptables，请手动放行: iptables -A INPUT -p tcp --dport 8001 -j ACCEPT"
echo "阿里云安全组：请在控制台放行 TCP 8001（建议仅放行你的公网 IP）。"

echo ""
echo "========== 验收信息汇总 =========="
echo "DB_PATH=$DB_PATH"
echo "--- docker ps (datasette) ---"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAMES|datasette"
echo ""
echo "--- docker logs 最后 10 行 ---"
docker logs --tail 10 datasette_users 2>&1
echo ""
echo "--- curl 是否返回 HTML ---"
curl -sS -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8001/
echo ""
echo "访问地址: http://121.41.179.197:8001"
