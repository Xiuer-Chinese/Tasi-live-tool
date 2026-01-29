import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  Notification,
  nativeImage,
  shell,
  Tray,
} from 'electron'
import { updateManager } from './managers/UpdateManager'
import windowManager from './windowManager'
import './ipc'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createLogger } from './logger'

// const _require = createRequire(import.meta.url)

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//

function createBoxedString(lines: string[]) {
  // 1. 计算最长的一行文字长度
  const maxLength = Math.max(...lines.map(line => line.length))

  // 2. 定义边框样式
  // 顶部和底部边框 (例如: +----------------+)
  const horizontalLine = `+${'-'.repeat(maxLength + 2)}+`

  // 3. 生成中间的内容行
  const content = lines
    .map(line => {
      // 使用 padEnd 补齐空格，使得右边框对齐
      return `| ${line.padEnd(maxLength)} |`
    })
    .join('\n')

  // 4. 拼接结果
  return `\n${horizontalLine}\n${content}\n${horizontalLine}`
}

function logStartupInfo() {
  const appInfo = [
    `App Name:     ${app.getName()}`,
    `App Version:  ${app.getVersion()}`,
    `Electron Ver: ${process.versions.electron}`,
    `Node Ver:     ${process.versions.node}`,
    `Platform:     ${process.platform} (${process.arch})`,
    `Environment:  ${app.isPackaged ? 'Production' : 'Development'}`,
  ]
  const logger = createLogger('startup')
  logger.debug(createBoxedString(appInfo))
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

app.commandLine.appendSwitch('remote-debugging-port', '9222')

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false
// vite-plugin-electron outputs preload as .js file
const preload = path.join(__dirname, '../preload/index.js')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

// 持久化配置文件的路径
const getConfigPath = () => path.join(app.getPath('userData'), 'app-config.json')

// 读取配置
function getConfig(): { hideToTrayTipDismissed: boolean } {
  const configPath = getConfigPath()
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      createLogger('config').error('Failed to read config file:', error)
    }
  }
  return { hideToTrayTipDismissed: false }
}

// 写入配置
function setConfig(config: { hideToTrayTipDismissed: boolean }) {
  const configPath = getConfigPath()
  try {
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (error) {
    createLogger('config').error('Failed to write config file:', error)
  }
}

async function createWindow() {
  win = new BrowserWindow({
    title: `她似-Live-Supertool - v${app.getVersion()}`,
    width: 1280,
    height: 800,
    autoHideMenuBar: app.isPackaged,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload,
      // Security: Use contextBridge instead of nodeIntegration
      // When contextIsolation is true, nodeIntegration should be false
      nodeIntegration: false,
      contextIsolation: true, // Required for contextBridge to work
      // Enable webSecurity for production
      webSecurity: app.isPackaged,
    },
  })

  // 确保窗口显示时任务栏可见
  win.setSkipTaskbar(false)

  windowManager.setMainWindow(win)

  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // 加载完成后检查更新
  win.webContents.on('did-finish-load', async () => {
    await updateManager.silentCheckForUpdate()
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // 拦截窗口关闭事件，改为隐藏到托盘
  win.on('close', e => {
    if (!isQuitting) {
      e.preventDefault()

      // 检查是否需要显示首次提示（在隐藏前检查，确保能立即显示）
      const config = getConfig()
      const shouldShowTip = !config.hideToTrayTipDismissed

      // 隐藏窗口并设置不在任务栏显示
      win?.hide()
      win?.setSkipTaskbar(true)

      // 立即显示系统通知（不依赖渲染进程）
      if (shouldShowTip && Notification.isSupported()) {
        const notification = new Notification({
          title: '已最小化到托盘',
          body: '应用仍在后台运行，可从托盘图标打开。可在设置中关闭此提示。',
          icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
          silent: false,
        })

        notification.on('click', () => {
          // 点击通知时显示主窗口
          if (win) {
            win.show()
            win.setSkipTaskbar(false)
            win.focus()
          }
        })

        notification.show()
      }
    }
  })
}

app
  .whenReady()
  .then(logStartupInfo)
  .then(() => {
    createWindow()
    createTray()
  })

app.on('window-all-closed', async () => {
  // Windows/Linux: 不退出应用，保持托盘运行
  // macOS: 保持默认行为（dock 图标仍存在）
  if (process.platform === 'darwin') {
    // macOS 保持默认行为
  } else {
    // Windows/Linux: 不退出，应用继续在后台运行（托盘）
    // 只有通过托盘菜单"退出程序"才会真正退出
  }
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.show()
    win.setSkipTaskbar(false) // 恢复任务栏显示
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

process.on('uncaughtException', error => {
  const logger = createLogger('uncaughtException')
  logger.error('--------------意外的未捕获异常---------------')
  logger.error(error)
  logger.error('---------------------------------------------')

  dialog.showErrorBox('应用程序错误', `发生了一个意外的错误，请联系技术支持：\n${error.message}`)
})

process.on('unhandledRejection', reason => {
  // playwright-extra 插件问题：在 browser.close() 时概率触发
  // https://github.com/berstend/puppeteer-extra/issues/858
  const logger = createLogger('unhandledRejection')
  if (
    reason instanceof Error &&
    reason.message.includes('cdpSession.send: Target page, context or browser has been closed')
  ) {
    return logger.verbose(reason)
  }

  logger.error('--------------未被处理的错误---------------')
  logger.error(reason)
  logger.error('-------------------------------------------')
})

// 创建系统托盘
function createTray() {
  // 使用应用图标作为托盘图标
  const iconPath = path.join(process.env.VITE_PUBLIC, 'favicon.ico')
  let trayIcon: nativeImage

  try {
    trayIcon = nativeImage.createFromPath(iconPath)
    // 如果图标太大，调整尺寸（Windows 推荐 16x16）
    if (trayIcon.getSize().width > 16) {
      trayIcon = trayIcon.resize({ width: 16, height: 16 })
    }
  } catch (error) {
    createLogger('tray').warn('Failed to load tray icon, using default:', error)
    // 如果加载失败，创建一个简单的默认图标
    trayIcon = nativeImage.createEmpty()
  }

  tray = new Tray(trayIcon)
  tray.setToolTip(app.getName())

  // 创建托盘菜单
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        if (win) {
          win.show()
          win.setSkipTaskbar(false) // 恢复任务栏显示
          win.focus()
        } else {
          createWindow()
        }
      },
    },
    {
      type: 'separator',
    },
    {
      label: '退出程序',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  // 托盘图标单击：显示/聚焦主窗口
  tray.on('click', () => {
    if (win) {
      if (win.isVisible()) {
        win.focus()
      } else {
        win.show()
        win.setSkipTaskbar(false) // 恢复任务栏显示
        win.focus()
      }
    } else {
      createWindow()
    }
  })
}

// IPC 处理：设置"不再提示"标记
ipcMain.handle('app:setHideToTrayTipDismissed', (_, dismissed: boolean) => {
  const config = getConfig()
  config.hideToTrayTipDismissed = dismissed
  setConfig(config)
})

// IPC 处理：获取"不再提示"标记
ipcMain.handle('app:getHideToTrayTipDismissed', () => {
  const config = getConfig()
  return config.hideToTrayTipDismissed
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})
