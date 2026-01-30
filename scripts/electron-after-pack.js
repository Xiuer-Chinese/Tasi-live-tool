/**
 * electron-builder afterPack：将项目 node_modules 复制到 app.asar.unpacked，
 * 使主进程 require('better-sqlite3') 等能从 app.asar.unpacked/node_modules 解析。
 */
const path = require('path')
const fs = require('fs')

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
  fs.cpSync(sourceNodeModules, destNodeModules, { recursive: true })
  console.log('[afterPack] Copied node_modules to app.asar.unpacked')
}
