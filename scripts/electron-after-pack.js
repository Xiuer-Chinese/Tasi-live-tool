/**
 * electron-builder afterPack：将运行所需的 node_modules 复制到 app.asar.unpacked，
 * 使主进程 require('better-sqlite3')、playwright 等能从 app.asar.unpacked/node_modules 解析。
 * 排除仅开发/构建用包以减小安装包体积（如 electron、@biomejs、app-builder-bin、typescript、vite、*.map）。
 */
const path = require('path')
const fs = require('fs')

const DEV_ONLY_TOP_LEVEL = new Set([
  'electron',
  '@biomejs',
  'app-builder-bin',
  'typescript',
  'vite',
  'electron-winstaller',
  '@esbuild',
])

function shouldExclude(source) {
  if (source.endsWith('.map')) return true
  const normalized = source.replace(/\//g, path.sep)
  const sep = path.sep
  const nm = 'node_modules' + sep
  const idx = normalized.lastIndexOf(nm)
  if (idx === -1) return false
  const afterNm = normalized.slice(idx + nm.length)
  const firstSegment = afterNm.split(sep)[0]
  if (DEV_ONLY_TOP_LEVEL.has(firstSegment)) return true
  if (firstSegment.startsWith('lightningcss')) return true
  return false
}

module.exports = async function (context) {
  const appOutDir = context.appOutDir
  const projectRoot = process.cwd()
  const unpackedDir = path.join(appOutDir, 'resources', 'app.asar.unpacked')
  const destNodeModules = path.join(unpackedDir, 'node_modules')
  const sourceNodeModules = path.join(projectRoot, 'node_modules')

  if (!fs.existsSync(sourceNodeModules)) {
    console.warn('[afterPack] node_modules not found at', sourceNodeModules)
    return
  }

  fs.mkdirSync(unpackedDir, { recursive: true })
  if (fs.existsSync(destNodeModules)) {
    fs.rmSync(destNodeModules, { recursive: true, force: true })
  }

  fs.cpSync(sourceNodeModules, destNodeModules, {
    recursive: true,
    filter: (source) => {
      if (shouldExclude(source)) {
        return false
      }
      return true
    },
  })
  console.log('[afterPack] Copied node_modules to app.asar.unpacked (dev-only packages excluded)')
}
