# 存档：发行前准备状态（Release Prep Snapshot）

**存档日期**：2025-02-03  
**用途**：记录正式发行前检查与准备工作完成时的仓库状态，便于回溯与审计。

---

## 一、仓库快照

| 项目 | 值 |
|------|-----|
| 分支 | `dev-after-electron-fix` |
| HEAD | `5f013d7619c5ee9baf55883a4d0d708005d40c59` |
| 最新提交说明 | feat: auth and trial API integration, GET /auth/status with trial from DB, frontend trial flow, archive doc |
| 版本（package.json） | 1.0.0 |
| 产品名 | TASI-live-Supertool |

---

## 二、本阶段完成内容摘要

- **auth-api 对齐**：无 /auth 前缀（POST /register、POST /login）；/login 返回字段 `token`；新增 GET /subscription/status（Bearer 鉴权、仅查自己）。
- **auth-api 管理端**：/admin/login、/admin/users（列表、详情、disable/enable、reset-password、delete）；审计日志；DB_PATH/ADMIN_* 配置。
- **前端**：鉴权基准 `authApiBase.ts` 默认 `http://121.41.179.197:8000`；登录态与订阅状态对接。
- **部署与自检**：deploy/appsmith、deploy/datasette 脚本；auth-api 文档（ADMIN_API_DELIVERY、SUBSCRIPTION_STATUS_*）；发行前报告与自检脚本。
- **发行前文档**：RELEASE_PRE_FLIGHT_REPORT.md（当前未提交变更列表、准备步骤、执行清单）；RELEASE_NOTES_V1.0.md（关键变更含云鉴权/订阅状态/管理员后台）；scripts/pre-release-check.ps1（只读自检，npm run pre-release-check）。

---

## 三、存档时工作区状态（未提交）

**已修改 (M)**  
RELEASE_NOTES_V1.0.md, RELEASE_PRE_FLIGHT_REPORT.md, package.json  
auth-api: config.py, database.py, deps.py, main.py, routers/auth.py, routers/me.py, schemas.py  
src: LoginPage.tsx, SubscribeDialog.tsx, authApiBase.ts, authStore.ts, trialStore.ts  

**未跟踪 (??)**  
auth-api/docs/*.md, export_openapi.py, openapi.json  
auth-api/routers/admin.py, subscription.py, schemas_admin.py, scripts/  
deploy/appsmith/, deploy/datasette/  
scripts/pre-release-check.ps1  
（__pycache__、*.db 为忽略/临时，不纳入提交）

---

## 四、关键文档索引

| 文档 | 说明 |
|------|------|
| [RELEASE_PRE_FLIGHT_REPORT.md](../RELEASE_PRE_FLIGHT_REPORT.md) | 发行前报告：未提交列表、版本与构建、准备步骤、执行清单 |
| [RELEASE_NOTES_V1.0.md](../RELEASE_NOTES_V1.0.md) | V1.0 发布说明：关键变更、已知限制、下载说明 |
| [scripts/RELEASE_V1.0_CHECKLIST.md](../scripts/RELEASE_V1.0_CHECKLIST.md) | GitHub/Gitee Release 操作步骤 |
| [auth-api/docs/ADMIN_API_DELIVERY.md](../auth-api/docs/ADMIN_API_DELIVERY.md) | 管理员 API 交付：接口、.env、重启命令 |
| [auth-api/docs/SUBSCRIPTION_STATUS_CURL.md](../auth-api/docs/SUBSCRIPTION_STATUS_CURL.md) | 订阅状态接口 curl 自测 |
| [auth-api/docs/SUBSCRIPTION_STATUS_DEPLOY.md](../auth-api/docs/SUBSCRIPTION_STATUS_DEPLOY.md) | 订阅状态部署与验证 |

---

## 五、后续动作（发行时）

1. 将第三节中除 __pycache__、*.db 外的变更全部提交。  
2. 打 tag（如 v1.0.0），执行 `npm run dist`，推送分支与 tag。  
3. 在 GitHub/Gitee 创建 Release，上传 exe 与 zip，粘贴 RELEASE_NOTES。

本存档仅记录状态，不替代上述操作。
