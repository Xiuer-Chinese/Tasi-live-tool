import { Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { SubscribeDialog } from '@/components/auth/SubscribeDialog'
import { UserCenter } from '@/components/auth/UserCenter'
import { useAccounts } from '@/hooks/useAccounts'
import { useAuthInit } from '@/hooks/useAuth'
import { useLiveControlStore } from '@/hooks/useLiveControl'
import { useToast } from '@/hooks/useToast'
import { useAuthCheckDone, useIsAuthenticated, useIsOffline } from '@/stores/authStore'
import { useGateStore } from '@/stores/gateStore'
import { useTrialStore } from '@/stores/trialStore'

const TRIAL_EXPIRED_TOAST_KEY = 'trialExpiredToastShown'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showSubscribeDialog, setShowSubscribeDialog] = useState(false)
  const [showUserCenter, setShowUserCenter] = useState(false)
  const [currentFeature, setCurrentFeature] = useState<string>('')
  const trialExpiredShownRef = useRef(false)

  const authCheckDone = useAuthCheckDone()
  const isAuthenticated = useIsAuthenticated()
  const isOffline = useIsOffline()
  const { runPendingActionAndClear } = useGateStore()
  const { toast } = useToast()

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

    const handleUserCenterOpen = () => {
      setShowUserCenter(true)
    }

    window.addEventListener('auth:required', handleAuthRequired as EventListener)
    window.addEventListener('auth:success', handleAuthSuccess as EventListener)
    window.addEventListener('gate:subscribe-required', handleSubscribeRequired as EventListener)
    window.addEventListener('auth:license-required', handleLicenseRequired as EventListener)
    window.addEventListener('auth:user-center', handleUserCenterOpen as EventListener)

    return () => {
      window.removeEventListener('auth:required', handleAuthRequired as EventListener)
      window.removeEventListener('auth:success', handleAuthSuccess as EventListener)
      window.removeEventListener(
        'gate:subscribe-required',
        handleSubscribeRequired as EventListener,
      )
      window.removeEventListener('auth:license-required', handleLicenseRequired as EventListener)
      window.removeEventListener('auth:user-center', handleUserCenterOpen as EventListener)
    }
  }, [runPendingActionAndClear, toast])

  // 试用已结束：启动时一次性提示
  useEffect(() => {
    if (!authCheckDone || trialExpiredShownRef.current) return
    const isTrialExpiredFn = useTrialStore.getState().isTrialExpired
    if (typeof isTrialExpiredFn !== 'function' || !isTrialExpiredFn()) return
    if (sessionStorage.getItem(TRIAL_EXPIRED_TOAST_KEY)) return
    trialExpiredShownRef.current = true
    sessionStorage.setItem(TRIAL_EXPIRED_TOAST_KEY, '1')
    toast.success('试用已结束，开通后可继续使用')
  }, [authCheckDone, toast])

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
      />
      <UserCenter isOpen={showUserCenter} onClose={() => setShowUserCenter(false)} />
    </>
  )
}
