import { RefreshCwIcon, TerminalIcon } from 'lucide-react'
import { Outlet } from 'react-router'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import LogDisplayer from '@/components/common/LogDisplayer'
import Sidebar from '@/components/common/Sidebar'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Toaster } from '@/components/ui/toaster'
import { useDevMode } from '@/hooks/useDevMode'
import { Header } from './components/common/Header'
import { useIpcListener } from './hooks/useIpc'
import './App.css'
import React, { Suspense, useEffect, useState } from 'react'
import type { StreamStatus } from 'shared/streamStatus'
import { AuthProvider } from '@/components/auth/AuthProvider'
import { UpdateDialog } from './components/update/UpdateDialog'
import { useAccounts } from './hooks/useAccounts'
import { useAutoMessageStore } from './hooks/useAutoMessage'
import { useAutoPopUpStore } from './hooks/useAutoPopUp'
import { useAutoReply, useAutoReplyStore } from './hooks/useAutoReply'
import { useChromeConfigStore } from './hooks/useChromeConfig'
import { useLiveControlStore } from './hooks/useLiveControl'
import { useToast } from './hooks/useToast'
import { useUpdateConfigStore, useUpdateStore } from './hooks/useUpdate'
import { cn } from './lib/utils'
// 初始化 TaskManager（注册所有任务）
import '@/tasks'

function _useGlobalIpcListener() {
  const { handleComment } = useAutoReply()
  const { setIsListening } = useAutoReplyStore()
  const { setConnectState, setAccountName, setStreamState } = useLiveControlStore()
  const setIsRunningAutoMessage = useAutoMessageStore(s => s.setIsRunning)
  const setIsRunningAutoPopUp = useAutoPopUpStore(s => s.setIsRunning)
  const setStorageState = useChromeConfigStore(s => s.setStorageState)
  const enableAutoCheckUpdate = useUpdateConfigStore(s => s.enableAutoCheckUpdate)
  const handleUpdate = useUpdateStore.use.handleUpdate()
  const _currentAccountId = useAccounts(s => s.currentAccountId)
  const { toast } = useToast()

  useIpcListener(IPC_CHANNELS.tasks.autoReply.showComment, ({ comment, accountId }) => {
    handleComment(comment, accountId)
  })

  useIpcListener(IPC_CHANNELS.tasks.liveControl.disconnectedEvent, async (id, reason) => {
    console.log(`[Connection] Disconnected event received for account ${id}`, reason ?? '')
    setConnectState(id, {
      status: 'disconnected',
      error: reason || '直播控制台已断开连接',
    })
    if (reason) {
      toast.error(reason)
    }

    // 只停止该账号的任务，避免误停其他账号的 autoSpeak（TaskManager 为全局单任务）
    console.log(`[TaskGate] Connection disconnected, stopping all tasks for account ${id}`)
    const { stopAllLiveTasks } = await import('@/utils/stopAllLiveTasks')
    await stopAllLiveTasks(id, 'disconnected', false) // 不显示 toast，避免重复
  })

  useIpcListener(IPC_CHANNELS.tasks.autoMessage.stoppedEvent, async id => {
    // 同步状态：后端停止事件（可能是手动停止或系统停止）
    setIsRunningAutoMessage(id, false)

    // 同步 TaskManager 状态（如果使用 TaskManager）
    try {
      const { taskManager } = await import('@/tasks')
      const taskStatus = taskManager.getStatus('autoSpeak')
      if (taskStatus === 'running') {
        // 后端已停止，同步 TaskManager 状态
        // 使用类型断言访问内部属性（用于状态同步，不改变业务逻辑）
        interface TaskManagerInternal {
          statusStore: Map<string, string>
          tasks: Map<string, { status: string; isStopped?: boolean }>
        }
        const internal = taskManager as unknown as TaskManagerInternal
        internal.statusStore.set('autoSpeak', 'stopped')
        const task = internal.tasks.get('autoSpeak')
        if (task) {
          task.status = 'stopped'
          task.isStopped = true
          console.log('[TaskManager] Synced autoSpeak status to stopped from backend event')
        }
      }
    } catch (error) {
      // TaskManager 可能未初始化，忽略
      console.log('[TaskManager] Failed to sync status (may not be initialized):', error)
    }

    console.log(`[TaskGate] Auto message stopped event for account ${id}`)
  })

  useIpcListener(IPC_CHANNELS.tasks.autoPopUp.stoppedEvent, id => {
    setIsRunningAutoPopUp(id, false)
    // 注意：如果是系统强制停止，toast 已在 stopAllLiveTasks 中显示
    // 这里只处理手动停止的情况
    console.log(`[TaskGate] Auto popup stopped event for account ${id}`)
  })

  useIpcListener(IPC_CHANNELS.tasks.autoReply.listenerStopped, id => {
    setIsListening(id, 'stopped')
    // 注意：如果是系统强制停止，toast 已在 stopAllLiveTasks 中显示
    // 这里只处理手动停止的情况
    console.log(`[TaskGate] Auto reply listener stopped event for account ${id}`)
  })

  useIpcListener(IPC_CHANNELS.chrome.saveState, (id, state) => {
    setStorageState(id, state)
  })

  useIpcListener(IPC_CHANNELS.tasks.liveControl.notifyAccountName, params => {
    if (params.ok) {
      setAccountName(params.accountId, params.accountName)
      // 登录成功！更新连接状态为 connected
      setConnectState(params.accountId, {
        status: 'connected',
        error: null,
        lastVerifiedAt: Date.now(),
      })
      toast.success('已成功连接到直播控制台')
    }
  })

  // 监听直播状态变化事件
  useIpcListener(
    IPC_CHANNELS.tasks.liveControl.streamStateChanged,
    async (accountId: string, streamState: StreamStatus) => {
      console.log(
        `[Gate] Stream state changed event received for account ${accountId}: ${streamState}`,
      )

      // 获取之前的状态
      const prevState = useLiveControlStore.getState().contexts[accountId]?.streamState

      // 更新状态
      setStreamState(accountId, streamState)
      console.log(`[Gate] Stream state updated in store for account ${accountId}: ${streamState}`)

      // 如果从 live 变为非 live，只停止该账号的任务，避免误停其他账号的 autoSpeak
      if (prevState === 'live' && streamState !== 'live') {
        console.log(
          `[TaskGate] Stream ended (${prevState} -> ${streamState}), stopping all tasks for account ${accountId}`,
        )
        const { stopAllLiveTasks } = await import('@/utils/stopAllLiveTasks')
        await stopAllLiveTasks(accountId, 'stream_ended', false) // 不显示 toast，避免重复
      }
    },
  )

  useIpcListener(IPC_CHANNELS.app.notifyUpdate, info => {
    if (enableAutoCheckUpdate) {
      handleUpdate(info)
    }
  })
}

