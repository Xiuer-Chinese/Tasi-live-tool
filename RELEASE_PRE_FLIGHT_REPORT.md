# 正式版发行前报告（Pre-Release Report）

**生成时间**：发行前检查  
**当前分支**：`dev-after-electron-fix`  
**最新已提交**：`e0117a2 baseline: Phase 3 auth refresh stable (login/register/me/refresh)`

---

## 一、当前仓库状态

### 1.1 未提交变更（需在发行前提交）

| 类型 | 文件 |
|------|------|
| 已修改 | `electron/main/platforms/dev/dev.html` |
| 已修改 | `src/components/auth/AuthProvider.tsx` |
| 已修改 | `src/pages/AutoMessage/index.tsx` |
| 已修改 | `src/pages/AutoPopUp/components/GoodsListCard.tsx` |
| 已修改 | `src/pages/AutoPopUp/index.tsx` |
| 已修改 | `src/pages/LiveControl/components/PlatformSelect.tsx` |
| 已修改 | `src/pages/LiveControl/components/StatusCard.tsx` |
| 已修改 | `src/utils/mockGoodsData.ts` |
| 新增 | `src/components/auth/SubscribeDialog.tsx` |
| 新增 | `src/stores/gateStore.ts` |
| 新增 | `src/stores/trialStore.ts` |

**说明**：上述变更包含「测试平台在正式版可见」「首次登录默认测试平台并提示试用」「Mock 商品在测试平台可用」「移除 [测试] 注入商品按钮」「测试平台商品不可见修复」等，发行前需**全部提交**后再打 tag / 构建。

---

## 二、版本与构建配置

| 项目 | 当前值 | 说明 |
|------|--------|------|
| `package.json` version | `1.0.0` | 已为 1.0.0，可直接用于正式版 |
| `package.json` productName | `TASI-live-Supertool` | 与文档一致 |
| `electron-builder.json` artifactName (win) | `TASI-live-Supertool_V1.0_win-x64.${ext}` | 写死 V1.0，与 1.0.x 一致 |
| 构建命令 | `npm run dist` | 会执行 dist:clean → build → dist:check → electron-builder --win |

**结论**：版本与产物命名已对齐，无需改版本号即可发行；若希望产物名随 `package.json` 的 version 变化，可把 `artifactName` 改为 `TASI-live-Supertool_${version}_win-x64.${ext}`（可选）。

---

## 三、环境与配置检查

### 3.1 鉴权 API（正式版必看）

- **文件**：`src/config/authApi.ts`
- **逻辑**：`MODE === 'production'` 时使用 `VITE_AUTH_API_BASE_URL ?? 'https://your-auth-api.example.com'`
- **建议**：正式版若使用云鉴权，请在**构建时**设置环境变量 `VITE_AUTH_API_BASE_URL` 为真实鉴权服务地址；否则打包后默认指向占位域名，需在文档中说明或后续通过配置覆盖。

### 3.2 Electron 主进程鉴权

- **文件**：`electron/main/ipc/auth.ts`
- **逻辑**：`USE_MOCK_AUTH` 仅在 `NODE_ENV === 'development'` 且未设 `USE_REAL_AUTH` 时为 true；打包后通常 `NODE_ENV=production`，故**正式包会走云鉴权**（若已配置 `AUTH_API_BASE_URL` / `VITE_AUTH_API_BASE_URL`）。

### 3.3 敏感信息

- `.gitignore` 已包含 `.env`、`.env.*`，未发现硬编码密钥；构建/运行若需密钥，请通过环境变量或构建时注入，勿提交进仓库。

---

## 四、代码质量与发行建议

### 4.1 console 使用情况

- **src 下**：约 150+ 处 `console.log` / `console.warn` / `console.error`，多为状态机、任务、门控等调试/排错输出。
- **建议**：发行不强制删除；若希望正式包控制台更干净，可后续用 Vite/Rollup 的 drop_console 或按 `import.meta.env.PROD` 条件化部分 log（**本次可不做**）。

### 4.2 TODO / FIXME

