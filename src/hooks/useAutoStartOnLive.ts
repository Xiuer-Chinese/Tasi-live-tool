/**
 * 开播自动启动 Hook
 * 当检测到直播状态变为 'live' 时，自动启动所有任务
 */

import { useEffect, useRef } from 'react'
import { useAccounts } from './useAccounts'
import { useCurrentLiveControl } from './useLiveControl'
import { useOneClickStart } from './useOneClickStart'

const AUTO_START_ON_LIVE_KEY = 'auto-start-on-live-enabled'

export function getAutoStartOnLive(): boolean {
  try {
    return localStorage.getItem(AUTO_START_ON_LIVE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setAutoStartOnLive(value: boolean): void {
  try {
    localStorage.setItem(AUTO_START_ON_LIVE_KEY, value ? 'true' : 'false')
  } catch {
    // ignore
  }
}

/**
 * 监听直播状态，当变为 'live' 时自动启动任务
 */
export function useAutoStartOnLive() {
  const { currentAccountId } = useAccounts()
  const streamState = useCurrentLiveControl(context => context.streamState)
  const { startAllTasks, state } = useOneClickStart()

  // 使用 ref 记录上一次的直播状态，避免重复触发
  const prevStreamStateRef = useRef(streamState)
  // 使用 ref 记录当前账号是否已经自动启动过，避免重复启动
  const hasAutoStartedRef = useRef(false)

  useEffect(() => {
    const isEnabled = getAutoStartOnLive()
    if (!isEnabled) return

    // 直播状态从非 'live' 变为 'live'
    const wasNotLive = prevStreamStateRef.current !== 'live'
    const isNowLive = streamState === 'live'

    if (wasNotLive && isNowLive && !hasAutoStartedRef.current) {
      // 检查是否可以启动任务
      if (state.canStart) {
        console.log('[AutoStartOnLive] 检测到开播，自动启动任务')
        hasAutoStartedRef.current = true
        startAllTasks()
      }
    }

    // 如果直播结束，重置自动启动标记
    if (streamState === 'ended' || streamState === 'offline') {
      hasAutoStartedRef.current = false
    }

    prevStreamStateRef.current = streamState
  }, [streamState, state.canStart, startAllTasks])

  // 当切换账号时，重置自动启动标记
  useEffect(() => {
    hasAutoStartedRef.current = false
    prevStreamStateRef.current = streamState
  }, [currentAccountId, streamState])
}
