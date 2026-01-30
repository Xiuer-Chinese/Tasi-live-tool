import { rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

console.log('>>> USING VITE CONFIG:', __filename)

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  rmSync('dist-electron', { recursive: true, force: true })

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    base: isBuild ? './' : '/',
    build: {
      sourcemap,
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
              args.startup()
            }
          },
          vite: {
            build: {
              sourcemap: true,
              minify: false,
              outDir: 'dist-electron/main',
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
                '#': path.join(__dirname, 'electron/main'),
                shared: path.join(__dirname, 'shared'),
              },
            },
          },
        },
        preload: {
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined,
              minify: isBuild,
              outDir: 'dist-electron/preload',
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
    server:
      process.env.VSCODE_DEBUG &&
      (() => {
        const url = new URL(pkg.debug.env.VITE_DEV_SERVER_URL)
        return {
          host: url.hostname,
          port: +url.port,
        }
      })(),
    clearScreen: false,
  }
})
