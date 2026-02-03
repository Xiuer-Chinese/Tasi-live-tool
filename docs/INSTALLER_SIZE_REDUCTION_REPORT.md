# Windows 安装包体积优化报告

## 一、体积来源分析（优化前）

### 1.1 release/ 下前 20 大文件/体积（优化前）

| 路径 | 大小 (MB) |
|------|-----------|
| release\1.0.0\TASI-live-Supertool_V1.0_win-x64.zip | 379.6 |
| release\1.0.0\TASI-live-Supertool_V1.0_win-x64.exe | **285.61** |
| win-unpacked\TASI-live-Supertool.exe | 193.32 |
| resources\app.asar.unpacked\node_modules\**electron**\dist\electron.exe | **193.3** |
| resources\app.asar.unpacked\node_modules\**@biomejs**\cli-win32-x64\biome.exe | **57.76** |
| resources\app.asar.unpacked\node_modules\**app-builder-bin**\win\x64\app-builder.exe | 23.52 |
| app-builder-bin\win\arm64, ia32, mac, linux\* | 各 16–22 |
| node_modules\electron\dist\LICENSES.chromium.html | 14.49 |
| node_modules\**@esbuild**\win32-x64\esbuild.exe | 10.84 |
| node_modules\vite\node_modules\@esbuild\win32-x64\esbuild.exe | 10.13 |
| node_modules\electron\dist\icudtl.dat | 9.98 |
| node_modules\better-sqlite3\deps\sqlite3\sqlite3.c | 8.81 |
| node_modules\**typescript**\lib\typescript.js | 8.69 |
| node_modules\**lightningcss**-win32-x64-msvc\*.node | 8.59 |
| node_modules\**electron-winstaller**\vendor\Setup.pdb | 8.19 |
| node_modules\**lucide-react**\dist\*.js.map | 4.87 |

### 1.2 问题归纳

- **重复/无关运行时**：`node_modules/electron`（完整 Electron 二进制 ~193MB）被整包复制进 app.asar.unpacked，发行版无需该包。
- **仅构建/开发用**：`@biomejs`、`app-builder-bin`、`typescript`、`vite`、`@esbuild`、`electron-winstaller`、`lightningcss*` 等仅用于构建或签名，不应进入用户安装包。
- **Source map**：存在 `*.js.map`（如 lucide-react）被带入，增加体积且无运行时价值。
- **afterPack 全量复制**：原脚本将整个 `node_modules` 复制到 app.asar.unpacked，导致上述全部进入安装包。

---

## 二、修复策略与实施

### 2.1 禁止把 sourcemap 打进发行包

- **vite.config.ts**
  - 渲染器：`build.sourcemap = isBuild ? false : sourcemap`
  - 主进程：`main.vite.build.sourcemap = !isBuild`
  - preload：`sourcemap: isBuild ? false : (sourcemap ? 'inline' : undefined)`
- **electron-builder**
  - 在 `files` 中增加排除：`!**/*.map`

### 2.2 electron-builder files 白名单与排除

- **electron-builder.json** 的 `files` 增加：
  - `!**/*.map`
  - `!**/test/**`、`!**/tests/**`
  - `!**/docs/**`
  - `!**/.cache/**`、`!**/playwright/.cache/**`

### 2.3 排除 dev-only 依赖进入 app.asar.unpacked

- **scripts/electron-after-pack.js** 改为“按需复制 + 排除”：
  - 仍将运行所需的 `node_modules` 复制到 `app.asar.unpacked`，但复制时**排除**以下顶层包及 `*.map`：
    - `electron`（运行时使用系统 Electron，不需 node 内 electron）
    - `@biomejs`、`app-builder-bin`、`typescript`、`vite`、`electron-winstaller`、`@esbuild`
    - 任何以 `lightningcss` 开头的包
  - 实现方式：`fs.cpSync(..., { filter })`，在 filter 中对路径做上述排除。

### 2.4 asar 与压缩

- 尝试使用 `asar.compression: "maximum"`，当前 electron-builder 26.0.12 的 asar 配置仅支持 `ordering`、`smartUnpack`，**未采用** compression，保持 `asar: true`。

### 2.5 locales

- 未做裁剪，仍保留 `electronLanguages: ["zh-CN", "en-US"]`。