- `src/tasks/gateCheck.ts`：TODO 前置条件3（登录状态检查）
- `src/hooks/useLiveFeatureGate.ts`：TODO 前置条件3
- `src/utils/taskGate.ts`：TODO 前置条件2/3（直播状态、登录状态）
- `src/components/auth/UserCenter.tsx`：TODO 打开设置页面
- `src/components/common/ValidateNumberInput.tsx`：TODO 友好提示

**说明**：均为功能增强或边界条件，不阻塞当前正式版发行；可在发行后迭代处理。

### 4.3 Lint / 构建

- 建议发行前执行：`pnpm run build`（或 `npm run build`），确保无 TypeScript / Vite 报错；如有 lint 脚本也可跑一遍。

---

## 五、发行前准备步骤（建议顺序）

以下为**建议执行顺序**，您确认后再执行。

1. **提交当前所有变更**
   - 将上述「未提交变更」全部 add 并 commit，建议 message 示例：  
     `release: v1.0 正式版 - 测试平台入包、首次登录默认测试平台与试用提示`

2. **（可选）版本与 CHANGELOG**
   - 若沿用 `1.0.0`：无需改版本。
   - 若使用 `npm run release`：该脚本会 `git add CHANGELOG.md package.json` 并 commit、打 tag、push；需保证**已有 CHANGELOG.md**，或先执行 `npm run bump` 生成再 release。  
   - **若仅打 tag 并推送代码**：可跳过 `npm run release`，改为手动打 tag 和 push（见下）。

3. **打 Tag**
   - 建议 tag：`v1.0.0` 或 `v1.0`（与现有 RELEASE_V1.0_CHECKLIST 一致）
   - 命令示例：`git tag -a v1.0.0 -m "Release v1.0.0"`

4. **本地构建验证**
   - `npm run build`
   - `npm run dist`
   - 检查 `release/<version>/` 下是否生成：
     - `TASI-live-Supertool_V1.0_win-x64.exe`
     - `TASI-live-Supertool_V1.0_win-x64.zip`

5. **推送到远程**
   - 推送当前分支：`git push origin dev-after-electron-fix`（或您要发布的分支名）
   - 推送 tag：`git push origin v1.0.0`（或 `git push origin --tags`）

6. **Release 页面**
   - 在 GitHub / Gitee 的 Releases 中创建对应 tag 的 Release，上传上述 .exe 与 .zip，并粘贴或精简 `RELEASE_NOTES_V1.0.md` 作为说明（参考 `scripts/RELEASE_V1.0_CHECKLIST.md`）。

---

## 六、执行清单（您确认后执行的内容）

- [ ] 将当前所有未提交变更 **add + commit**（含上述 11 个文件）
- [ ] 打 tag：`v1.0.0`（或 `v1.0`）
- [ ] 本地执行 `npm run build` 与 `npm run dist` 做一次构建验证
- [ ] 推送分支与 tag 到远程（`git push` + `git push origin <tag>`）

**不包含**（需您自行决定或本地执行）：

- 不自动执行 `npm run release`（依赖 CHANGELOG.md，且会 commit+tag+push）
- 不修改 `package.json` version 或 `electron-builder.json` artifactName
- 不删除或修改代码中的 console / TODO

---

## 七、总结

| 检查项 | 状态 |
|--------|------|
| 版本号 1.0.0 | 已就绪 |
| 构建配置与产物名 | 已就绪 |
| 鉴权 API 配置 | 需在正式环境设置 VITE_AUTH_API_BASE_URL 或文档说明 |
| 未提交变更 | 需在发行前提交 |
| 阻塞性 TODO/console | 无，可发行 |
| 敏感信息 | 未发现泄露 |

**结论**：完成「提交变更 → 打 tag → 构建验证 → 推送」后，即可进行正式版发行；云鉴权正式地址需在构建或运行环境中单独配置。  

**您确认后，我将按上述清单执行：提交、打 tag、构建验证、推送（具体命令会按您仓库的远程与分支再定）。**
