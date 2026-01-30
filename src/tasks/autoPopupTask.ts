/**
 * 自动弹窗任务实现
 */

import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAutoPopUpStore } from '@/hooks/useAutoPopUp'
import type { StopReason, TaskContext } from './types'
import { BaseTask } from './types'

export class AutoPopupTask extends BaseTask {
  private accountId: string | null = null

  constructor() {
    super('autoPopup')
  }

  async start(ctx: TaskContext): Promise<void> {
    this.accountId = ctx.accountId
    const config = useAutoPopUpStore.getState().contexts[ctx.accountId]?.config

    if (!config) {
      throw new Error('自动弹窗配置不存在')
    }

    try {
      // 启动任务
      const result = await ctx.ipcInvoke<boolean>(
        IPC_CHANNELS.tasks.autoPopUp.start,
        ctx.accountId,
        config,
      )

      if (!result) {
        throw new Error('启动自动弹窗任务失败')
      }

      // 注册 IPC 事件监听器（用于后端主动停止时同步状态）
      const handleStopped = (accountId: string) => {
        if (accountId === ctx.accountId && this.status === 'running') {
          console.log(`[AutoPopupTask] Task stopped by backend for account ${accountId}`)
          this.stop('error')
        }
      }

      if (window.ipcRenderer) {
        const unsubscribe = window.ipcRenderer.on(
          IPC_CHANNELS.tasks.autoPopUp.stoppedEvent,
          handleStopped,
        )
        this.registerDisposable(() => unsubscribe())
      }

      // 更新状态
      useAutoPopUpStore.getState().setIsRunning(ctx.accountId, true)
      this.status = 'running'

      ctx.toast.success('自动弹窗任务已启动')
      console.log(`[AutoPopupTask] Started successfully for account ${ctx.accountId}`)
    } catch (error) {
      console.error('[AutoPopupTask] Failed to start:', error)
      useAutoPopUpStore.getState().setIsRunning(ctx.accountId, false)
      this.status = 'error'
      ctx.toast.error('启动自动弹窗任务失败')
      throw error
    }
  }

  async stop(reason: StopReason): Promise<void> {
    if (this.status === 'stopped' || this.status === 'idle') {
      return
    }

    console.log(`[AutoPopupTask] Stopping, reason: ${reason}`)
    this.status = 'stopping'

    // 执行清理器（移除 IPC 监听器等）
    // 这会清理所有注册的清理函数，包括：
    // - IPC 事件监听器（stoppedEvent）
    // - 任何其他定时器、websocket 等资源
    this.executeDisposers()

    // 调用 IPC 停止任务（后端会清理 interval/timer）
    if (this.accountId) {
      try {
        if (window.ipcRenderer) {
          await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.autoPopUp.stop, this.accountId)
          console.log('[AutoPopupTask] IPC stop invoked successfully')
        }
      } catch (error) {
        console.error('[AutoPopupTask] Error stopping IPC task:', error)
      }

      // 更新状态
      useAutoPopUpStore.getState().setIsRunning(this.accountId, false)
      console.log('[AutoPopupTask] Store state updated: isRunning=false')
    }

    this.status = 'stopped'
    this.isStopped = true
    console.log(`[AutoPopupTask] Stopped successfully, reason: ${reason}`)
  }

  protected reset(): void {
    super.reset()
    this.accountId = null
  }
}
