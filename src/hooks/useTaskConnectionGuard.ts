/**
 * 任务连接守卫 Hook
 * 监听连接状态变化，自动停止任务
 * 注意：实际的停止逻辑和 toast 提示在 App.tsx 的 disconnectedEvent 监听中处理
 * 这里只负责同步前端状态
 */

import { useEffect } from 'react'
import { useAccounts } from './useAccounts'
import { useAutoMessageStore } from './useAutoMessage'
import { useAutoPopUpStore } from './useAutoPopUp'
import { useAutoReplyStore } from './useAutoReply'
import { useCurrentLiveControl } from './useLiveControl'

/**
 * 监听连接状态，自动停止任务（仅同步状态，不显示 toast）
 */
export function useTaskConnectionGuard() {
  const connectState = useCurrentLiveControl(context => context.connectState)
  const { currentAccountId } = useAccounts()

  useEffect(() => {
    // 如果连接断开，停止所有任务（状态同步）
    // toast 提示在 App.tsx 的 disconnectedEvent 监听中统一处理
    if (connectState.status !== 'connected') {
      const autoReplyStore = useAutoReplyStore.getState()
      const autoMessageStore = useAutoMessageStore.getState()
      const autoPopUpStore = useAutoPopUpStore.getState()

      const autoReplyContext = autoReplyStore.contexts[currentAccountId]
      const autoMessageContext = autoMessageStore.contexts[currentAccountId]
      const autoPopUpContext = autoPopUpStore.contexts[currentAccountId]

      // 停止自动回复（仅同步状态，不显示 toast）
      if (
        autoReplyContext?.isListening === 'listening' ||
        autoReplyContext?.isListening === 'waiting'
      ) {
        console.log(
          `[TaskGate] Connection lost, syncing auto reply state for account ${currentAccountId}`,
        )
        autoReplyStore.setIsListening(currentAccountId, 'stopped')
        autoReplyStore.setIsRunning(currentAccountId, false)
      }

      // 停止自动发言（仅同步状态，不显示 toast）
      if (autoMessageContext?.isRunning) {
        console.log(
          `[TaskGate] Connection lost, syncing auto message state for account ${currentAccountId}`,
        )
        autoMessageStore.setIsRunning(currentAccountId, false)
      }

      // 停止自动弹窗（仅同步状态，不显示 toast）
      if (autoPopUpContext?.isRunning) {
        console.log(
          `[TaskGate] Connection lost, syncing auto popup state for account ${currentAccountId}`,
        )
        autoPopUpStore.setIsRunning(currentAccountId, false)
      }
    }
  }, [connectState.status, currentAccountId])
}
