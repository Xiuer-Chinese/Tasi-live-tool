import { useMemoizedFn } from 'ahooks'
import { CheckIcon, CircleAlert, GlobeIcon, Loader2, XIcon } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useAccounts } from '@/hooks/useAccounts'
import { useRequireAuthForAction } from '@/hooks/useAuth'
import { useCurrentChromeConfig, useCurrentChromeConfigActions } from '@/hooks/useChromeConfig'
import {
  useCurrentLiveControl,
  useCurrentLiveControlActions,
  useLiveControlStore,
} from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import PlatformSelect from './PlatformSelect'

const StatusAlert = React.memo(() => {
  const connectState = useCurrentLiveControl(state => state.connectState)
  if (connectState.platform === 'wxchannel') {
    return (
      <Alert>
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>你选择了视频号平台，请注意以下事项：</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside">
            <li>
              请先确认<strong>开播后</strong>再连接中控台
            </li>
            <li>
              视频号助手无法<strong>一号多登</strong>，在别处登录视频号助手会
              <strong>中断连接</strong>!
            </li>
          </ol>
        </AlertDescription>
      </Alert>
    )
  }
  if (connectState.platform === 'taobao') {
    return (
      <Alert>
        <CircleAlert className="h-4 w-4" />
        <AlertTitle>你选择了淘宝平台，请注意以下事项：</AlertTitle>
        <AlertDescription>
          <ol className="list-decimal list-inside">
            <li>
              请先确认<strong>开播后</strong>
              再连接中控台，因为进入淘宝中控台需要获取<strong>直播间ID</strong>
            </li>
            <li>
              目前淘宝会触发人机验证，所以将<strong>强制关闭无头模式</strong>
              ，除了登录和人机验证之外请尽量不要操作浏览器
            </li>
          </ol>
        </AlertDescription>
      </Alert>
    )
  }
  return null
})

const StatusCard = React.memo(() => {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pr-4">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>控制台状态</CardTitle>
          <CardDescription>查看并管理直播控制台的连接状态</CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <PlatformSelect />
          <ConnectToLiveControl />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <ConnectState />
          <StatusAlert />
          <Separator />
          <HeadlessSetting />
        </div>
      </CardContent>
    </Card>
  )
})

