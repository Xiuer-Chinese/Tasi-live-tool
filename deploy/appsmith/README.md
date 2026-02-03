# Appsmith 自托管（8080 端口）

用于在 121.41.179.197 上通过 Docker 部署 Appsmith，作为「可视化图形管理用户」后台，后续通过 HTTP 调用 auth-api 的 `/admin/*` 接口（不直连 SQLite）。

## 前置

- 服务器已安装 Docker / Docker Compose
- auth-api 已在 8000 端口可访问：http://121.41.179.197:8000
- Appsmith 暴露在 8080：http://121.41.179.197:8080

## 一键部署（在服务器上执行）

### 方式 A：SSH 后一键粘贴（推荐）

SSH 登录服务器后，整段复制粘贴执行即可（会创建目录、写入 docker-compose、启动并输出验收信息）：

```bash
mkdir -p /opt/appsmith && cd /opt/appsmith
cat > docker-compose.yml <<'YAML'
services:
  appsmith:
    image: appsmith/appsmith-ce:latest
    container_name: appsmith
    restart: unless-stopped
    ports:
      - "8080:80"
      - "8443:443"
    volumes:
      - appsmith-stacks:/appsmith-stacks
volumes:
  appsmith-stacks:
YAML
docker compose up -d
sleep 5
echo "=== docker ps ==="
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
echo "=== docker logs (last 200 lines) ==="
docker logs -n 200 appsmith 2>&1
echo "=== curl -I http://127.0.0.1:8080 ==="
curl -sI http://127.0.0.1:8080
echo "=== 安全组：请放行 TCP 8080（建议仅放行你的公网 IP） ==="
```

### 方式 B：复制本目录到服务器后执行脚本

```bash
scp -r deploy/appsmith root@121.41.179.197:/opt/
ssh root@121.41.179.197 "cd /opt/appsmith && bash install-and-verify.sh"
```

### 方式 C：在服务器上手工逐步执行

```bash
mkdir -p /opt/appsmith && cd /opt/appsmith
# 将 docker-compose.yml 内容粘贴到该文件后保存，然后：
docker compose up -d
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
docker logs -n 200 appsmith
curl -I http://127.0.0.1:8080
```

### 安全组

- 阿里云安全组放行 **TCP 8080**（及可选 8443）
- 建议只放行你的公网 IP，不要 0.0.0.0/0

## 验收信息

执行完成后请提供：

1. `docker ps` 输出
2. `docker logs -n 200 appsmith` 输出（可只贴最后 200 行）
3. `curl -I http://127.0.0.1:8080` 的 HTTP 状态码与响应头

## 下一步

在 Appsmith 中配置 REST API 数据源，对接 auth-api：

- POST /admin/login
- GET /admin/users
- POST /admin/users/{username}/disable | enable | reset-password
- DELETE /admin/users/{username}

**不要**在 Appsmith 里直连 SQLite，必须通过 HTTP 调用上述 /admin/* 接口。
