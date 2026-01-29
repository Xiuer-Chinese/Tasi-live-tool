/**
 * 直播状态检测器
 * 轮询检测直播状态并发送事件通知前端
 */

import { IPC_CHANNELS } from 'shared/ipcChannels'
import type { StreamStatus } from 'shared/types'
import type { ScopedLogger } from '#/logger'
import type { BrowserSession } from '#/managers/BrowserSessionManager'
import type { IPlatform } from '#/platforms/IPlatform'
import windowManager from '#/windowManager'

const POLL_INTERVAL = 2000 // 2秒轮询一次

export class StreamStateDetector {
  private pollTimer: NodeJS.Timeout | null = null
  private lastState: StreamStatus = 'unknown'
  private isPolling = false

  constructor(
    private platform: IPlatform,
    private browserSession: BrowserSession | null,
    private accountId: string,
    private logger: ScopedLogger,
  ) {}

  /**
   * 开始轮询检测直播状态
   */
  start() {
    if (this.isPolling) {
      this.logger.warn('Stream state detector is already polling')
      return
    }

    if (!this.browserSession) {
      this.logger.warn('Cannot start stream state detector: browser session is null')
      return
    }

    this.isPolling = true
    this.logger.info('Starting stream state detector (polling every 2s)')

    // 立即检测一次
    this.checkStreamState()

    // 开始轮询
    this.pollTimer = setInterval(() => {
      this.checkStreamState()
    }, POLL_INTERVAL)
  }

  /**
   * 停止轮询检测
   */
  stop() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
    this.isPolling = false
    this.logger.info('Stream state detector stopped')
  }

  /**
   * 更新浏览器会话（连接/重连时调用）
   */
  updateBrowserSession(session: BrowserSession | null) {
    this.browserSession = session
  }

  /**
   * 检测直播状态
   */
  private async checkStreamState() {
    if (!this.browserSession) {
      this.logger.debug('[stream] Browser session is null, skipping check')
      return
    }

    try {
      const isLive = await this.platform.isLive(this.browserSession)
      const newState: StreamStatus = isLive ? 'live' : 'offline'

      // 记录每次检测结果（用于调试）
      this.logger.debug(
        `[stream] isLive=${isLive}, currentState=${this.lastState}, newState=${newState}`,
      )

      // 状态变化时发送事件
      if (newState !== this.lastState) {
        this.logger.info(
          `[stream] Stream state changed: ${this.lastState} -> ${newState} (isLive=${isLive})`,
        )
        this.lastState = newState
        windowManager.send(
          IPC_CHANNELS.tasks.liveControl.streamStateChanged,
          this.accountId,
          newState,
        )
      } else {
        this.logger.debug(`[stream] Stream state unchanged: ${newState} (isLive=${isLive})`)
      }
    } catch (error) {
      this.logger.error('[stream] Failed to check stream state:', error)
      // 检测失败时，如果之前是 live，则设为 offline（保守策略）
      if (this.lastState === 'live') {
        const newState: StreamStatus = 'offline'
        this.logger.warn('[stream] Stream state set to offline due to detection error')
        this.lastState = newState
        windowManager.send(
          IPC_CHANNELS.tasks.liveControl.streamStateChanged,
          this.accountId,
          newState,
        )
      }
    }
  }

  /**
   * 手动设置状态（用于断开连接时）
   */
  setState(state: StreamStatus) {
    if (state !== this.lastState) {
      this.logger.info(`[stream] Stream state manually set: ${this.lastState} -> ${state}`)
      this.lastState = state
      windowManager.send(IPC_CHANNELS.tasks.liveControl.streamStateChanged, this.accountId, state)
    }
  }
}
