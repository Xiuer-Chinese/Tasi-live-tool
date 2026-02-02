# 生产环境鉴权相关环境变量

打包/运行桌面应用（dist 或安装包）时，若需走**真实服务器鉴权**（非 Mock、非本地 SQLite），有两种方式：

1. **环境变量**：在运行桌面应用的主进程能读取到的环境中设置 `AUTH_API_BASE_URL` / `VITE_AUTH_API_BASE_URL`（见下表）。
2. **生产默认**：若未设置上述变量，主进程在**打包后**（`app.isPackaged`）会使用代码中的 `DEFAULT_PRODUCTION_AUTH_API_BASE_URL`（`electron/main/services/cloudAuthClient.ts`）。发版前请将该常量改为你们正式鉴权服务地址。

---

## 必须设置（走云鉴权）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| **AUTH_API_BASE_URL** | `http://121.41.179.197:8000` | 主进程云鉴权 HTTP 请求的 base；未设置则主进程不向 auth-api 发登录/注册请求 |
| **VITE_AUTH_API_BASE_URL** | `http://121.41.179.197:8000` | 主进程备用；渲染进程 getMe/refresh 由构建时注入或此处一致配置 |

---

## 建议设置（避免走 Mock）

| 变量名 | 示例值 | 说明 |
|--------|--------|------|
| **USE_REAL_AUTH** | `true` | 为 true 时开发态也不走 Mock |
| **USE_MOCK_AUTH** | `false` | 显式关闭 Mock |

---

## 生产侧如何设置

- **Windows（当前用户会话）**  
  ```powershell
  $env:AUTH_API_BASE_URL="http://121.41.179.197:8000"
  $env:VITE_AUTH_API_BASE_URL="http://121.41.179.197:8000"
  $env:USE_REAL_AUTH="true"
  $env:USE_MOCK_AUTH="false"
  ```
  再启动打包后的 exe（或从同一会话启动的快捷方式）。

- **Windows（系统/用户环境变量）**  
  系统属性 → 环境变量 → 新建/编辑上述变量，重启桌面应用。

- **启动脚本/快捷方式**  
  在启动 exe 的脚本或快捷方式“目标”前通过脚本设置上述环境变量，再执行 exe。

---

## 验证

启动打包后的桌面应用后，在**主进程输出**（若已配置日志输出到控制台或文件）中应看到一次：

```
[AUTH-AUDIT] startup config: {
  USE_MOCK_AUTH: false,
  USE_CLOUD_AUTH: true,
  AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  VITE_AUTH_API_BASE_URL: 'http://121.41.179.197:8000',
  effectiveBase: 'http://121.41.179.197:8000'
}
```

说明主进程已读取到上述环境变量；若 `effectiveBase` 为空或 `(none)`，则登录/注册不会向服务器发请求。

---

## 开发环境：鉴权日志在终端

开发时（`npm run dev`），注册/登录等鉴权请求由**主进程**发起，日志 `[AUTH-AUDIT] <process> <method> <full_url>` 只出现在**运行 npm run dev 的终端**里，**不会**出现在渲染进程 DevTools 的 Console。排查 404 或「未打到真实 API」时，请先看终端里的完整请求 URL。详见 `docs/AUTH_404_REGISTER_ANALYSIS.md`。