---

## 三、修改文件与关键片段

| 文件 | 改动摘要 |
|------|----------|
| **vite.config.ts** | 生产构建关闭 sourcemap（renderer/main/preload）；主进程 `sourcemap: !isBuild`。 |
| **electron-builder.json** | `files` 增加 `!**/*.map`、`!**/test/**`、`!**/tests/**`、`!**/docs/**`、`!**/.cache/**`、`!**/playwright/.cache/**`。 |
| **scripts/electron-after-pack.js** | 重写为带 filter 的 `cpSync`，排除 `electron`、`@biomejs`、`app-builder-bin`、`typescript`、`vite`、`electron-winstaller`、`@esbuild`、`lightningcss*` 及 `*.map`。 |

---

## 四、前后对比

### 4.1 安装包体积

| 产物 | 优化前 | 优化后 | 变化 |
|------|--------|--------|------|
| **TASI-live-Supertool_V1.0_win-x64.exe** | **285.61 MB** | **112.21 MB** | **−173.4 MB（约 −60.7%）** |
| **TASI-live-Supertool_V1.0_win-x64.zip** | **379.6 MB** | **148.53 MB** | **−231.07 MB（约 −60.9%）** |

### 4.2 resources/ 前 10 大文件对比

**优化前（前 10）：**

| 路径 | 大小 (MB) |
|------|-----------|
| app.asar.unpacked/node_modules/electron/dist/electron.exe | 193.3 |
| app.asar.unpacked/node_modules/@biomejs/cli-win32-x64/biome.exe | 57.76 |
| app.asar.unpacked/node_modules/app-builder-bin/win/x64/app-builder.exe | 23.52 |
| app-builder-bin/win/arm64, ia32, mac, linux/* | 各 16–22 |
| node_modules/electron/dist/LICENSES.chromium.html | 14.49 |
| node_modules/@esbuild/win32-x64/esbuild.exe | 10.84 |
| node_modules/vite/…/esbuild.exe | 10.13 |
| node_modules/electron/dist/icudtl.dat | 9.98 |
| node_modules/better-sqlite3/deps/sqlite3/sqlite3.c | 8.81 |
| node_modules/typescript/lib/typescript.js | 8.69 |

**优化后（前 10）：**

| 路径 | 大小 (MB) |
|------|-----------|
| app.asar.unpacked/node_modules/better-sqlite3/deps/sqlite3/sqlite3.c | 8.81 |
| app.asar.unpacked/node_modules/postject/dist/api.js | 4.62 |
| app.asar.unpacked/node_modules/@tailwindcss/oxide-win32-x64-msvc/*.node | 3.03 |
| app.asar.unpacked/node_modules/7zip-bin/mac/x64/7za | 2.81 |
| **app.asar** | **2.69** |
| app.asar.unpacked/node_modules/@rollup/rollup-win32-x64-msvc/*.node | 2.41 |
| app.asar.unpacked/node_modules/lucide-react/*.d.ts | 约 2.0 各 |
| @rollup/rollup-win32-x64-gnu/*.node | 1.88 |

优化后 app.asar.unpacked 中已无 electron、@biomejs、app-builder-bin、typescript、vite、@esbuild、electron-winstaller、lightningcss 等；最大项为运行所需的 better-sqlite3、playwright 相关依赖及少量构建链残留（如 rollup、tailwindcss/oxide、7zip-bin 多平台）。

---

## 五、约束与风险

- **未删除**：运行依赖（如 better-sqlite3、playwright、playwright-extra、puppeteer-extra-plugin-stealth）仍完整保留在 app.asar.unpacked。
- **未改业务逻辑**：仅打包范围与构建配置调整，未改代码逻辑。
- **未引入新依赖**：未新增 npm 包。
- **建议**：安装后在本机做一次“启动 + 登录 + 直播相关功能”的快速回归，确认无缺包或路径问题。

---

## 六、总结

通过**关闭生产 sourcemap**、**在 electron-builder 中排除 \*.map 与 test/docs/cache**、以及 **afterPack 时排除仅开发/构建用 node_modules**，Windows 安装包从约 **286 MB 降至约 112 MB**，体积减少约 **61%**，且满足不删运行必需文件、不改业务逻辑、不引入新依赖的约束。
