# 7 天试用最小闭环 — 执行报告（不收费、不做支付）

**日期**: 2025-02-02  
**约束**: 不接入支付/订阅系统、不新增订单表、不重构现有 auth 流程；所有判断以服务端 /auth/status 为准。

---

## 一、改动文件与 diff 摘要

### A. 服务端（FastAPI + SQLite）

| 文件路径 | 变更摘要 |
|----------|----------|
| **auth-api/models.py** | `User` 表新增 `trial_start_at = Column(DateTime, nullable=True)`、`trial_end_at = Column(DateTime, nullable=True)`。 |
| **auth-api/database.py** | `_ensure_user_status_columns()` 中：若 `users` 表无 `trial_start_at`/`trial_end_at` 则 `ALTER TABLE users ADD COLUMN trial_start_at TEXT`、`trial_end_at TEXT`。 |
| **auth-api/schemas.py** | 新增 `TrialOut(start_at, end_at, is_active, is_expired)`；`UserStatusResponse` 增加可选字段 `trial: Optional[TrialOut] = None`。 |
| **auth-api/routers/auth.py** | 新增 `build_user_status_response(user)`（拼装 status + trial：is_active = end_at 非空且 now < end_at，is_expired = end_at 非空且 now >= end_at）；`GET /auth/status` 改为调用该函数；新增 `POST /auth/trial/start`（需 access token）：若 `trial_end_at` 已存在则不再次开通，否则写入 trial_start_at/end_at、plan=trial，返回同 /auth/status 结构；异常 500 并打日志。 |

### B. 客户端（Electron + React）

| 文件路径 | 变更摘要 |
|----------|----------|
| **src/types/auth.ts** | `UserStatus` 增加可选 `trial?: { start_at?, end_at?, is_active?, is_expired? }`。 |
| **src/services/apiClient.ts** | 新增 `startTrial(): Promise<UserStatus \| null>`，内部 `requestWithRefresh<UserStatus>('POST', '/auth/trial/start')`，失败 console.warn 返回 null，不登出。 |
| **src/stores/authStore.ts** | 新增 `refreshUserStatus()`（调 getUserStatus 并写入）、`startTrialAndRefresh()`（调 startTrial 成功则写入）；接口与实现。 |
| **src/stores/gateStore.ts** | 移除对 `useTrialStore` 的依赖；`guardAction` 改为以 `useAuthStore().userStatus` 为准：`userStatus?.status === 'disabled'` 时派发 `auth:account-disabled`；`canAccess = plan === 'pro' \|\| trial?.is_active === true`，需订阅且 !canAccess 时弹订阅弹窗。 |
| **src/components/auth/SubscribeDialog.tsx** | 改为调用 `useAuthStore().startTrialAndRefresh()`；增加 `trialExpired` 与 loading 状态；标题/文案按“开通试用”/“试用已结束”区分；按钮“免费试用 7 天”触发 startTrialAndRefresh，成功则 onClose + runPendingActionAndClear。 |
| **src/components/auth/AuthProvider.tsx** | 移除 `useTrialStore`；增加 `userStatus`、`trialExpiredModalShownRef`；监听 `auth:account-disabled` 并 toast“账号不可用”；checkAuth 成功后若 `userStatus?.trial?.is_expired && plan !== 'pro'` 则自动 `setShowSubscribeDialog(true)`（仅一次）；`SubscribeDialog` 传入 `trialExpired={userStatus?.trial?.is_expired && userStatus?.plan !== 'pro'}`。 |

---

## 二、验收证据

### 1) 服务端：GET /auth/status 示例返回（含 trial）

```json
{
  "username": "test@example.com",
  "status": "active",
  "plan": "free",
  "created_at": "2025-02-02T12:00:00",
  "last_login_at": "2025-02-02T12:05:00",
  "trial": {
    "start_at": null,
    "end_at": null,
    "is_active": false,
    "is_expired": false
  }
}
```

开通试用后示例：

