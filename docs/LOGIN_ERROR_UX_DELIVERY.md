# 登录失败提示改造交付说明

## 修改文件列表

| 文件 | 变更 |
|------|------|
| `src/utils/mapAuthError.ts` | **新增**：`mapAuthError(raw)` 统一映射为友好中文 + rawForDev |
| `src/stores/authStore.ts` | 登录失败时调用 mapAuthError，设置 error 为 userMessage，返回 rawError 供开发折叠 |
| `src/components/auth/AuthDialog.tsx` | 失败后仅清空密码、保留账号；密码框聚焦；展示友好文案；开发环境「更多信息」折叠 |
| `electron/main/services/cloudAuthClient.ts` | logAuthCall 中 responseData 脱敏（password/token/secret/refresh → ***） |

## 新增/修改的提示文案（面向用户）

| 场景 | 用户看到的文案 |
|------|----------------|
| 账号或密码错误（401） | 账号或密码错误，请重试 |
| 账号已被禁用（403 且 detail 含 disabled/禁用） | 该账号已被禁用，请联系管理员 |
| 网络异常/超时/断网 | 网络异常，请检查网络后重试 |
| 502/503 | 服务暂时不可用，请稍后再试 |
| 其它 5xx | 服务器开小差了，请稍后再试 |
| 其它 | 登录失败，请稍后重试 |

UI 不再展示：HTTP 状态码、英文原文（如 Invalid credentials）、请求地址 URL。

## 可调试性

- **主进程**：`[AUTH-AUDIT]` 继续打印 requestId、url、method、status、responseData（responseData 已脱敏）。
- **开发环境**：登录失败时错误区域下方出现「更多信息」按钮，默认折叠；展开后显示 rawForDev（含 status、detail、url），仅 `import.meta.env.DEV` 为 true 时显示。

## 输入体验

- 登录失败后：仅清空密码框，保留账号；密码框自动聚焦（setTimeout 100ms）；Toast 与表单上方均展示友好文案（如 401 时为「账号或密码错误，请重试」）。

## 登录失败三种场景说明（便于验收/截图）

### 1) 401 账号或密码错误

- **操作**：输入正确账号、错误密码，点击登录。
- **预期**：Toast 与表单上方红色区域显示「账号或密码错误，请重试」；不出现 401、Invalid credentials、URL；密码框清空并聚焦，账号保留；开发环境下可点击「更多信息」展开看到原始信息（如 `401 ... (http://...)`）。

### 2) 断网/网络异常

- **操作**：断开网络或使用不可达的鉴权地址，输入账号密码点击登录。
- **预期**：提示「网络异常，请检查网络后重试」；密码清空、密码框聚焦；不展示 URL 或英文错误。

### 3) 5xx 服务器错误

- **操作**：后端返回 500/502/503（可临时改后端或 Mock 返回 502）。
- **预期**：502/503 显示「服务暂时不可用，请稍后再试」；其它 5xx 显示「服务器开小差了，请稍后再试」；不展示状态码与 URL。

---

后端逻辑未改动；仅前端/桌面端提示层与主进程日志脱敏。
