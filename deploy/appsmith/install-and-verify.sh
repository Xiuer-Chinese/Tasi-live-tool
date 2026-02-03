#!/usr/bin/env bash
# 在服务器上一键部署 Appsmith 并输出验收信息
# 用法：将本目录复制到服务器后执行：cd /opt/appsmith && bash install-and-verify.sh
# 或：在服务器上 mkdir -p /opt/appsmith && 粘贴 docker-compose.yml 后执行本脚本中的命令

set -e
BASE=/opt/appsmith
cd "$(dirname "$0")" 2>/dev/null || true
if [ ! -f docker-compose.yml ]; then
  echo "请先确保 docker-compose.yml 位于当前目录。"
  exit 1
fi

echo "========== 1) 确保目录并进入 =========="
mkdir -p "$BASE"
cp -f docker-compose.yml "$BASE/" 2>/dev/null || true
cd "$BASE"
pwd
ls -la docker-compose.yml

echo ""
echo "========== 2) 启动 Appsmith =========="
docker compose up -d
sleep 3
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "========== 3) 健康检查（最近 200 行日志） =========="
docker logs -n 200 appsmith 2>&1

echo ""
echo "========== 4) 本机连通性检查 =========="
curl -sI http://127.0.0.1:8080 | head -20

echo ""
echo "========== 5) 安全组提示 =========="
echo "- 需在阿里云安全组放行 TCP: 8080（及可选 8443）"
echo "- 强烈建议仅放行你的公网 IP，不要 0.0.0.0/0"

echo ""
echo "========== 6) 验收信息汇总 =========="
echo "--- docker ps ---"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "--- docker logs (last 200 lines) ---"
docker logs -n 200 appsmith 2>&1
echo ""
echo "--- curl -I http://127.0.0.1:8080 ---"
curl -sI http://127.0.0.1:8080
echo ""
echo "完成。请将以上「验收信息汇总」粘贴给交付方。"