```json
{
  "username": "test@example.com",
  "status": "active",
  "plan": "trial",
  "created_at": "2025-02-02T12:00:00",
  "last_login_at": "2025-02-02T12:05:00",
  "trial": {
    "start_at": "2025-02-02T12:10:00",
    "end_at": "2025-02-09T12:10:00",
    "is_active": true,
    "is_expired": false
  }
}
```

### 2) 服务端：POST /auth/trial/start 成功后的示例返回

与 GET /auth/status 结构一致，例如：

```json
{
  "username": "test@example.com",
  "status": "active",
  "plan": "trial",
  "created_at": "2025-02-02T12:00:00",
  "last_login_at": "2025-02-02T12:05:00",
  "trial": {
    "start_at": "2025-02-02T12:10:00",
    "end_at": "2025-02-09T12:10:00",
    "is_active": true,
    "is_expired": false
  }
}
```

### 3) 前端：触发点说明

| 项 | 文件路径 | 函数/位置 |
|----|----------|------------|
| 平台切换 guard | **src/pages/LiveControl/components/PlatformSelect.tsx** | `handlePlatformChange`：当 `newPlatform !== 'dev'` 时调用 `guardAction('platform-switch', { requireSubscription: true, action: () => setPlatform(newPlatform) })`。 |
| 试用弹窗组件 | **src/components/auth/SubscribeDialog.tsx** | `SubscribeDialog`：标题“开通试用”/“试用已结束”，按钮“免费试用 7 天”调用 `startTrialAndRefresh()`，成功则 `runPendingActionAndClear()`。 |
| 门控逻辑 | **src/stores/gateStore.ts** | `guardAction`：未登录→auth:required；userStatus.status===disabled→auth:account-disabled；需订阅且非 pro 且非 trial.is_active→gate:subscribe-required；否则执行 action。 |
| 试用到期弹窗 | **src/components/auth/AuthProvider.tsx** | `useEffect([authCheckDone, userStatus])`：当 `userStatus?.trial?.is_expired && userStatus?.plan !== 'pro'` 时 `setShowSubscribeDialog(true)`（配合 trialExpiredModalShownRef 仅弹一次）。 |

### 4) 端到端演示步骤

- **新用户登录 → 选非测试平台 → 弹窗 → 点免费试用 → 切换成功**  
  1. 新用户注册/登录。  
  2. 在直播控制页将平台从“测试平台”改为任意非 dev 平台（如“抖音小店”）。  
  3. 门控触发：已登录、plan=free、无 trial → 弹“开通试用”弹窗。  
  4. 点击“免费试用 7 天” → 调用 POST /auth/trial/start → 写入 userStatus（plan=trial, trial.is_active=true）→ runPendingActionAndClear() 执行 setPlatform → 切换成功。  

- **人为改到期 → 重启应用 → 弹“试用已结束”**  
  1. 在服务器将该用户的 `trial_end_at` 改为过去时间（或等待 7 天）。  
  2. 重启桌面应用，完成 checkAuth，拉取 userStatus（trial.is_expired=true）。  
  3. AuthProvider 检测到 trial 过期且 plan !== 'pro'，自动打开订阅弹窗，标题/文案为“试用已结束”。  
  4. 服务端“不允许再次试用”：已存在 trial_end_at 时 POST /auth/trial/start 仅返回当前 status，不重新开通。  

---

## 三、回滚要点

| 层级 | 回滚方式 |
|------|----------|
| 服务端 | 从 models 删除 trial_start_at/trial_end_at；database 中移除对应 ALTER；schemas 删除 TrialOut 与 UserStatusResponse.trial；auth 路由删除 build_user_status_response、POST /auth/trial/start，恢复 /auth/status 原返回。 |
| 客户端 | 类型去掉 trial；apiClient 删除 startTrial；authStore 删除 refreshUserStatus、startTrialAndRefresh；gateStore 恢复 useTrialStore.isInTrial 与门控逻辑；SubscribeDialog 恢复 trialStore.startTrial；AuthProvider 恢复 trialStore 与试用结束 toast，移除 account-disabled 与试用到期弹窗逻辑。 |

---

*本报告仅记录 7 天试用最小闭环，未做支付、未新增后台管理 UI、未重构 auth 体系。*
