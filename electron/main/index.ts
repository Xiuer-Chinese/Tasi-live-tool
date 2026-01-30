import { appendFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { app } from 'electron'

// 打包后主进程 require 从 app.asar.unpacked/node_modules 解析（native、playwright 等 external）
const UNPACKED_EXTERNALS = new Set([
  'better-sqlite3',
  'electron-updater',
  'playwright',
  'playwright-extra',
  'playwright-extra-plugin-stealth',
  'puppeteer-extra-plugin-stealth',
])
if (app.isPackaged && process.resourcesPath) {
  const Mod = require('module') as { prototype: { require: (id: string) => unknown } }
  const unpackedNodeModules = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules')
  const originalRequire = Mod.prototype.require
  Mod.prototype.require = function (id: string) {
    if (UNPACKED_EXTERNALS.has(id)) {
      return originalRequire.call(this, path.join(unpackedNodeModules, id))
    }
    return originalRequire.call(this, id)
  }
}

const TASI_CRASH_PATH = path.join(process.env.TEMP ?? os.tmpdir(), 'tasi-crash.txt')
function writeCrashToTemp(tag: string, err: unknown): void {
  try {
    const ts = new Date().toISOString()
    const stack = err instanceof Error ? err.stack : String(err)
    const msg = err instanceof Error ? err.message : String(err)
    appendFileSync(TASI_CRASH_PATH, `\n[${ts}] ${tag}\n${msg}\n${stack}\n`)
  } catch (_) {}
}

process.on('uncaughtException', (error: Error) => {
  writeCrashToTemp('uncaughtException', error)
})
process.on('unhandledRejection', (reason: unknown) => {
  writeCrashToTemp('unhandledRejection', reason)
})

if (typeof process.setSourceMapsEnabled === 'function') {
  process.setSourceMapsEnabled(true)
}

void import('./app')
