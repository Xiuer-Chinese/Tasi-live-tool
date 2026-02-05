/**
 * electron-builder afterPack：将运行所需的 node_modules 复制到 app.asar.unpacked，
 * 使主进程 require('better-sqlite3')、playwright 等能从 app.asar.unpacked/node_modules 解析。
 *
 * 优化策略 v2.0：
 * 1. 使用白名单模式，只复制主进程运行时需要的依赖
 * 2. 排除 source map、类型声明、测试文件
 * 3. 删除 Native 模块源码（better-sqlite3/deps）
 * 4. 裁剪多平台二进制（7zip-bin 仅保留 win/x64）
 * 5. 删除 playwright 调试资源（traceViewer、htmlReport）
 */
const path = require('path')
const fs = require('fs')

// ============================================================
// 白名单配置：主进程运行时需要的依赖
// ============================================================

// 主进程直接依赖（package.json 中的 dependencies）
const MAIN_PROCESS_DEPS = new Set([
  'bcryptjs',
  'better-sqlite3',
  'electron-updater',
  'jsonwebtoken',
  'playwright',
  'playwright-extra',
  'playwright-extra-plugin-stealth',
  'puppeteer-extra-plugin-stealth',
  'uuid',
  'xlsx',
  // electron-log 用于日志
  'electron-log',
])

// 这些依赖的子依赖也需要保留
const TRANSITIVE_DEPS_WHITELIST = new Set([
  // playwright 相关
  'playwright-core',
  // better-sqlite3 相关
  'bindings',
  'prebuild-install',
  'node-addon-api',
  'file-uri-to-path',
  // electron-updater 相关
  'builder-util-runtime',
  'lazy-val',
  'semver',
  'semver-compare',
  'lodash.isequal',
  'js-yaml',
  'argparse',
  'sax',
  // xlsx 相关
  'adler-32',
  'cfb',
  'codepage',
  'crc-32',
  'frac',
  'ssf',
  'wmf',
  'word',
  // jsonwebtoken 相关
  'jws',
  'jwa',
  'safe-buffer',
  'buffer-equal-constant-time',
  'ecdsa-sig-formatter',
  'ms',
  'lodash.includes',
  'lodash.isboolean',
  'lodash.isinteger',
  'lodash.isnumber',
  'lodash.isplainobject',
  'lodash.isstring',
  'lodash.once',
  // puppeteer-extra 相关
  'puppeteer-extra-plugin',
  'puppeteer-extra-plugin-user-data-dir',
  'puppeteer-extra-plugin-user-preferences',
  'deepmerge',
  'debug',
  // 其他常用工具
  'graceful-fs',
  'fs-extra',
  'universalify',
  'jsonfile',
])

// 开发/构建依赖黑名单（绝对不复制）
const DEV_BUILD_BLACKLIST = new Set([
  // === 构建工具 ===
  'electron',
  '@biomejs',
  'app-builder-bin',
  'app-builder-lib',
  'typescript',
  'vite',
  'electron-winstaller',
  '@esbuild',
  'esbuild',
  '@babel',
  'caniuse-lite',
  'jiti',
  'postcss',
  'autoprefixer',
  'tailwindcss',
  '@tailwindcss',
  '@rollup',
  'rollup',
  'terser',
  'cssnano',
  'browserslist',
  'lightningcss',
  '@types',
  'husky',
  'lint-staged',
  'bumpp',
  'changelogen',
  'cross-env',
  'tsx',
  'vitest',
  '.vite',
  'postject',
  'source-map',
  'source-map-js',

  // === 渲染进程依赖（已被 Vite 打包） ===
  'react',
  'react-dom',
  'react-router',
  'react-router-dom',
  '@vitejs',
  '@radix-ui',
  'lucide-react',
  'framer-motion',
  'motion',
  'motion-dom',
  'motion-utils',
  'zustand',
  'immer',
  'ahooks',
  'clsx',
  'class-variance-authority',
  'tailwind-merge',
  'tw-animate-css',
  'marked',
  'react-markdown',
  'highlight.js',
  'rehype-highlight',
  'remark-gfm',
  'dompurify',
  'openai',
  'vaul',
  '@floating-ui',
  '@welldone-software',
  'lodash',
  'lodash-es',
  'dayjs',

  // === Markdown/AST 处理（已被 Vite 打包） ===
  'unified',
  'unist-util-visit',
  'unist-util-is',
  'unist-util-visit-parents',
  'micromark',
  'mdast-util-from-markdown',
  'mdast-util-to-hast',
  'hast-util-to-jsx-runtime',
  'devlop',
  'property-information',
  'space-separated-tokens',
  'comma-separated-tokens',
  'estree-util-is-identifier-name',
  'vfile',
  'vfile-message',
  'bail',
  'trough',
  'is-plain-obj',
])