const ConnectToLiveControl = React.memo(() => {
  const { setConnectState } = useCurrentLiveControlActions()
  const connectState = useCurrentLiveControl(context => context.connectState)
  const chromePath = useCurrentChromeConfig(context => context.path)
  const storageState = useCurrentChromeConfig(context => context.storageState)
  let headless = useCurrentChromeConfig(context => context.headless)
  const account = useAccounts(store => store.getCurrentAccount())

  if (connectState.platform === 'taobao') {
    headless = false
  }

  const { toast } = useToast()
  const loginTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // 清理超时定时器
  useEffect(() => {
    return () => {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current)
        loginTimeoutRef.current = null
      }
    }
  }, [])

  // 当状态变为 connected 或 disconnected 时，清理超时定时器
  useEffect(() => {
    if (connectState.status === 'connected' || connectState.status === 'disconnected') {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current)
        loginTimeoutRef.current = null
      }
    }
  }, [connectState.status])

  // 【修复】检测到 connecting 状态但没有真实连接流程（无 timeout）时，回滚到 disconnected
  // 这可以处理持久化恢复的无效 connecting 状态
  useEffect(() => {
    if (connectState.status === 'connecting' && !loginTimeoutRef.current) {
      // 延迟检查，避免在 connectLiveControl 刚设置 connecting 时误判
      const checkTimer = setTimeout(() => {
        // 直接从 store 读取最新状态，避免闭包问题
        const currentState = useLiveControlStore.getState()
        const currentAccountId = useAccounts.getState().currentAccountId
        const currentContext = currentState.contexts[currentAccountId]

        // 如果仍然是 connecting 且没有 timeout，说明是无效状态
        if (currentContext?.connectState.status === 'connecting' && !loginTimeoutRef.current) {
          console.warn(
            '[State Machine] Invalid connecting state detected (no timeout), rolling back to disconnected',
          )
          setConnectState({
            status: 'disconnected',
            error: null,
            session: null,
            lastVerifiedAt: null,
          })
          toast.error('连接已失效，请重新连接')
        }
      }, 1000) // 1秒延迟，给 connectLiveControl 创建 timeout 的时间

      return () => {
        clearTimeout(checkTimer)
      }
    }
  }, [connectState.status, setConnectState, toast])

  // 引入登录检查 Hook
  const { requireAuthForAction } = useRequireAuthForAction('connect-live-control')

  const connectLiveControl = useMemoizedFn(async () => {
    // 使用 requireAuthForAction 包装连接操作
    await requireAuthForAction(async () => {
      try {
        if (!account) {
          toast.error('找不到对应账号')
          return
        }

        // 清理之前的超时定时器
        if (loginTimeoutRef.current) {
          clearTimeout(loginTimeoutRef.current)
          loginTimeoutRef.current = null
        }

        // 打印选中的平台ID
        console.log('[State Machine] selectedPlatformId:', connectState.platform)

        // 状态迁移：disconnected → connecting
        console.log('[State Machine] Status transition:', connectState.status, '→ connecting')
        setConnectState({
          status: 'connecting',
          error: null,
          lastVerifiedAt: null,
        })

        type ConnectResult = { browserLaunched?: boolean; error?: string }
        const result = (await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.liveControl.connect, {
          headless,
          chromePath,
          storageState,
          platform: connectState.platform as LiveControlPlatform,
          account,
        })) as ConnectResult

        console.log('[Connect] IPC result:', result)

        // 浏览器启动失败是非致命错误，只显示警告，不改变状态
        if (result && !result.browserLaunched) {
          console.warn('[State Machine] Browser launch warning (non-fatal):', result.error)
          toast.error(result.error || '启动浏览器时出现问题，但连接流程将继续')
          // 保持 connecting 状态，等待登录成功事件
          // 仍然设置超时，因为可能浏览器实际上已经打开了
          loginTimeoutRef.current = setTimeout(() => {
            const currentState = connectState.status
            if (currentState === 'connecting') {
              console.log('[State Machine] Login timeout, status transition: connecting → error')
              setConnectState({
                status: 'error',
                error: '登录超时，请检查是否已完成扫码登录',
              })
              toast.error('登录超时，请重试')
            }
            loginTimeoutRef.current = null
          }, 60000)
          return
        }

        // 浏览器已启动，等待登录成功事件（通过 notifyAccountName 触发）
        // 状态保持为 connecting，直到收到登录成功事件或超时
        console.log('[State Machine] Browser launched, waiting for login success event...')

        // 设置超时：如果60秒内没有收到登录成功事件，才设置为错误
        loginTimeoutRef.current = setTimeout(() => {
          // 只有在仍然是 connecting 状态时才设置为错误
          // 如果已经变为 connected，说明登录成功了，不需要处理
          const currentState = connectState.status
          if (currentState === 'connecting') {
            console.log('[State Machine] Login timeout, status transition: connecting → error')
            setConnectState({
              status: 'error',
              error: '登录超时，请检查是否已完成扫码登录',
            })
            toast.error('登录超时，请重试')
          }
          loginTimeoutRef.current = null
        }, 60000) // 60秒超时
      } catch (error) {
        console.error('[State Machine] Connection failed:', error)
        // 只有在严重错误时才设置为 error
        // 普通错误保持 connecting 状态，等待登录成功
        const errorMessage = error instanceof Error ? error.message : '连接失败'
        console.log('[State Machine] Connection error (non-fatal warning):', errorMessage)
        toast.error(`${errorMessage}，但连接流程将继续`)
        // 不改变状态，保持 connecting，等待登录成功事件
        // 仍然设置超时
        loginTimeoutRef.current = setTimeout(() => {
          const currentState = connectState.status
          if (currentState === 'connecting') {
            console.log(
              '[State Machine] Login timeout after error, status transition: connecting → error',
            )
            setConnectState({
              status: 'error',
              error: '登录超时，请检查是否已完成扫码登录',
            })
            toast.error('登录超时，请重试')
          }
          loginTimeoutRef.current = null
        }, 60000)
      }
    })
  })

  const disconnectLiveControl = useMemoizedFn(async () => {
    if (!account) {
      toast.error('找不到对应账号')
      return
    }
    try {
      console.log('[State Machine] Starting disconnect for platform:', connectState.platform)
      console.log('[State Machine] Status transition:', connectState.status, '→ disconnected')

      await window.ipcRenderer.invoke(IPC_CHANNELS.tasks.liveControl.disconnect, account.id)

      // 状态迁移：any → disconnected
      setConnectState({
        status: 'disconnected',
        session: null,
        lastVerifiedAt: null,
        error: null,
      })

      toast.success('已断开连接')
    } catch (error) {
      console.error('[State Machine] Disconnect failed:', error)
      toast.error('断开连接失败')
    }
  })

  const handleButtonClick = useMemoizedFn(() => {
    if (connectState.status === 'connected') {
      disconnectLiveControl()
    } else if (connectState.status === 'connecting') {
      // Allow canceling connection attempt
      console.log('[State Machine] Canceling connection attempt')
      console.log('[State Machine] Status transition:', connectState.status, '→ disconnected')

      // 状态迁移：connecting → disconnected
      setConnectState({
        status: 'disconnected',
        session: null,
        lastVerifiedAt: null,
        error: null,
      })

      toast.success('已取消连接')
    } else {
      connectLiveControl()
    }
  })

  const getButtonText = () => {
    switch (connectState.status) {
      case 'connecting':
        return '连接中...'
      case 'connected':
        return '断开连接'
      case 'error':
        return '重试连接'
      default:
        return '连接直播中控台'
    }
  }

  return (
    <Button
      onClick={handleButtonClick}
      disabled={connectState.status === 'connecting'}
      variant={connectState.status === 'connected' ? 'destructive' : 'default'}
      className={connectState.status !== 'connected' ? 'font-medium text-sm' : undefined}
    >
      {getButtonText()}
    </Button>
  )
})

