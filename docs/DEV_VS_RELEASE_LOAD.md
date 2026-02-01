# 开发环境 vs 发布后：白屏/加载问题说明

## 开发环境：已做的自动恢复（减少困扰）

为减少「关进程、删 dist-electron、重启」的重复操作，主进程在开发环境下已做：

1. **先等再加载**：启动时先等待 Vite 端口可连接（最多约 30 秒，首探前等 3 秒），再执行 `loadURL`。
2. **失败自动重试**：若首次加载仍失败（ERR_CONNECTION_REFUSED），约 4 秒后自动重试，最多再重试 2 次（共 3 次尝试）。
3. **强制重建**：执行 `npm run dev:force` 会先删 `dist-electron` 再启动，避免主进程用旧缓存。

日常开发建议：直接 `npm run dev`；若遇白屏，先等几秒看是否自动重试成功，若仍白屏再执行一次 `npm run dev:force` 或重启终端后重试。

---

## 结论（可直接给产品/测试）

- **发布后用户客户端不会遇到「连不上 localhost:5173」导致的白屏。**
- 该问题**仅存在于开发环境**（`npm run dev`），且与「等 Vite 再 loadURL」的时序有关；打包后不走该逻辑。

---

## 原因说明

### 开发环境（npm run dev）

- 主进程通过 **`loadURL('http://localhost:5173/')`** 加载页面，依赖本机 Vite 开发服务器。
- 若 Electron 先于 Vite 就绪就执行 loadURL，会 **ERR_CONNECTION_REFUSED**，窗口白屏或显示错误页。
- 代码中已做：**先 `waitForDevServer` 再 `loadURL`**，并保留 `npm run dev:force`（删 dist-electron 后重建），以尽量规避缓存/旧进程导致的异常。
- 即使你已关掉任务栏里的进程，仍可能因**后台残留进程、端口未释放、或 dist-electron 缓存**导致“看起来关了但启动仍异常”；重启电脑后环境干净，问题消失，属于这类情况。

### 发布后（打包安装包、用户双击 exe）

- 打包时 **不会** 注入 `VITE_DEV_SERVER_URL`。
- 主进程走 **`win.loadFile(indexHtml)`**，从应用包内 **本地文件**（如 `dist/index.html`）加载，**不访问 localhost、不依赖任何开发服务器**。
- 因此**不存在「连不上 5173」或「等 Vite」的问题**，用户端不会因此白屏。

---

## 代码依据

- `electron/main/app.ts` 中：
  - `if (VITE_DEV_SERVER_URL)` → 仅开发时成立，内部为 `waitForDevServer` + `loadURL(VITE_DEV_SERVER_URL)`。
  - `else` → 打包后走这里，`win.loadFile(indexHtml)`，本地文件加载。

---

## 若发布后用户仍白屏

若将来在**已打包、用户环境**下出现白屏，原因会是**其它**（例如：React 报错、资源路径错误、权限、杀软拦截等），而不是「连不上 localhost:5173」。届时需要按用户环境抓包、日志或远程排查，与当前开发环境白屏不是同一类问题。
