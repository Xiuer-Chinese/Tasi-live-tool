import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { SubscribeDialog } from '@/components/auth/SubscribeDialog'
import { UserCenter } from '@/components/auth/UserCenter'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuthInit } from '@/hooks/useAuth'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import {
  useAuthCheckDone,
  useAuthStore,
  useIsAuthenticated,
  useIsOffline,
} from '@/stores/authStore'
import { useGateStore } from '@/stores/gateStore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false)
  const [showUserCenter, setShowUserCenter] = useState(false)
  const [currentFeature, setCurrentFeature] = useState<string>('')
  const trialExpiredShownRef = useRef(false)

  const authCheckDone = useAuthCheckDone()
  const isAuthenticated = useIsAuthenticated()
  const isOffline = useIsOffline()
  const userStatus = useAuthStore(s => s.userStatus)
  const { runPendingActionAndClear } = useGateStore()
  const { toast } = useToast()
  const trialExpiredModalShownRef = useRef(false)

  useAuthInit()

  useEffect(() => {
    const handleAuthRequired = (event: CustomEvent) => {
      const { feature } = event.detail
      setCurrentFeature(feature ?? 'login')
      setShowAuthDialog(true)
    }

    const handleSubscribeRequired = () => {
      setShowSubscribeDialog(true)
    }

    const handleAuthSuccess = () => {
      runPendingActionAndClear()
      if (!useGateStore.getState().defaultPlatformSetAfterLogin) {
        const accountId = useAccounts.getState().currentAccountId
        if (accountId) {
          useLiveControlStore.getState().setConnectState(accountId, { platform: 'dev' })
          useGateStore.getState().setDefaultPlatformSetAfterLogin(true)
          toast.success('已切换到测试平台，您可在此体验功能；开通试用后可使用正式平台')
        }
      }
    }

    const handleLicenseRequired = (event: CustomEvent) => {
      const { message } = event.detail
      alert(message)
    }

    const handleAccountDisabled = () => {
      toast.error('账号不可用')
    }

    const handleUserCenterOpen = () => {
      setShowUserCenter(true)
    }

    window.addEventListener('auth:required', handleAuthRequired as EventListener)
    window.addEventListener('auth:success', handleAuthSuccess as EventListener)
    window.addEventListener('gate:subscribe-required', handleSubscribeRequired as EventListener)
    window.addEventListener('auth:license-required', handleLicenseRequired as EventListener)
    window.addEventListener('auth:account-disabled', handleAccountDisabled as EventListener)
    window.addEventListener('auth:user-center', handleUserCenterOpen as EventListener)

    return () => {
      window.removeEventListener('auth:required', handleAuthRequired as EventListener)
      window.removeEventListener('auth:success', handleAuthSuccess as EventListener)
      window.removeEventListener(
        'gate:subscribe-required',
        handleSubscribeRequired as EventListener,
      )
      window.removeEventListener('auth:license-required', handleLicenseRequired as EventListener)
      window.removeEventListener('auth:account-disabled', handleAccountDisabled as EventListener)
      window.removeEventListener('auth:user-center', handleUserCenterOpen as EventListener)
    }
  }, [runPendingActionAndClear, toast])

  // 试用已结束（以服务端 userStatus 为准）：进入主界面后自动弹一次订阅弹窗
  useEffect(() => {
    if (!authCheckDone || !userStatus || trialExpiredModalShownRef.current) return
    if (userStatus.trial?.is_expired !== true || userStatus.plan === 'pro') return
    trialExpiredModalShownRef.current = true
    setShowSubscribeDialog(true)
  }, [authCheckDone, userStatus])

  if (!authCheckDone) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4"
        style={{ backgroundColor: 'var(--app-bg)' }}
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <span className="text-muted-foreground text-sm">加载中…</span>
      </div>
    )
  }

  return (
    <>
      {isOffline && (
        <div
          className="border-b px-4 py-2 text-center text-sm"
          style={{
            backgroundColor: 'var(--surface-muted)',
            color: 'var(--muted-foreground)',
          }}
        >
          当前网络不可用，部分功能可能受限
        </div>
      )}
      {children}

      <AuthDialog
        isOpen={showAuthDialog}
        onClose={() => {
          setShowAuthDialog(false)
          setCurrentFeature('')
        }}
        feature={currentFeature}
      />
      <SubscribeDialog
        isOpen={showSubscribeDialog}
        onClose={() => setShowSubscribeDialog(false)}
        actionName={useGateStore.getState().pendingActionName || undefined}
        trialExpired={userStatus?.trial?.is_expired === true && userStatus?.plan !== 'pro'}
      />
      <UserCenter isOpen={showUserCenter} onClose={() => setShowUserCenter(false)} />
    </>
  )
}
