import { rmSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron/simple'
import pkg from './package.json'

// https://vitejs.dev/config/
export default defineConfig(({ command }) => {
  rmSync('dist-electron', { recursive: true, force: true })

  const isServe = command === 'serve'
  const isBuild = command === 'build'
  const sourcemap = isServe || !!process.env.VSCODE_DEBUG

  return {
    base: isBuild ? './' : '/',
    build: {
      sourcemap: sourcemap, // 启用 sourcemap 以便在 DevTools 中定位到 src 文件
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
              console.log(/* For `.vscode/.debug.script.mjs` */ '[startup] Electron App')
            } else {
              args.startup()
            }
          },
          vite: {
            build: {
              sourcemap: true,
              minify: false, // 开启前后差距大概 100kb
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: [
                  // 将 ws 移入 devDependencies 后启动报错，需要排除下面两个包
                  // (ws 移回 dependencies 虽然正常不报错，但是安装后启动也会报错)
                  'bufferutil',
                  'utf-8-validate',
                  ...Object.keys('dependencies' in pkg ? pkg.dependencies : {}),
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
          // Shortcut of `build.rollupOptions.input`.
          // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
          input: 'electron/preload/index.ts',
          vite: {
            build: {
              sourcemap: sourcemap ? 'inline' : undefined, // #332
              minify: isBuild,
              outDir: 'dist-electron/preload',
              rollupOptions: {
                external: [...Object.keys('dependencies' in pkg ? pkg.dependencies : {})],
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
