import { useMemo } from 'react'
import type { StreamStatus } from 'shared/streamStatus'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { type ConnectState, DEFAULT_CONNECT_STATE } from '@/config/platformConfig'
import { EVENTS, eventEmitter } from '@/utils/events'
import { useAccounts } from './useAccounts'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

interface LiveControlContext {
  connectState: ConnectState
  accountName: string | null
  streamState: StreamStatus
}

interface LiveControlActions {
  setConnectState: (accountId: string, connectState: Partial<ConnectState>) => void
  setAccountName: (accountId: string, name: string | null) => void
  setStreamState: (accountId: string, streamState: StreamStatus) => void
  resetConnection: (accountId: string) => void
}

type LiveControlStore = LiveControlActions & {
  contexts: Record<string, LiveControlContext>
}

// 【修复】使用稳定的默认 context 引用，避免每次调用都创建新对象
const DEFAULT_CONTEXT: LiveControlContext = {
  connectState: { ...DEFAULT_CONNECT_STATE },
  accountName: null,
  streamState: 'unknown',
}

function defaultContext(): LiveControlContext {
  return DEFAULT_CONTEXT
}

export const useLiveControlStore = create<LiveControlStore>()(
  persist(
    immer(set => {
      eventEmitter.on(EVENTS.ACCOUNT_REMOVED, (accountId: string) => {
        set(state => {
          delete state.contexts[accountId]
        })
      })

      const ensureContext = (state: LiveControlStore, accountId: string) => {
        if (!state.contexts[accountId]) {
          state.contexts[accountId] = defaultContext()
        }
        return state.contexts[accountId]
      }

      return {
        contexts: {
          default: defaultContext(),
        },
        setConnectState: (accountId, connectStateUpdate) =>
          set(state => {
            const context = ensureContext(state, accountId)
            context.connectState = { ...context.connectState, ...connectStateUpdate }
          }),
        setAccountName: (accountId, name) =>
          set(state => {
            const context = ensureContext(state, accountId)
            context.accountName = name
          }),
        setStreamState: (accountId, streamState) =>
          set(state => {
            const context = ensureContext(state, accountId)
            context.streamState = streamState
          }),
        resetConnection: accountId =>
          set(state => {
            const context = ensureContext(state, accountId)
            context.connectState = {
              ...DEFAULT_CONNECT_STATE,
              platform: context.connectState.platform,
            }
            context.streamState = 'unknown'
          }),
      }
    }),
    {
      name: 'live-control-storage',
      partialize: state => {
        const contexts: Record<string, Pick<LiveControlContext, 'connectState'>> = {}
        for (const key in state.contexts) {
          const connectState = state.contexts[key].connectState
          // 【修复】connecting 状态不能被持久化（临时状态）
          // 如果状态是 connecting，保存时重置为 disconnected
          if (connectState.status === 'connecting') {
            contexts[key] = {
              connectState: {
                ...connectState,
                status: 'disconnected',
                error: null,
                session: null,
                lastVerifiedAt: null,
              },
            }
          } else {
            contexts[key] = { connectState }
          }
        }
        return { contexts }
      },
      merge: (_persistedState, currentState) => {
        const persistedState = _persistedState as {
          contexts: Record<string, Pick<LiveControlContext, 'connectState'>>
        }
        const mergedContexts: Record<string, LiveControlContext> = {}
        for (const key in persistedState.contexts ?? {}) {
          const persistedConnectState = persistedState.contexts[key].connectState
          // 【修复】恢复时若为 connecting，一律归零到 disconnected（防止无效状态残留）
          const safeConnectState =
            persistedConnectState.status === 'connecting'
              ? {
                  ...DEFAULT_CONNECT_STATE,
                  platform: persistedConnectState.platform || DEFAULT_CONNECT_STATE.platform,
                }
              : persistedConnectState

          mergedContexts[key] = {
            ...defaultContext(),
            connectState: safeConnectState,
          }
        }
        return {
          ...currentState,
          contexts: mergedContexts,
        }
      },
    },
  ),
)

export const useCurrentLiveControlActions = () => {
  const setConnectState = useLiveControlStore(state => state.setConnectState)
  const setAccountName = useLiveControlStore(state => state.setAccountName)
  const setStreamState = useLiveControlStore(state => state.setStreamState)
  const resetConnection = useLiveControlStore(state => state.resetConnection)
  const currentAccountId = useAccounts(state => state.currentAccountId)
  return useMemo(
    () => ({
      setConnectState: (connectStateUpdate: Partial<ConnectState>) => {
        setConnectState(currentAccountId, connectStateUpdate)
      },
      setAccountName: (name: string | null) => {
        setAccountName(currentAccountId, name)
      },
      setStreamState: (streamState: StreamStatus) => {
        setStreamState(currentAccountId, streamState)
      },
      resetConnection: () => {
        resetConnection(currentAccountId)
      },
      setPlatform: (platform: string) => {
        setConnectState(currentAccountId, { platform })
      },
      setIsConnected: (status: ConnectionStatus) => {
        setConnectState(currentAccountId, { status })
      },
    }),
    [currentAccountId, setConnectState, setAccountName, setStreamState, resetConnection],
  )
}

// 【修复】确保 getSnapshot 返回值稳定
// 问题：defaultContext() 每次调用都返回新对象，导致 selector 返回值不稳定
// 解决：使用稳定的默认 context 引用（DEFAULT_CONTEXT），确保 selector 返回值稳定
export const useCurrentLiveControl = <T>(getter: (context: LiveControlContext) => T): T => {
  const currentAccountId = useAccounts(state => state.currentAccountId)

  // 使用 useMemo 稳定 selector 函数，避免每次 render 都创建新函数
  // 注意：getter 函数本身不需要在依赖数组中，因为它不影响 selector 的返回值稳定性
  const selector = useMemo(
    () => (state: LiveControlStore) => {
      // 使用稳定的 DEFAULT_CONTEXT 引用，而不是每次调用 defaultContext()
      // 这确保了当 context 不存在时，返回的默认值引用是稳定的
      const context = state.contexts[currentAccountId] ?? DEFAULT_CONTEXT
      return getter(context)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentAccountId, getter], // 只依赖 currentAccountId，getter 函数不需要在依赖数组中
  )

  // 【3】加断言验证：临时日志，确认在不操作时 snapshot 引用不再变化
  const result = useLiveControlStore(selector)

  // 临时调试日志（用于验证修复）
  // 如果看到这个日志频繁打印，说明 selector 返回值仍然不稳定
  // console.count('[useCurrentLiveControl] render')
  // console.log('[useCurrentLiveControl] snapshot result:', result, 'accountId:', currentAccountId)

  return result
}

// Helper getters for backward compatibility
export const useIsConnected = () =>
  useCurrentLiveControl(context => context.connectState.status === 'connected')
export const useConnectionStatus = () =>
  useCurrentLiveControl(context => context.connectState.status)
export const useCurrentPlatform = () =>
  useCurrentLiveControl(context => context.connectState.platform)
export const useStreamStatus = () => useCurrentLiveControl(context => context.streamState)

// Backward compatibility getters
export const useIsConnectedLegacy = () =>
  useCurrentLiveControl(context => context.connectState.status === 'connected')
export const usePlatformLegacy = () =>
  useCurrentLiveControl(context => context.connectState.platform)