function AppContent() {
  const { enabled: devMode } = useDevMode()
  const { accounts, currentAccountId } = useAccounts()
  // 【修复】直接解构 setConnectState，避免 selector 返回新对象导致无限循环
  const setConnectState = useLiveControlStore(state => state.setConnectState)
  const [logCollapsed, setLogCollapsed] = useState(() => {
    return localStorage.getItem('logPanelCollapsed') === 'true'
  })

  // 【关键】注册全局 IPC 事件监听（notifyAccountName -> 已连接、disconnectedEvent、streamStateChanged 等），不调用则 UI 收不到主进程事件，界面会空白/异常
  _useGlobalIpcListener()

  // Check if running in Electron environment
  useEffect(() => {
    if (!window.ipcRenderer) {
      console.error('window.ipcRenderer is not available. Please run this app in Electron.')
    }
  }, [])

  // 修复：只在 currentAccountId 变化时执行，避免 accounts 数组引用变化导致的无限循环
  // 使用 useRef 跟踪上一次的 account，只在 account 真正变化时才执行 IPC 调用
  const prevAccountIdRef = React.useRef<string | null>(null)
  const prevAccountRef = React.useRef<{ id: string; name: string } | null>(null)

  useEffect(() => {
    // 如果 currentAccountId 没有变化，不执行
    if (prevAccountIdRef.current === currentAccountId) {
      return
    }

    const account = accounts.find(acc => acc.id === currentAccountId)

    // 如果找到了账号，且账号信息有变化，才执行 IPC 调用
    if (account && window.ipcRenderer) {
      // 检查账号信息是否真的变化了（避免相同账号的重复调用）
      const accountChanged =
        !prevAccountRef.current ||
        prevAccountRef.current.id !== account.id ||
        prevAccountRef.current.name !== account.name

      if (accountChanged) {
        window.ipcRenderer.invoke(IPC_CHANNELS.account.switch, { account })
        // 【修复】切换账号时重置当前账号的 connectState 为 disconnected
        // 避免持久化的旧状态（如 connecting）影响新账号
        // 注意：只重置当前账号的 UI 状态，不影响其他账号的后台连接/任务
        setConnectState(account.id, {
          status: 'disconnected',
          error: null,
          session: null,
          lastVerifiedAt: null,
        })
        prevAccountRef.current = { id: account.id, name: account.name }
      }
    }

    prevAccountIdRef.current = currentAccountId
    // 只依赖 currentAccountId，不依赖 accounts 数组（避免数组引用变化导致的循环）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentAccountId,
    accounts.find, // 【修复】切换账号时重置当前账号的 connectState 为 disconnected
    // 避免持久化的旧状态（如 connecting）影响新账号
    // 注意：只重置当前账号的 UI 状态，不影响其他账号的后台连接/任务
    setConnectState,
  ])

  useEffect(() => {
    localStorage.setItem('logPanelCollapsed', String(logCollapsed))
  }, [logCollapsed])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleToggleDevTools = async () => {
    if (window.ipcRenderer) {
      await window.ipcRenderer.invoke(IPC_CHANNELS.chrome.toggleDevTools)
    }
  }

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger disabled={!devMode} className="min-h-screen">
          <div
            className="flex flex-col h-screen overflow-hidden"
            style={{ backgroundColor: 'var(--app-bg)' }}
          >
            {/* 头部标题：固定高度；主内容区高度 = 100vh - 头部 - 底部日志，无全局滚动 */}
            <Header />

            <div className="flex flex-1 min-h-0 overflow-hidden gap-0">
              {/* 侧边栏 */}
              <Sidebar />

              <main
                className="min-h-0 flex-1 flex flex-col overflow-hidden"
                style={{
                  backgroundColor: 'var(--content-bg)',
                  borderTopLeftRadius: '16px',
                  boxShadow: 'var(--content-edge-shadow)',
                  paddingTop: '24px',
                  paddingBottom: '24px',
                  paddingLeft: '24px',
                  paddingRight: '24px',
                }}
              >
                <div className="mx-auto w-full max-w-5xl flex flex-col flex-1 min-h-0 overflow-hidden">
                  <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                    <Suspense
                      fallback={
                        <div className="flex items-center justify-center flex-1 min-h-0">
                          <div className="flex flex-col items-center gap-3">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                            <span className="text-sm text-muted-foreground">加载中...</span>
                          </div>
                        </div>
                      }
                    >
                      {/* 全屏页(如自动回复)用 h-full 填满后内部滚动；其它页内容过长时此层滚动 */}
                      <div className="h-full min-h-0 overflow-y-auto">
                        <Outlet />
                      </div>
                    </Suspense>
                  </div>
                </div>
              </main>
            </div>

            <div
              className={cn(
                'shrink-0 transition-all duration-200',
                logCollapsed ? 'h-12 shadow-none opacity-50' : 'h-[180px] opacity-100',
              )}
              style={{
                backgroundColor: logCollapsed ? 'var(--surface-muted)' : 'var(--surface)',
                boxShadow: logCollapsed ? 'none' : '0 -1px 0 rgba(0,0,0,0.06)',
              }}
            >
              <LogDisplayer
                collapsed={logCollapsed}
                onToggleCollapsed={() => setLogCollapsed(prev => !prev)}
              />
            </div>
            <UpdateDialog />
          </div>
        </ContextMenuTrigger>
        {devMode && (
          <ContextMenuContent>
            <ContextMenuItem onClick={handleRefresh}>
              <RefreshCwIcon className="mr-2 h-4 w-4" />
              <span>刷新页面</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleToggleDevTools}>
              <TerminalIcon className="mr-2 h-4 w-4" />
              <span>开发者工具</span>
            </ContextMenuItem>
          </ContextMenuContent>
        )}
      </ContextMenu>
      <Toaster />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
