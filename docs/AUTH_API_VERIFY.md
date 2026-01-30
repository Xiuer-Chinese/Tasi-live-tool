# Auth API 验证（Postman / curl）

API 基址示例：`http://127.0.0.1:8000`（本地）或你的阿里云域名。

## 1. 健康检查

```bash
curl -s http://127.0.0.1:8000/health
# 预期: {"status":"ok"}
```

## 2. 注册 POST /auth/register

**请求体：** `{ "identifier": "手机号或邮箱", "password": "至少6位" }`

```bash
curl -s -X POST http://127.0.0.1:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"123456"}'
```

**成功示例：**  
`{"user":{...},"access_token":"...","refresh_token":"...","token_type":"bearer"}`

**错误示例：** 账号已存在 → `{"detail":{"code":"account_exists","message":"账号已存在"}}`

## 3. 登录 POST /auth/login

**请求体：** `{ "identifier": "手机号或邮箱", "password": "密码" }`

```bash
curl -s -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"123456"}'
```

**成功：** 返回 `user`、`access_token`、`refresh_token`。

**错误：** 密码错误 → `{"detail":{"code":"wrong_password","message":"用户名或密码错误"}}`

## 4. 获取当前用户 GET /me

**请求头：** `Authorization: Bearer <access_token>`

```bash
export ACCESS_TOKEN="登录或注册返回的 access_token"
curl -s http://127.0.0.1:8000/me \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

**成功：** `{"user":{...},"subscription":{"plan":"free","status":"active",...}}`

**错误：** token 无效/过期 → 401，`{"detail":{"code":"token_invalid",...}}`

## 5. 刷新 access_token POST /auth/refresh

**请求体：** `{ "refresh_token": "登录/注册返回的 refresh_token" }`

```bash
export REFRESH_TOKEN="登录返回的 refresh_token"
curl -s -X POST http://127.0.0.1:8000/auth/refresh \
  -H "Content-Type: application/json" \
  -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}"
```

**成功：** `{"access_token":"新的 access_token","token_type":"bearer"}`

**错误：** refresh_token 失效/过期 → 401，`{"detail":{"code":"token_invalid",...}}`

---

## Postman 集合要点

- Base URL 变量：`{{baseUrl}}` = `http://127.0.0.1:8000`
- 注册/登录后把返回的 `access_token` 写入环境变量 `access_token`
- 请求 /me 时：Headers 添加 `Authorization: Bearer {{access_token}}`
- refresh 请求体：`{"refresh_token":"{{refresh_token}}"}`
