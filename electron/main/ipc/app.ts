import { app, BrowserWindow, shell } from 'electron'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { accountManager } from '#/managers/AccountManager'
import { clearStoredTokens } from '#/services/CloudAuthStorage'
import { typedIpcMainHandle } from '#/utils'

function setupIpcHandlers() {
  typedIpcMainHandle(IPC_CHANNELS.chrome.toggleDevTools, event => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
      if (win.webContents.isDevToolsOpened()) {
        win.webContents.closeDevTools()
      } else {
        win.webContents.openDevTools()
      }
    }
  })

  typedIpcMainHandle(IPC_CHANNELS.app.openLogFolder, () => {
    shell.openPath(app.getPath('logs'))
  })

  typedIpcMainHandle(IPC_CHANNELS.app.openExternal, (_, url: string) => {
    shell.openExternal(url)
  })

  typedIpcMainHandle(IPC_CHANNELS.account.switch, (_, { account }) => {
    accountManager.setAccountName(account.id, account.name)
  })

  /** 清除本地登录数据：主进程 token 存储（userData/auth/tokens.enc），渲染进程需自行清除 localStorage 与 store */
  typedIpcMainHandle(IPC_CHANNELS.app.clearLocalLoginData, async () => {
    clearStoredTokens()
  })
}

export function setupAppIpcHandlers() {
  setupIpcHandlers()
}
