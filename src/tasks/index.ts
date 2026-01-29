/**
 * Task 模块统一导出
 *
 * 【止血策略】：目前只保留 autoSpeak 使用 TaskManager
 * - autoReply: 回退到旧逻辑（useTaskControl/CommentList.startListening）
 * - autoPopup: 回退到旧逻辑（useTaskControl）
 * - autoSpeak: 使用 TaskManager（统一管理）
 */

import { AutoSpeakTask } from './autoSpeakTask'
import { taskManager } from './TaskManager'

// 只创建并注册 autoSpeak 任务
const autoSpeakTask = new AutoSpeakTask()
taskManager.register(autoSpeakTask)

// 暂时不注册 autoReply 和 autoPopup（回退到旧逻辑）
// const autoReplyTask = new AutoReplyTask()
// const autoPopupTask = new AutoPopupTask()
// taskManager.register(autoReplyTask)
// taskManager.register(autoPopupTask)

export { taskManager }
export { AutoSpeakTask }
export type { StopReason, TaskContext, TaskId, TaskStatus } from './types'
