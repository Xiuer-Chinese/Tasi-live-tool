import { Check, Crown, Lock, LogOut, Shield, User, X } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/authStore'

interface UserCenterProps {
  isOpen: boolean
  onClose: () => void
}

export function UserCenter({ isOpen, onClose }: UserCenterProps) {
  const { user, logout } = useAuthStore()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async () => {
    setIsLoggingOut(true)
    await logout()
    setIsLoggingOut(false)
    onClose()
  }

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const getLicenseIcon = (licenseType: string) => {
    switch (licenseType) {
      case 'premium':
        return <Crown className="h-4 w-4" />
      case 'enterprise':
        return <Shield className="h-4 w-4" />
      default:
        return <User className="h-4 w-4" />
    }
  }

  const getLicenseColor = (licenseType: string) => {
    switch (licenseType) {
      case 'premium':
        return 'bg-yellow-100 text-yellow-800'
      case 'enterprise':
        return 'bg-purple-100 text-purple-800'
      case 'trial':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-muted text-foreground'
    }
  }

  const getLicenseText = (licenseType: string) => {
    switch (licenseType) {
      case 'premium':
        return '高级版'
      case 'enterprise':
        return '企业版'
      case 'trial':
        return '试用版'
      default:
        return '免费版'
    }
  }

  const getLicenseDescription = (licenseType: string) => {
    switch (licenseType) {
      case 'free':
        return '可以使用基础功能，部分高级功能受限'
      case 'trial':
        return '可以试用所有功能，有时间限制'
      case 'premium':
        return '可以使用所有功能，无限制'
      case 'enterprise':
        return '企业级功能，支持多设备'
      default:
        return ''
    }
  }

  const hasFeature = (featureLicense: string[]) => {
    return featureLicense.includes(user?.licenseType || '')
  }

  if (!isOpen || !user) return null

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
      onKeyDown={e => {
        if (e.key === 'Escape') {
          onClose()
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-center-title"
    >
      <div
        className="w-[30rem] max-w-[92vw] max-h-[70vh] bg-white rounded-xl border border-[hsl(var(--border))] overflow-hidden flex flex-col"
        style={{ boxShadow: 'var(--shadow-card)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
        role="document"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-[hsl(var(--border))]">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors duration-150 p-1"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start justify-between gap-4 pr-8">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                {getLicenseIcon(user.licenseType)}
              </div>
              <div className="flex-1 min-w-0">
                <h2
                  id="user-center-title"
                  className="text-lg font-semibold text-foreground truncate"
                >
                  {user.username}
                </h2>
                <p className="text-sm text-muted-foreground truncate mt-0.5">{user.email}</p>
              </div>
            </div>
            <Badge className={`${getLicenseColor(user.licenseType)} flex-shrink-0`}>
              <div className="flex items-center gap-1">
                {getLicenseIcon(user.licenseType)}
                {getLicenseText(user.licenseType)}
              </div>
            </Badge>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-5">
            {/* Section A: 权益说明 */}
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {getLicenseDescription(user.licenseType)}
              </p>

              {/* 注册时间/最后登录 - 两列布局 */}
              <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                <div>
                  <span className="text-muted-foreground/80">注册时间</span>
                  <p className="text-foreground mt-0.5">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {user.lastLogin && (
                  <div>
                    <span className="text-muted-foreground/80">最后登录</span>
                    <p className="text-foreground mt-0.5">
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Section B: 功能权限 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-foreground">功能权限</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* 直播控制 */}
                <div className="flex items-center gap-2">
                  {hasFeature(['free', 'trial', 'premium', 'enterprise']) ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/40 flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['free', 'trial', 'premium', 'enterprise'])
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    直播控制
                  </span>
                </div>

                {/* 自动回复 */}
                <div className="flex items-center gap-2">
                  {hasFeature(['trial', 'premium', 'enterprise']) ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['trial', 'premium', 'enterprise'])
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    自动回复
                  </span>
                </div>

                {/* 自动发言 */}
                <div className="flex items-center gap-2">
                  {hasFeature(['trial', 'premium', 'enterprise']) ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['trial', 'premium', 'enterprise'])
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    自动发言
                  </span>
                </div>

                {/* 自动弹窗 */}
                <div className="flex items-center gap-2">
                  {hasFeature(['trial', 'premium', 'enterprise']) ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['trial', 'premium', 'enterprise'])
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    自动弹窗
                  </span>
                </div>

                {/* AI 助手 */}
                <div className="flex items-center gap-2">
                  {hasFeature(['premium', 'enterprise']) ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['premium', 'enterprise'])
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    AI 助手
                  </span>
                </div>

                {/* 高级设置 */}
                <div className="flex items-center gap-2">
                  {hasFeature(['premium', 'enterprise']) ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['premium', 'enterprise'])
                        ? 'text-foreground'
                        : 'text-muted-foreground'
                    }
                  >
                    高级设置
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed */}
        <div className="px-6 pt-4 pb-6 border-t border-[hsl(var(--border))] space-y-2">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              /* TODO: 打开设置页面 */
            }}
          >
            账号设置
          </Button>

          <Button
            variant="destructive"
            className="w-full"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                退出中...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4" />
                退出登录
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
