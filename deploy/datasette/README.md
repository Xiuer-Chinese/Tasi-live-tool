# Datasette 用户管理后台（只读）

在 121.41.179.197 上用 Docker 部署 Datasette，只读挂载 auth-api 的 `users.db`，提供网页管理界面，端口 **8001**。

## 前置

- 服务器已安装 Docker
- auth-api 的 SQLite 数据库路径为 `/opt/auth-api/data/users.db` 或位于 `/opt` 下（脚本会自动查找）

## 一键部署（在服务器上执行）

### 方式 A：复制本目录到服务器后执行（推荐）

在**本机**执行（将 `deploy/datasette` 拷到服务器并运行脚本）：

```bash
scp -r deploy/datasette root@121.41.179.197:/opt/datasette-deploy
ssh root@121.41.179.197 "cd /opt/datasette-deploy && bash deploy-datasette.sh"
```

### 方式 B：SSH 后一键粘贴

SSH 登录 121.41.179.197，在服务器上执行：

```bash
mkdir -p /opt/datasette-deploy && cd /opt/datasette-deploy
# 若你已有 deploy/datasette 目录，可 scp 上传 deploy-datasette.sh 后直接：
bash deploy-datasette.sh
```

### 方式 C：服务器上一键粘贴（无需 scp，整段复制到 SSH 终端）

SSH 登录 121.41.179.197 后，**整段复制下面到终端执行**（会创建脚本并运行，完成 1～4 步及验收输出）：

```bash
mkdir -p /opt/datasette-deploy && cd /opt/datasette-deploy
cat > deploy-datasette.sh << 'ENDOFSCRIPT'
#!/usr/bin/env bash
set -e
echo "========== 1) 确认数据库路径 =========="
if [ -f "/opt/auth-api/data/users.db" ]; then
  DB_PATH="/opt/auth-api/data/users.db"
  echo "使用默认路径: DB_PATH=$DB_PATH"
else
  echo "默认路径不存在，在 /opt 下搜索 users.db（优先 auth-api 相关）..."
  DB_PATH=$(find /opt -path '*auth-api*' -name 'users.db' 2>/dev/null | head -1)
  [ -z "$DB_PATH" ] && DB_PATH=$(find /opt -name 'users.db' 2>/dev/null | head -1)
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
ENDOFSCRIPT
chmod +x deploy-datasette.sh
bash deploy-datasette.sh
```

## 验收信息

执行完成后请提供：

- **DB_PATH** 最终值
- **docker ps** 中 datasette_users 一行
- **docker logs** 最后几行
- **curl** 是否返回 HTML（HTTP 200）
- **访问 URL**：http://121.41.179.197:8001

## 安全组

- 阿里云安全组放行 **TCP 8001**
- 建议仅放行你的公网 IP

## 说明

- 数据库以 **只读** 挂载（`:ro`），Datasette 不会修改 users.db
- 若需写操作，请通过 auth-api 的 `/admin/*` 接口，不要在 Datasette 里改库
