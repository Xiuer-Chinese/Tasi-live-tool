/**
 * TaskManager Hook
 * 提供便捷的任务管理接口
 */

import { useMemoizedFn } from 'ahooks'
import { taskManager } from '@/tasks'
import type { StopReason, TaskContext, TaskId } from '@/tasks/types'
import { getStopReasonText } from '@/utils/taskGate'
import { useAccounts } from './useAccounts'
import { useToast } from './useToast'

// 任务名称映射
const TASK_NAME_MAP: Record<TaskId, string> = {
  autoReply: 'auto-reply',
  autoPopup: 'auto-popup',
  autoSpeak: 'auto-comment',
}

/**
 * 使用 TaskManager 的 Hook
 */
export function useTaskManager() {
  const { currentAccountId } = useAccounts()
  const { toast } = useToast()

  /**
   * 创建任务上下文
   */
  const createContext = useMemoizedFn((): TaskContext => {
    return {
      accountId: currentAccountId,
      toast: {
        success: (message: string) => toast.success(message),
        error: (message: string) => toast.error(message),
      },
      ipcInvoke: async <T = unknown>(channel: string, ...args: unknown[]): Promise<T> => {
        if (!window.ipcRenderer) {
          throw new Error('IPC renderer not available')
        }
        return window.ipcRenderer.invoke(channel, ...args)
      },
    }
  })

  /**
   * 启动任务
   */
  const startTask = useMemoizedFn(async (taskId: TaskId): Promise<boolean> => {
    const ctx = createContext()
    const result = await taskManager.start(taskId, ctx)

    if (!result.success) {
      if (result.reason === 'NOT_CONNECTED' || result.reason === 'NOT_LIVE') {
        // Gate 检查失败，不显示 toast（由 GateButton 处理）
        console.log(`[useTaskManager] Gate check failed: ${result.message}`)
      } else {
        toast.error(result.message || '启动任务失败')
      }
      return false
    }

    return true
  })

  /**
   * 停止任务
   */
  const stopTask = useMemoizedFn(
    async (taskId: TaskId, reason: StopReason = 'manual'): Promise<void> => {
      await taskManager.stop(taskId, reason)

      // 显示停止提示（仅非手动停止时显示）
      if (reason !== 'manual') {
        const taskName = TASK_NAME_MAP[taskId]
        const reasonText = getStopReasonText(reason, taskName)
        toast.error(reasonText)
      }
    },
  )

  /**
   * 获取任务状态
   */
  const getTaskStatus = useMemoizedFn((taskId: TaskId) => {
    return taskManager.getStatus(taskId)
  })

  return {
    startTask,
    stopTask,
    getTaskStatus,
    taskManager,
  }
}