// 注意：verifyConnection 函数已移除
// 登录成功现在通过 notifyAccountName 事件通知，由后端 AccountSession 在登录成功后发送

const _ConnectButton = React.memo(
  ({ isLoading, handleButtonClick }: { isLoading: boolean; handleButtonClick: () => void }) => {
    return (
      <Button variant={'default'} onClick={handleButtonClick} disabled={isLoading} size="sm">
        {isLoading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <GlobeIcon className="mr-2 h-4 w-4" />
        )}
        {isLoading ? '连接中...' : '连接直播控制台'}
      </Button>
    )
  },
)

const _DisconnectButton = React.memo(({ handleButtonClick }: { handleButtonClick: () => void }) => {
  const [isHovered, setIsHovered] = useState(false)
  return (
    <Button
      variant="secondary"
      onClick={handleButtonClick}
      size="sm"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered ? (
        <>
          <XIcon className="mr-2 h-4 w-4" />
          断开连接
        </>
      ) : (
        <>
          <CheckIcon className="mr-2 h-4 w-4" />
          已连接
        </>
      )}
    </Button>
  )
})

const ConnectState = React.memo(() => {
  const connectState = useCurrentLiveControl(context => context.connectState)
  const accountName = useCurrentLiveControl(context => context.accountName)
  const statusText =
    connectState.status === 'connected'
      ? `已连接${accountName ? ` (${accountName})` : ''}`
      : connectState.status === 'connecting'
        ? '连接中'
        : connectState.status === 'error'
          ? '连接失败'
          : '未连接'
  const badgeVariant =
    connectState.status === 'connected'
      ? 'success'
      : connectState.status === 'connecting'
        ? 'warning'
        : connectState.status === 'error'
          ? 'destructive'
          : 'secondary'

  return (
    <div className="flex items-center gap-3">
      <div
        className={`h-2 w-2 rounded-full ${
          connectState.status === 'connected'
            ? 'bg-emerald-500'
            : connectState.status === 'connecting'
              ? 'bg-amber-400'
              : connectState.status === 'error'
                ? 'bg-red-500'
                : 'bg-gray-300'
        }`}
      />
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {statusText}
      </span>
      <Badge
        variant={badgeVariant}
        className={
          connectState.status === 'disconnected'
            ? 'border-border bg-muted text-foreground font-semibold text-xs px-2.5 py-0.5'
            : 'font-semibold text-xs px-2.5 py-0.5'
        }
      >
        {connectState.status === 'connected'
          ? '运行中'
          : connectState.status === 'connecting'
            ? '连接中'
            : connectState.status === 'error'
              ? '连接失败'
              : '未连接'}
      </Badge>
    </div>
  )
})

const HeadlessSetting = () => {
  const headless = useCurrentChromeConfig(context => context.headless ?? false)
  const connectState = useCurrentLiveControl(context => context.connectState)
  const { setHeadless } = useCurrentChromeConfigActions()
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-muted-foreground">无头模式</span>
      <Switch
        checked={headless}
        onCheckedChange={setHeadless}
        disabled={connectState.status !== 'disconnected'}
      />
    </div>
  )
}

export default StatusCard
