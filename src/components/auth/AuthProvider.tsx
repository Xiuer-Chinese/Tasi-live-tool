import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { LoginPage } from '@/components/auth/LoginPage'
import { UserCenter } from '@/components/auth/UserCenter'
import { useAuthInit } from '@/hooks/useAuth'
import { useAuthCheckDone, useIsAuthenticated, useIsOffline } from '@/stores/authStore'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showUserCenter, setShowUserCenter] = useState(false)
  const [currentFeature, setCurrentFeature] = useState<string>('')

  const authCheckDone = useAuthCheckDone()
  const isAuthenticated = useIsAuthenticated()
  const isOffline = useIsOffline()

  // 启动时执行一次鉴权（GET /me）
  useAuthInit()

  useEffect(() => {
    const handleAuthRequired = (event: CustomEvent) => {
      const { feature } = event.detail
      setCurrentFeature(feature)
      setShowAuthDialog(true)
    }

    const handleLicenseRequired = (event: CustomEvent) => {
      const { message } = event.detail
      alert(message)
    }

    const handleUserCenterOpen = () => {
      setShowUserCenter(true)
    }

    window.addEventListener('auth:required', handleAuthRequired as EventListener)
    window.addEventListener('auth:license-required', handleLicenseRequired as EventListener)
    window.addEventListener('auth:user-center', handleUserCenterOpen as EventListener)

    return () => {
      window.removeEventListener('auth:required', handleAuthRequired as EventListener)
      window.removeEventListener('auth:license-required', handleLicenseRequired as EventListener)
      window.removeEventListener('auth:user-center', handleUserCenterOpen as EventListener)
    }
  }, [])

  // Gate：未完成鉴权→加载；未登录→登录页；已登录→主内容
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

  if (!isAuthenticated) {
    return (
      <>
        <LoginPage />
        <AuthDialog
          isOpen={showAuthDialog}
          onClose={() => {
            setShowAuthDialog(false)
            setCurrentFeature('')
          }}
          feature={currentFeature}
        />
        <UserCenter isOpen={showUserCenter} onClose={() => setShowUserCenter(false)} />
      </>
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
      <UserCenter isOpen={showUserCenter} onClose={() => setShowUserCenter(false)} />
    </>
  )
}
