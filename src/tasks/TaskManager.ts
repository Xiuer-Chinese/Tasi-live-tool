/**
 * TaskManager - 统一任务调度器
 * 管理所有任务的启动、停止和状态
 */

import { useLiveControlStore } from '@/hooks/useLiveControl'
import { gateCanRun } from './gateCheck'
import type { StopReason, Task, TaskContext, TaskId, TaskStatus } from './types'
import { BaseTask } from './types'

/**
 * TaskManager 单例
 */
class TaskManagerImpl {
  private tasks: Map<TaskId, Task> = new Map()
  private statusStore: Map<TaskId, TaskStatus> = new Map()

  /**
   * 注册任务
   */
  register(task: Task): void {
    this.tasks.set(task.id, task)
    this.statusStore.set(task.id, 'idle')
    console.log(`[TaskManager] Registered task: ${task.id}`)
  }

  /**
   * 获取任务状态
   */
  getStatus(taskId: TaskId): TaskStatus {
    const task = this.tasks.get(taskId)
    if (!task) {
      return 'idle'
    }
    return task.status
  }

  /**
   * 启动任务
   * @param taskId - 任务 ID
   * @param ctx - 任务上下文
   * @returns 启动结果
   */
  async start(
    taskId: TaskId,
    ctx: TaskContext,
  ): Promise<{ success: boolean; reason?: string; message?: string }> {
    const task = this.tasks.get(taskId)
    if (!task) {
      console.error(`[TaskManager] Task ${taskId} not found`)
      return { success: false, reason: 'TASK_NOT_FOUND', message: '任务未找到' }
    }

    // Gate 检查
    const accountId = ctx.accountId
    const liveControlStore = useLiveControlStore.getState()
    const context = liveControlStore.contexts[accountId]
    if (!context) {
      return { success: false, reason: 'NOT_CONNECTED', message: '账号上下文不存在' }
    }

    const gateResult = gateCanRun(context.connectState.status, context.streamState)
    if (!gateResult.ok) {
      console.log(`[TaskManager] Gate check failed for task ${taskId}: ${gateResult.reason}`)
      return {
        success: false,
        reason: gateResult.reason,
        message: gateResult.message,
      }
    }

    // 检查任务是否已在运行
    if (task.status === 'running' || task.status === 'stopping') {
      console.log(`[TaskManager] Task ${taskId} is already ${task.status}`)
      return { success: false, reason: 'ALREADY_RUNNING', message: '任务已在运行中' }
    }

    try {
      // 重置任务状态（如果之前停止过）
      if (task.status === 'stopped' && task instanceof BaseTask) {
        // BaseTask 有 protected reset 方法，通过类型守卫安全调用
        ;(task as BaseTask & { reset: () => void }).reset()
      }

      // 更新状态
      task.status = 'running'
      this.statusStore.set(taskId, 'running')

      // 启动任务
      console.log(`[TaskManager] Starting task ${taskId}`)
      await task.start(ctx)
      console.log(`[TaskManager] Task ${taskId} started successfully`)

      return { success: true }
    } catch (error) {
      console.error(`[TaskManager] Failed to start task ${taskId}:`, error)
      task.status = 'error'
      this.statusStore.set(taskId, 'error')
      return {
        success: false,
        reason: 'ERROR',
        message: error instanceof Error ? error.message : '启动任务失败',
      }
    }
  }

  /**
   * 停止任务
   * @param taskId - 任务 ID
   * @param reason - 停止原因
   * @param showToast - 是否显示 toast（默认 false，由调用方决定）
   */
  async stop(taskId: TaskId, reason: StopReason, _showToast = false): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      console.warn(`[TaskManager] Task ${taskId} not found, cannot stop`)
      return
    }

    if (task.status === 'idle' || task.status === 'stopped') {
      console.log(`[TaskManager] Task ${taskId} is already ${task.status}, skipping stop`)
      return
    }

    try {
      console.log(`[TaskManager] Stopping task ${taskId}, reason: ${reason}`)
      await task.stop(reason)
      this.statusStore.set(taskId, task.status)
      console.log(`[TaskManager] Task ${taskId} stopped, final status: ${task.status}`)
    } catch (error) {
      console.error(`[TaskManager] Error stopping task ${taskId}:`, error)
      task.status = 'error'
      this.statusStore.set(taskId, 'error')
    }
  }

  /**
   * 停止所有运行中的任务
   * @param reason - 停止原因
   * @param toastCallback - 可选的 toast 回调（用于显示停止提示）
   */
  async stopAll(reason: StopReason, toastCallback?: (message: string) => void): Promise<void> {
    console.log(`[TaskManager] stopAll called with reason: ${reason}`)
    const runningTasks: TaskId[] = []

    // 收集所有运行中的任务
    for (const [taskId, task] of this.tasks.entries()) {
      if (task.status === 'running' || task.status === 'stopping') {
        runningTasks.push(taskId)
      }
    }

    if (runningTasks.length === 0) {
      console.log('[TaskManager] No running tasks to stop')
      return
    }

    console.log(`[TaskManager] Stopping ${runningTasks.length} tasks: ${runningTasks.join(', ')}`)

    // 并行停止所有任务
    await Promise.all(runningTasks.map(taskId => this.stop(taskId, reason)))

    console.log(
      `[TaskManager] All tasks stopped, reason: ${reason}, stopped tasks: ${runningTasks.join(', ')}`,
    )

    // 显示 toast（如果有回调且不是手动停止）
    if (toastCallback && reason !== 'manual') {
      const { getStopReasonText } = await import('@/utils/taskGate')
      const reasonText = getStopReasonText(reason)
      toastCallback(reasonText)
    }
  }

  /**
   * 获取所有任务状态
   */
  getAllStatus(): Record<TaskId, TaskStatus> {
    const result: Record<string, TaskStatus> = {}
    for (const taskId of this.tasks.keys()) {
      result[taskId] = this.getStatus(taskId)
    }
    return result as Record<TaskId, TaskStatus>
  }
}

// 导出单例
export const taskManager = new TaskManagerImpl()
