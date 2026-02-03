# 登录首启与清除本地数据说明

## 一、账号来源与存储（定位结果）

### 1.1 来源结论

账号输入框出现“历史/默认账号”的**唯一来源**为：**Electron 用户数据目录（userData）中的持久化**，即旧安装或本机此前运行留下的数据。  
安装包内**不包含**任何默认账号或登录状态文件。

### 1.2 读写位置

| 存储 | Key / 路径 | 读 | 写 | 说明 |
|------|-------------|----|----|------|
| **localStorage（渲染进程）** | `auth.rememberMe` | AuthDialog.tsx:55, 70 | AuthDialog.tsx:149, 152 | 仅 "true"/"false"，表示是否记住登录状态 |
| **localStorage（渲染进程）** | `auth.lastIdentifier` | AuthDialog.tsx:56, 71 | AuthDialog.tsx:150, 153 | 上次成功登录且勾选“记住”时的账号（手机/邮箱） |
| **localStorage（Zustand persist）** | `auth-storage` | authStore 持久化层 | authStore 持久化层 | 存 token、refreshToken、user、isAuthenticated |
| **主进程（userData）** | `{userData}/auth/tokens.enc` | CloudAuthStorage.getStoredTokens | CloudAuthStorage.setStoredTokens | 加密的 access_token / refresh_token |

- **写入**：仅在**登录成功**且用户**勾选“记住登录状态”**时写入 `auth.rememberMe` 与 `auth.lastIdentifier`（AuthDialog.tsx 147–153）。
- **读取**：仅在登录弹窗打开且 `auth.rememberMe === 'true'` 且存在 `auth.lastIdentifier` 时，将账号框预填为 `auth.lastIdentifier`（AuthDialog.tsx 54–62, 70–75）。

### 1.3 类型归纳

- **(a) Electron userData 持久化**：是。渲染进程 localStorage 与主进程 `auth/tokens.enc` 均落在 userData（如 `%APPDATA%/TASI-live-Supertool/` 或产品名对应目录）。
- **(b) 打包资源中的默认配置**：否。未在 resources 内置任何账号/状态文件。
- **(c) 环境变量/示例账号**：否。无默认账号或示例账号注入。

---

## 二、发行行为与修复

### 2.1 已实现行为

- **首次运行**：不写入任何账号；localStorage 无 `auth.rememberMe`/`auth.lastIdentifier` 或为 false/空，账号框**默认为空**。
- **仅当用户勾选“记住登录状态”并成功登录**：才写入 `auth.rememberMe` 与 `auth.lastIdentifier`。
- **退出登录后**：若**未**勾选“记住账号”（即 `auth.rememberMe !== 'true'`），则登出时清空 `auth.lastIdentifier` 并将 `auth.rememberMe` 置为 `'false'`；若已勾选则保留，下次打开仍回填账号。
- **安装包**：不内置任何历史账号或登录状态文件。

### 2.2 “清除本地登录数据”入口

- **位置**：设置 → 其他设置 → **清除本地登录数据** 按钮。
- **效果**：
  - 主进程：删除 `userData/auth/tokens.enc`（clearStoredTokens）。
  - 渲染进程：删除 `auth.rememberMe`、`auth.lastIdentifier`、`auth-storage`（Zustand 持久化），并执行 `clearTokensAndUnauth()`（清空内存中的 token/user 等）。
- **不删除**：其他业务数据（如中控台账号列表、任务配置等）不受影响。

---

## 三、关键存储 Key 名称

所有 key 的常量定义见 **`src/constants/authStorageKeys.ts`**（`AUTH_REMEMBER_ME_KEY`、`AUTH_LAST_IDENTIFIER_KEY`、`AUTH_ZUSTAND_PERSIST_KEY`），由 AuthDialog、authStore、OtherSetting 统一引用。

| 用途 | 名称 | 所在位置 |
|------|------|----------|
| 是否记住登录状态 | `auth.rememberMe` | localStorage |
| 上次登录账号（仅当记住时保存） | `auth.lastIdentifier` | localStorage |
| 登录态持久化（token/user 等） | `auth-storage` | localStorage（Zustand persist） |
| 主进程 token 文件 | `{userData}/auth/tokens.enc` | 主进程磁盘 |

---

## 四、验收步骤（可复现）

### 4.1 模拟“全新安装”（清空本机登录相关数据）

任选其一：

- **方式 A（推荐）**：在应用内 设置 → 其他设置 → 点击 **清除本地登录数据**，然后完全退出应用再重新打开。
- **方式 B**：关闭应用后，删除 Electron 用户数据目录中的登录相关数据后重启：
  - Windows：删除 `%APPDATA%\TASI-live-Supertool\Local Storage` 下与 origin 对应的存储（或整个 `TASI-live-Supertool` 以清空所有）；并删除 `%APPDATA%\TASI-live-Supertool\auth\tokens.enc`（若存在）。
  - 若产品名不同，请以实际 `app.getPath('userData')` 为准（一般为产品名或 appId 对应目录）。

### 4.2 首次启动账号框为空

1. 按 4.1 做一次“全新安装”模拟。
2. 启动应用，触发登录弹窗（未登录时访问需鉴权功能或启动即需登录）。
3. **预期**：账号输入框**为空**，记住登录状态未勾选。

### 4.3 勾选“记住账号”后重启仍保留

1. 在登录弹窗中输入账号、密码，**勾选“记住登录状态”**，登录成功。
2. 退出登录（用户中心 → 退出登录）。
3. 再次打开登录弹窗。
4. **预期**：账号框**仍为上次账号**（因 rememberMe 为 true 且 lastIdentifier 已保存）。

### 4.4 不勾选“记住账号”则不保留

1. 在登录弹窗中**不勾选**“记住登录状态”，登录成功。
2. 退出登录。
3. 再次打开登录弹窗。
4. **预期**：账号框**为空**（logout 时已清空 `auth.lastIdentifier` 与 `auth.rememberMe`）。

---

## 五、修改文件清单

| 文件 | 修改内容 |
|------|----------|
| `src/stores/authStore.ts` | `logout` 的 `finally` 中：若 `auth.rememberMe !== 'true'`，则 `removeItem('auth.lastIdentifier')` 且 `setItem('auth.rememberMe','false')` |
| `shared/ipcChannels.ts` | 新增 `app.clearLocalLoginData` |
| `electron/main/ipc/app.ts` | 新增 `app:clearLocalLoginData` 处理：调用 `clearStoredTokens()` |
| `src/pages/SettingsPage/components/OtherSetting.tsx` | 新增“清除本地登录数据”区块与按钮：调用 IPC、清除上述 localStorage key、调用 `clearTokensAndUnauth()` |
| `docs/LOGIN_FIRST_RUN_AND_CLEAR_DATA.md` | 本文档（来源、key、行为、验收） |