// 文件排除模式
const EXCLUDE_FILE_PATTERNS = [
  /\.map$/,
  /\.d\.ts$/,
  /\.d\.mts$/,
  /\.d\.cts$/,
  /__tests__\//,
  /__mocks__\//,
  /\/test\//,
  /\/tests\//,
  /\.test\./,
  /\.spec\./,
]

// ============================================================
// 核心逻辑
// ============================================================

function isAllowedPackage(packageName) {
  // 检查黑名单
  if (DEV_BUILD_BLACKLIST.has(packageName)) return false
  if (packageName.startsWith('lightningcss')) return false
  if (packageName.startsWith('@types/')) return false

  // 检查白名单
  if (MAIN_PROCESS_DEPS.has(packageName)) return true
  if (TRANSITIVE_DEPS_WHITELIST.has(packageName)) return true

  // 对于不在白名单也不在黑名单的包，默认允许（保守策略）
  return true
}

function shouldExclude(source) {
  const normalized = source.replace(/\\/g, '/')

  // 检查文件排除模式
  for (const pattern of EXCLUDE_FILE_PATTERNS) {
    if (pattern.test(normalized)) {
      return true
    }
  }

  // 检查 node_modules 中的包
  const nmIndex = normalized.lastIndexOf('node_modules/')
  if (nmIndex === -1) return false

  const afterNm = normalized.slice(nmIndex + 'node_modules/'.length)
  const segments = afterNm.split('/')
  let packageName = segments[0]

  // 处理 scoped 包
  if (packageName.startsWith('@') && segments.length > 1) {
    packageName = segments[0] + '/' + segments[1]
  }

  return !isAllowedPackage(packageName)
}

/**
 * 清理 Native 模块源码和不需要的文件
 */
function cleanupNativeModules(destNodeModules) {
  console.log('[afterPack] Cleaning up native module source files...')

  // 1. 删除 better-sqlite3 源码（仅需 .node 二进制）
  const sqliteDeps = path.join(destNodeModules, 'better-sqlite3', 'deps')
  if (fs.existsSync(sqliteDeps)) {
    fs.rmSync(sqliteDeps, { recursive: true, force: true })
    console.log('[afterPack]   - Removed better-sqlite3/deps (~9MB)')
  }

  // 2. 删除 better-sqlite3 的 src 目录（C++ 源码）
  const sqliteSrc = path.join(destNodeModules, 'better-sqlite3', 'src')
  if (fs.existsSync(sqliteSrc)) {
    fs.rmSync(sqliteSrc, { recursive: true, force: true })
    console.log('[afterPack]   - Removed better-sqlite3/src')
  }
}

/**
 * 裁剪多平台二进制文件
 */
function trimMultiPlatformBinaries(destNodeModules) {
  if (!fs.existsSync(destNodeModules)) return

  console.log('[afterPack] Trimming multi-platform binaries...')

  // 1. 7zip-bin：仅保留 win/x64
  const zipBinDir = path.join(destNodeModules, '7zip-bin')
  if (fs.existsSync(zipBinDir)) {
    const platformsToRemove = ['mac', 'linux']
    for (const platform of platformsToRemove) {
      const platformDir = path.join(zipBinDir, platform)
      if (fs.existsSync(platformDir)) {
        fs.rmSync(platformDir, { recursive: true, force: true })
        console.log(`[afterPack]   - Removed 7zip-bin/${platform}`)
      }
    }
    // 删除 win/ia32 和 win/arm64
    const winDir = path.join(zipBinDir, 'win')
    if (fs.existsSync(winDir)) {
      for (const arch of ['ia32', 'arm64']) {
        const archDir = path.join(winDir, arch)
        if (fs.existsSync(archDir)) {
          fs.rmSync(archDir, { recursive: true, force: true })
          console.log(`[afterPack]   - Removed 7zip-bin/win/${arch}`)
        }
      }
    }
  }

  // 2. 删除其他平台的 native 模块
  try {
    const entries = fs.readdirSync(destNodeModules, { withFileTypes: true })
    const scopes = entries.filter(d => d.isDirectory() && d.name.startsWith('@'))

    for (const scope of scopes) {
      const scopeDir = path.join(destNodeModules, scope.name)
      const packages = fs.readdirSync(scopeDir, { withFileTypes: true })

      for (const pkg of packages) {
        if (!pkg.isDirectory()) continue

        // 删除非 win-x64 的平台特定包
        const pkgName = pkg.name.toLowerCase()
        if (
          (pkgName.includes('darwin') ||
            pkgName.includes('linux') ||
            pkgName.includes('-arm64') ||
            pkgName.includes('-arm-') ||
            pkgName.includes('-ia32')) &&
          !pkgName.includes('win32-x64')
        ) {
          const pkgDir = path.join(scopeDir, pkg.name)
          fs.rmSync(pkgDir, { recursive: true, force: true })
          console.log(`[afterPack]   - Removed ${scope.name}/${pkg.name}`)
        }
      }
    }
  } catch (err) {
    console.warn('[afterPack] Warning during multi-platform cleanup:', err.message)
  }
}

