import { copyFileSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

/** 主进程构建完成后复制 runtime（含 load-playwright.cjs），dev 时也会执行，避免主进程 require 报错 */
function copyMainRuntime() {
  return {
    name: 'copy-main-runtime',
    closeBundle() {
      const root = process.cwd()
      const srcDir = path.join(root, 'electron', 'main', 'runtime')
      const destDir = path.join(root, 'dist-electron', 'main', 'runtime')
      const file = 'load-playwright.cjs'
      if (!existsSync(path.join(srcDir, file))) return
      mkdirSync(destDir, { recursive: true })
      copyFileSync(path.join(srcDir, file), path.join(destDir, file))
    },
  }
}

console.log('>>> USING VITE CONFIG:', __filename)

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  const isServe = command === 'serve'
  const isBuild = command === 'build'
  // 仅在生产构建时清空 dist-electron，开发时保留以免 Electron 启动找不到 main
  if (isBuild) {
    rmSync('dist-electron', { recursive: true, force: true })
  }
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    base: isBuild ? './' : '/',
    build: {
      // 生产构建不打 sourcemap，减小发行包体积
      sourcemap: isBuild ? false : sourcemap,
      // 生产构建去掉 console/debugger，减少控制台泄露与噪音
      ...(isBuild && { esbuild: { drop: ['console', 'debugger'] } }),
    },
    resolve: {
      alias: {
        '@': path.join(__dirname, 'src'),
        shared: path.join(__dirname, 'shared'),
      },
    },
    plugins: [
      react(),
      tailwindcss(),
      electron({
        main: {
          entry: 'electron/main/index.ts',
          onstart(args) {
            if (process.env.VSCODE_DEBUG) {
              console.log('[startup] Electron App')
            } else {
              console.log('\n[Electron] 正在启动桌面窗口，请稍候…')
              args.startup()
              console.log(
                '[Electron] 已启动。若未看到窗口，请检查任务栏/系统托盘，或在浏览器打开上方显示的 Local 地址。\n',
              )
            }
          },
          vite: {
            build: {
              sourcemap: !isBuild,
              minify: false,
              outDir: 'dist-electron/main',
              ...(isBuild && { esbuild: { drop: ['console', 'debugger'] } }),
              rollupOptions: {
                external: [
                  'electron',
                  'playwright',
                  'playwright-extra',
                  'playwright-extra-plugin-stealth',
                  'puppeteer-extra-plugin-stealth',
                  'bufferutil',
                  'utf-8-validate',
                  'better-sqlite3',
                  'electron-updater',
                ],
              },
            },
            resolve: {
              alias: {
                '#': path.join(__dirname, 'electron/main'),
                shared: path.join(__dirname, 'shared'),
              },
            },
            plugins: [copyMainRuntime()],
          },
        },
        preload: {
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: isBuild ? false : sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron/preload',
              ...(isBuild && { esbuild: { drop: ['console', 'debugger'] } }),
              rollupOptions: {
                external: [
                  'playwright',
                  'playwright-extra',
                  'playwright-extra-plugin-stealth',
                  'puppeteer-extra-plugin-stealth',
                  'bufferutil',
                  'utf-8-validate',
                  'better-sqlite3',
                  'electron-updater',
                ],
              },
            },
            resolve: {
              alias: {
                shared: path.join(__dirname, 'shared'),
              },
            },
          },
        },
        renderer: {},
      }),
    ],
    server: {
      // 强制使用 IPv4，避免 Electron 连接 IPv6 失败
      host: '127.0.0.1',
      port: 5173,
      strictPort: true,
    },
    clearScreen: false,
  }
})
