# 客户端接入 /auth/status — 执行报告（只读感知，不做限制）

**日期**: 2025-02-02  
**目标**: 登录成功 / 应用启动鉴权完成后调用 GET /auth/status，将结果存入本地状态，作为后续功能门控的数据来源。  
**约束**: 不做收费、不做试用判断、不拦功能、不修改现有 UI 行为、不新增配置项。

---

## 一、已完成的改动（文件路径 + diff 摘要）

### A. API 层（客户端）

| 文件路径 | 变更摘要 |
|----------|----------|
| **src/types/auth.ts** | 新增类型 `UserStatus`：`username: string`，`status: 'active' \| 'disabled'`，`plan: 'free' \| 'trial' \| 'pro'`，`created_at?: string`，`last_login_at?: string`。 |
| **src/services/apiClient.ts** | 新增 `getUserStatus(): Promise<UserStatus \| null>`：使用 `requestWithRefresh('GET', '/auth/status')`（自动带 access_token），无 fallback/mock；失败时 `console.warn` 并返回 `null`，不登出、不弹窗。 |

**diff 摘要**：

- **auth.ts**：文件末尾增加 `UserStatus` 接口定义（注释：GET /auth/status 返回）。
- **apiClient.ts**：增加 `import type { UserStatus } from '@/types/auth'`；在 `getMe()` 后增加 `getUserStatus()` 函数（内部调用 `requestWithRefresh<UserStatus>('GET', '/auth/status')`，成功返回 `result.data`，失败 `console.warn` 并返回 `null`）。

### B. 状态层（authStore）

| 文件路径 | 变更摘要 |
|----------|----------|
| **src/stores/authStore.ts** | 新增状态 `userStatus: UserStatus \| null`（初始 `null`）；新增 action `setUserStatus(userStatus)`。登录成功：在 `set({ ... })` 后 `getUserStatus().then(status => { if (status) { setUserStatus(status); console.log('[USER-STATUS]', status) } }).catch(() => {})`。checkAuth 鉴权成功：在 `set({ ... })` 后同样调用 `getUserStatus()` 并 `setUserStatus` + `console.log('[USER-STATUS]', ...)`。logout 与 `clearTokensAndUnauth` 时清空 `userStatus: null`。 |

**diff 摘要**：

- **authStore.ts**：`import { getMe, getUserStatus }`，`import type { ..., UserStatus }`；接口增加 `userStatus: UserStatus \| null`、`setUserStatus`；初始状态增加 `userStatus: null`；login 成功分支内增加 `getUserStatus().then(...).catch(() => {})`；checkAuth 成功分支内增加同上调用；logout 的 `set()` 增加 `userStatus: null`；`clearTokensAndUnauth` 的 `set()` 增加 `userStatus: null`；实现 `setUserStatus: (userStatus) => set({ userStatus })`。`userStatus` 未加入 persist 的 `partialize`（不持久化，每次启动由 checkAuth 拉取）。

### C. UI 层（最小接入）

- 未新增页面、未新增提示。
- 仅在设置 `userStatus` 时于控制台打印一次：`console.log('[USER-STATUS]', status)`（在 login 成功与 checkAuth 鉴权成功两处，仅当 `getUserStatus()` 返回非 null 时打印）。

### D. 验收标准

1. 登录成功后：控制台出现 `[USER-STATUS]` 及与服务器一致的字段。
2. 字段与服务器返回一致：`username`、`status`、`plan`、`created_at`、`last_login_at`。
3. 网络断开 / status 接口失败：`getUserStatus()` 返回 null，仅 `console.warn`，不登出、不弹窗，登录态与功能使用不受影响。

---

## 二、回滚要点

| 改动 | 回滚方式 |
|------|----------|
| src/types/auth.ts | 删除 `UserStatus` 接口。 |
| src/services/apiClient.ts | 删除 `getUserStatus` 及对 `UserStatus` 的导入。 |
| src/stores/authStore.ts | 删除 `userStatus` 状态与 `setUserStatus`；删除 login/checkAuth 中的 `getUserStatus().then(...)`；logout 与 `clearTokensAndUnauth` 中移除 `userStatus: null`；删除对 `getUserStatus`、`UserStatus` 的导入。 |

---

*本报告仅记录客户端接入 /auth/status 的只读感知与状态写入，未做功能限制、试用/订阅判断或 UI 行为修改。*