/**
 * 删除 Playwright 调试资源
 */
function cleanupPlaywright(destNodeModules) {
  if (!fs.existsSync(destNodeModules)) return

  console.log('[afterPack] Cleaning up playwright debug resources...')

  const pwCore = path.join(destNodeModules, 'playwright-core')
  if (!fs.existsSync(pwCore)) return

  // 删除 vite 目录（traceViewer、htmlReport、recorder）
  const viteDir = path.join(pwCore, 'lib', 'vite')
  if (fs.existsSync(viteDir)) {
    fs.rmSync(viteDir, { recursive: true, force: true })
    console.log('[afterPack]   - Removed playwright-core/lib/vite (~3MB)')
  }

  // 注意：不要删除 mcpBundleImpl！
  // playwright-core 在加载时会 require('./mcpBundleImpl')，删除会导致运行时错误
  // mcpBundleImpl 只有 ~0.65MB，保留它是值得的

  // 删除 Playwright 浏览器下载（使用系统 Chrome/Edge 时不需要）
  const pwPackages = ['playwright', 'playwright-core']
  for (const pkg of pwPackages) {
    const browsersDir = path.join(destNodeModules, pkg, '.local-browsers')
    if (fs.existsSync(browsersDir)) {
      fs.rmSync(browsersDir, { recursive: true, force: true })
      console.log(`[afterPack]   - Removed ${pkg}/.local-browsers`)
    }

    const cacheDir = path.join(destNodeModules, pkg, '.cache')
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true })
      console.log(`[afterPack]   - Removed ${pkg}/.cache`)
    }
  }
}

/**
 * 计算目录大小
 */
function getDirectorySize(dir) {
  let size = 0
  if (!fs.existsSync(dir)) return size

  try {
    const files = fs.readdirSync(dir, { withFileTypes: true })
    for (const file of files) {
      const filePath = path.join(dir, file.name)
      if (file.isDirectory()) {
        size += getDirectorySize(filePath)
      } else {
        try {
          size += fs.statSync(filePath).size
        } catch {
          // 忽略无法访问的文件
        }
      }
    }
  } catch {
    // 忽略无法访问的目录
  }
  return size
}

// ============================================================
// 主函数
// ============================================================

module.exports = async function (context) {
  const appOutDir = context.appOutDir
  const projectRoot = process.cwd()
  const unpackedDir = path.join(appOutDir, 'resources', 'app.asar.unpacked')
  const destNodeModules = path.join(unpackedDir, 'node_modules')
  const sourceNodeModules = path.join(projectRoot, 'node_modules')

  console.log('\n========================================')
  console.log('[afterPack] Starting optimized packaging...')
  console.log('========================================\n')

  if (!fs.existsSync(sourceNodeModules)) {
    console.warn('[afterPack] node_modules not found at', sourceNodeModules)
    return
  }

  // 创建目标目录
  fs.mkdirSync(unpackedDir, { recursive: true })
  if (fs.existsSync(destNodeModules)) {
    fs.rmSync(destNodeModules, { recursive: true, force: true })
  }

  // 第一阶段：选择性复制 node_modules
  console.log('[afterPack] Phase 1: Copying required node_modules...')
  let excludedPackages = new Set()
  let copiedCount = 0

  fs.cpSync(sourceNodeModules, destNodeModules, {
    recursive: true,
    filter: (source) => {
      const exclude = shouldExclude(source)
      if (exclude) {
        // 记录被排除的顶层包
        const normalized = source.replace(/\\/g, '/')
        const nmIndex = normalized.lastIndexOf('node_modules/')
        if (nmIndex !== -1) {
          const afterNm = normalized.slice(nmIndex + 'node_modules/'.length)
          const segments = afterNm.split('/')
          let pkgName = segments[0]
          if (pkgName.startsWith('@') && segments.length > 1) {
            pkgName = segments[0] + '/' + segments[1]
          }
          excludedPackages.add(pkgName)
        }
      } else {
        copiedCount++
      }
      return !exclude
    },
  })

  console.log(`[afterPack]   - Copied ${copiedCount} items`)
  console.log(`[afterPack]   - Excluded packages: ${excludedPackages.size}`)

  // 第二阶段：清理 Native 模块源码
  console.log('\n[afterPack] Phase 2: Post-copy cleanup...')
  cleanupNativeModules(destNodeModules)

  // 第三阶段：裁剪多平台二进制
  trimMultiPlatformBinaries(destNodeModules)

  // 第四阶段：清理 Playwright 调试资源
  cleanupPlaywright(destNodeModules)

  // 计算最终大小
  const finalSize = getDirectorySize(destNodeModules)
  console.log('\n========================================')
  console.log(`[afterPack] Completed! Final node_modules size: ${(finalSize / 1024 / 1024).toFixed(2)} MB`)
  console.log('========================================\n')
}
