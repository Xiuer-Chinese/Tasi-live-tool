/**
 * 一键启动任务 Hook
 * 同时启动自动回复、自动发言、自动弹窗三个任务
 *
 * 注意：自动回复会自动触发数据监控的启动，这是通过 useAutoReply 内部的逻辑实现的
 * 参见 AutoReply/index.tsx 中的 startListening 函数
 */

import { useMemoizedFn } from 'ahooks'
import { useMemo, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { useAccounts } from './useAccounts'
import { useAutoMessageActions, useCurrentAutoMessage } from './useAutoMessage'
import { useAutoPopUpActions, useCurrentAutoPopUp } from './useAutoPopUp'
import { useAutoReply, useAutoReplyStore } from './useAutoReply'
import { useAutoReplyConfig } from './useAutoReplyConfig'
import { useLiveFeatureGate } from './useLiveFeatureGate'
import { useLiveStatsStore } from './useLiveStats'
import { useToast } from './useToast'

export interface OneClickStartState {
  isLoading: boolean
  canStart: boolean
  gateMessage: string
  isAnyTaskRunning: boolean
}

export function useOneClickStart(): {
  state: OneClickStartState
  startAllTasks: () => Promise<void>
  stopAllTasks: () => void
  checkCanStart: () => boolean
  isAnyTaskRunning: boolean
} {
  const { toast } = useToast()
  const gate = useLiveFeatureGate()
  const { currentAccountId } = useAccounts()

  // 自动回复
  const {
    setIsRunning: setAutoReplyRunning,
    isRunning: isAutoReplyRunning,
    setIsListening: setAutoReplyListening,
    isListening: autoReplyListening,
  } = useAutoReply()
  const { config: autoReplyConfig } = useAutoReplyConfig()

  // 自动发言
  const { setIsRunning: setAutoMessageRunning } = useAutoMessageActions()
  const isAutoMessageRunning = useCurrentAutoMessage(ctx => ctx.isRunning)

  // 自动弹窗
  const { setIsRunning: setAutoPopUpRunning } = useAutoPopUpActions()
  const isAutoPopUpRunning = useCurrentAutoPopUp(ctx => ctx.isRunning)

  const [isLoading, setIsLoading] = useState(false)

  const canStart = gate.canUse
  const gateMessage = gate.message

  const checkCanStart = useMemoizedFn(() => {
    if (!canStart) {
      toast.error(gateMessage)
      return false
    }
    return true
  })

  // 启动自动回复（包含数据监控）
  const startAutoReply = useMemoizedFn(async () => {
    if (
      isAutoReplyRunning &&
      (autoReplyListening === 'listening' || autoReplyListening === 'waiting')
    ) {
      return true // 已经在运行中
    }

    try {
      setAutoReplyListening('waiting')
      console.log(`[OneClickStart] Starting comment listener for account ${currentAccountId}`)

      const result = await window.ipcRenderer.invoke(
        IPC_CHANNELS.tasks.autoReply.startCommentListener,
        currentAccountId,
        {
          source: autoReplyConfig.entry,
          ws: autoReplyConfig.ws?.enable ? { port: autoReplyConfig.ws.port } : undefined,
        },
      )

      if (!result) throw new Error('监听评论失败')

      setAutoReplyListening('listening')
      setAutoReplyRunning(true)

      // 同步 LiveStats 的监听状态（与 AutoReply/index.tsx 保持一致）
      useLiveStatsStore.getState().setListening(currentAccountId, true)
      console.log('[OneClickStart] Comment listener started successfully')

      return true
    } catch (error) {
      setAutoReplyListening('error')
      console.error('[OneClickStart] Failed to start comment listener:', error)
      return false
    }
  })

  const startAllTasks = useMemoizedFn(async () => {
    if (!checkCanStart()) return

    setIsLoading(true)
    const results: { task: string; success: boolean }[] = []

    try {
      // 1. 启动自动回复（会自动启动数据监控）
      const autoReplySuccess = await startAutoReply()
      results.push({ task: '自动回复', success: autoReplySuccess })

      // 2. 启动自动发言
      if (!isAutoMessageRunning) {
        setAutoMessageRunning(true)
        results.push({ task: '自动发言', success: true })
      }

      // 3. 启动自动弹窗
      if (!isAutoPopUpRunning) {
        setAutoPopUpRunning(true)
        results.push({ task: '自动弹窗', success: true })
      }

      // 显示结果
      const successCount = results.filter(r => r.success).length
      const totalCount = results.length

      if (successCount === totalCount) {
        toast.success('已同时启动自动回复、自动发言和自动弹窗')
      } else {
        const failedTasks = results
          .filter(r => !r.success)
          .map(r => r.task)
          .join('、')
        toast.error(`${failedTasks} 启动失败`)
      }
    } catch (error) {
      toast.error('启动任务失败，请重试')
      console.error('[OneClickStart] Failed to start tasks:', error)
    } finally {
      setIsLoading(false)
    }
  })

  const stopAllTasks = useMemoizedFn(() => {
    // 停止自动回复
    if (isAutoReplyRunning) {
      setAutoReplyRunning(false)
    }

    // 停止自动发言
    if (isAutoMessageRunning) {
      setAutoMessageRunning(false)
    }

    // 停止自动弹窗
    if (isAutoPopUpRunning) {
      setAutoPopUpRunning(false)
    }

    // 停止数据监控（与自动回复启动时对应）
    const liveStatsStore = useLiveStatsStore.getState()
    const liveStatsContext = liveStatsStore.contexts[currentAccountId]
    if (liveStatsContext?.isListening) {
      liveStatsStore.setListening(currentAccountId, false)
      console.log('[OneClickStart] LiveStats monitoring stopped')
    }

    toast.success('已停止所有任务')
  })

  const isAnyTaskRunning = isAutoReplyRunning || isAutoMessageRunning || isAutoPopUpRunning

  const state = useMemo(
    () => ({
      isLoading,
      canStart,
      gateMessage,
      isAnyTaskRunning,
    }),
    [isLoading, canStart, gateMessage, isAnyTaskRunning],
  )

  return {
    state,
    startAllTasks,
    stopAllTasks,
    checkCanStart,
    isAnyTaskRunning,
  }
}
