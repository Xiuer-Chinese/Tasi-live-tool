import { useMemoizedFn } from 'ahooks'
import { CheckIcon, GlobeIcon, Loader2, Monitor, Play, Square, XIcon } from 'lucide-react'
import React, { useEffect, useRef } from 'react'
import { IPC_CHANNELS } from 'shared/ipcChannels'
import { OneClickStartButton } from '@/components/common/OneClickStartButton'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAccounts } from '@/hooks/useAccounts'
import { useCurrentChromeConfig, useCurrentChromeConfigActions } from '@/hooks/useChromeConfig'
import {
  useCurrentLiveControl,
  useCurrentLiveControlActions,
  useLiveControlStore,
} from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { useGateStore } from '@/stores/gateStore'
import PlatformSelect from './PlatformSelect'

const StatusAlert = React.memo(() => {
  const connectState = useCurrentLiveControl(state => state.connectState)
  if (connectState.platform === 'wxchannel') {
    return (
      <Alert>
        <GlobeIcon className="h-4 w-4" />
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
        <GlobeIcon className="h-4 w-4" />
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

  const isConnected = connectState.status === 'connected'
  const isConnecting = connectState.status === 'connecting'

  return (
    <TooltipProvider>
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/50 px-6 py-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Monitor className="h-4 w-4 text-primary" />
              控制台状态
            </CardTitle>
            {/* 无头模式移到标题行右侧 */}
            <HeadlessSetting compact />
          </div>
        </CardHeader>
        <CardContent className="px-6 py-8">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {/* 左侧状态显示 */}
            <div className="flex items-center gap-4">
              <div
                className={`h-14 w-14 rounded-xl flex items-center justify-center ${isConnected ? 'bg-green-100' : 'bg-primary/10'}`}
              >
                {isConnected ? (
                  <div className="h-5 w-5 rounded-full bg-green-500 animate-pulse" />
                ) : isConnecting ? (
                  <Loader2 className="h-7 w-7 text-amber-500 animate-spin" />
                ) : (
                  <Monitor className="h-7 w-7 text-primary" />
                )}
              </div>
              <div>
                <div className="text-base font-medium">{statusText}</div>
                <div className="text-sm text-muted-foreground">
                  {connectState.platform
                    ? `${getPlatformName(connectState.platform)}`
                    : '请选择平台并连接'}
                </div>
              </div>
            </div>

            {/* 右侧操作区 */}
            <div className="flex items-center gap-4">
              {/* 平台选择 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="border rounded-lg px-3 py-2 bg-muted/30 h-10 flex items-center">
                    <PlatformSelect />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>选择直播平台</p>
                </TooltipContent>
              </Tooltip>

              {/* 连接/断开按钮 */}
              <ConnectToLiveControl />

              {/* 一键开启任务 - 次级按钮 */}
              <OneClickStartButton variant="secondary" />
            </div>
          </div>

          {/* 平台提示 */}
          <div className="mt-4">
            <StatusAlert />
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
})

// 获取平台显示名称
const getPlatformName = (platform: string) => {
  const names: Record<string, string> = {
    douyin: '抖音',
    taobao: '淘宝',
    wxchannel: '视频号',
    test: '测试平台',
  }
  return names[platform] || platform
}

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

  useEffect(() => {
    return () => {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current)
        loginTimeoutRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (connectState.status === 'connected' || connectState.status === 'disconnected') {
      if (loginTimeoutRef.current) {
        clearTimeout(loginTimeoutRef.current)
        loginTimeoutRef.current = null
      }
    }
  }, [connectState.status])

  useEffect(() => {
    if (connectState.status === 'connecting' && !loginTimeoutRef.current) {
      const checkTimer = setTimeout(() => {
        const currentState = useLiveControlStore.getState()
        const currentAccountId = useAccounts.getState().currentAccountId
        const currentContext = currentState.contexts[currentAccountId]

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
      }, 1000)

      return () => {
        clearTimeout(checkTimer)
      }
    }
  }, [connectState.status, setConnectState, toast])

  const guardAction = useGateStore(s => s.guardAction)

  const connectLiveControl = useMemoizedFn(async () => {
    await guardAction('connect-live-control', {
      requireSubscription: true,
      action: async () => {
        try {
          if (!account) {
            toast.error('找不到对应账号')
            return
          }

          if (loginTimeoutRef.current) {
            clearTimeout(loginTimeoutRef.current)
            loginTimeoutRef.current = null
          }

          console.log('[State Machine] selectedPlatformId:', connectState.platform)
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

          if (result && !result.browserLaunched) {
            console.warn('[State Machine] Browser launch warning (non-fatal):', result.error)
            toast.error(result.error || '启动浏览器时出现问题，但连接流程将继续')
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

          console.log('[State Machine] Browser launched, waiting for login success event...')
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
        } catch (error) {
          console.error('[State Machine] Connection failed:', error)
          const errorMessage = error instanceof Error ? error.message : '连接失败'
          console.log('[State Machine] Connection error (non-fatal warning):', errorMessage)
          toast.error(`${errorMessage}，但连接流程将继续`)
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
      },
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
      console.log('[State Machine] Canceling connection attempt')
      console.log('[State Machine] Status transition:', connectState.status, '→ disconnected')

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

  const isConnected = connectState.status === 'connected'

  return (
    <Button
      onClick={handleButtonClick}
      disabled={connectState.status === 'connecting'}
      variant={isConnected ? 'destructive' : 'default'}
      className="h-10 px-4 text-sm font-medium"
    >
      {isConnected ? <Square className="mr-1.5 h-4 w-4" /> : <Play className="mr-1.5 h-4 w-4" />}
      {getButtonText()}
    </Button>
  )
})

const HeadlessSetting = React.memo(({ compact = false }: { compact?: boolean }) => {
  const headless = useCurrentChromeConfig(context => context.headless ?? false)
  const connectState = useCurrentLiveControl(context => context.connectState)
  const { setHeadless } = useCurrentChromeConfigActions()

  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1.5 cursor-pointer">
            <span className="text-xs text-muted-foreground whitespace-nowrap">无头</span>
            <Switch
              checked={headless}
              onCheckedChange={setHeadless}
              disabled={connectState.status !== 'disconnected'}
              className="scale-90"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>无头模式：后台运行浏览器，不显示窗口</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-2 bg-muted/30 -my-1.5 cursor-pointer">
          <span className="text-sm text-muted-foreground whitespace-nowrap">无头模式</span>
          <Switch
            checked={headless}
            onCheckedChange={setHeadless}
            disabled={connectState.status !== 'disconnected'}
            className="scale-110"
          />
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p>无头模式：后台运行浏览器，不显示窗口</p>
      </TooltipContent>
    </Tooltip>
  )
})

export { ConnectToLiveControl, HeadlessSetting, StatusAlert }
export default StatusCard
