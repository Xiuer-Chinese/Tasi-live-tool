import process from 'node:process'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { createLogger } from '#/logger'
import { accountManager } from '#/managers/AccountManager'
import { browserManager } from '#/managers/BrowserSessionManager'
import { typedIpcMainHandle } from '#/utils'
import windowManager from '#/windowManager'

const TASK_NAME = '中控台'

/** 主进程允许同时连接的最大账号数，避免内存与 FD 耗尽 */
const MAX_CONCURRENT_ACCOUNTS = 10

function setupIpcHandlers() {
  typedIpcMainHandle(
    IPC_CHANNELS.tasks.liveControl.connect,
    async (_, { chromePath, headless, storageState, platform, account }) => {
      try {
        const currentCount = accountManager.accountSessions.size
        if (currentCount >= MAX_CONCURRENT_ACCOUNTS) {
          const msg = `同时连接账号数已达上限（${MAX_CONCURRENT_ACCOUNTS}），请先断开部分账号再连接`
          createLogger(TASK_NAME).warn(msg)
          return {
            success: false,
            browserLaunched: false,
            error: msg,
          }
        }

        if (chromePath) {
          browserManager.setChromePath(chromePath)
        }
        const accountSession = accountManager.createSession(platform, account)

        // 打点：连接数 + 主进程内存，便于观测多账号资源占用
        const mem = process.memoryUsage()
        createLogger(TASK_NAME).info(
          `[资源] 当前连接数=${accountManager.accountSessions.size} heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB rss=${Math.round(mem.rss / 1024 / 1024)}MB`,
        )

        // 不阻塞等待登录完成，立即返回表示浏览器已启动
        // 登录成功会通过 notifyAccountName 事件通知前端
        accountSession
          .connect({
            headless,
            storageState,
          })
          .catch(error => {
            const logger = createLogger(`@${account.name}`).scope(TASK_NAME)
            logger.error('连接直播控制台失败：', error)
            accountManager.closeSession(account.id)
            // 发送连接失败事件
            windowManager.send(
              IPC_CHANNELS.tasks.liveControl.disconnectedEvent,
              account.id,
              error instanceof Error ? error.message : '连接直播控制台失败',
            )
          })

        // 立即返回 true，表示浏览器启动流程已开始
        // 实际登录状态通过事件通知
        return { success: true, browserLaunched: true }
      } catch (error) {
        const logger = createLogger(`@${account.name}`).scope(TASK_NAME)
        // 浏览器启动失败是非致命错误，只记录警告
        logger.warn('启动浏览器时出现问题（非致命）：', error)
        // 不关闭会话，因为可能只是临时问题
        // 返回部分成功，让前端知道浏览器启动可能有问题，但不阻止后续流程
        return {
          success: false,
          browserLaunched: false,
          error: error instanceof Error ? error.message : '启动浏览器时出现问题',
        }
      }
    },
  )

  typedIpcMainHandle(IPC_CHANNELS.tasks.liveControl.disconnect, async (_, accountId) => {
    try {
      accountManager.closeSession(accountId)
      return true
    } catch (error) {
      const logger = createLogger(`@${accountManager.getAccountName(accountId)}`).scope(TASK_NAME)
      logger.error('断开连接失败：', error)
      return false
    }
  })
}

export function setupLiveControlIpcHandlers() {
  setupIpcHandlers()
}
