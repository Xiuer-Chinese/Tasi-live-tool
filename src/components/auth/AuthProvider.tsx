import { useEffect, useState } from 'react'
import { AuthDialog } from '@/components/auth/AuthDialog'
import { UserCenter } from '@/components/auth/UserCenter'
import { useAuthInit } from '@/hooks/useAuth'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [showAuthDialog, setShowAuthDialog] = useState(false)
  const [showUserCenter, setShowUserCenter] = useState(false)
  const [currentFeature, setCurrentFeature] = useState<string>('')

  // Initialize auth on app startup
  useAuthInit()

  useEffect(() => {
    // Listen for auth requirement events
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

  return (
    <>
      {children}

      {/* Auth Dialog */}
      <AuthDialog
        isOpen={showAuthDialog}
        onClose={() => {
          setShowAuthDialog(false)
          setCurrentFeature('')
        }}
        feature={currentFeature}
      />

      {/* User Center */}
      <UserCenter isOpen={showUserCenter} onClose={() => setShowUserCenter(false)} />
    </>
  )
}
