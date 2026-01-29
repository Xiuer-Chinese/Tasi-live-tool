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
        return 'bg-gray-100 text-gray-800'
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
      className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4"
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
        className="w-[480px] max-w-[92vw] max-h-[70vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
        style={{ boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)' }}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation()
          }
        }}
        role="document"
      >
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 border-b border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors p-1"
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
                <h2 id="user-center-title" className="text-xl font-semibold text-gray-900 truncate">
                  {user.username}
                </h2>
                <p className="text-sm text-gray-500 truncate mt-0.5">{user.email}</p>
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
              <p className="text-sm text-gray-600 leading-relaxed">
                {getLicenseDescription(user.licenseType)}
              </p>

              {/* 注册时间/最后登录 - 两列布局 */}
              <div className="grid grid-cols-2 gap-4 text-xs text-gray-500">
                <div>
                  <span className="text-gray-400">注册时间</span>
                  <p className="text-gray-600 mt-0.5">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {user.lastLogin && (
                  <div>
                    <span className="text-gray-400">最后登录</span>
                    <p className="text-gray-600 mt-0.5">
                      {new Date(user.lastLogin).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* Section B: 功能权限 */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-900">功能权限</h4>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {/* 直播控制 */}
                <div className="flex items-center gap-2">
                  {hasFeature(['free', 'trial', 'premium', 'enterprise']) ? (
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-gray-300 flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['free', 'trial', 'premium', 'enterprise'])
                        ? 'text-gray-900'
                        : 'text-gray-400'
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
                    <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['trial', 'premium', 'enterprise'])
                        ? 'text-gray-900'
                        : 'text-gray-400'
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
                    <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['trial', 'premium', 'enterprise'])
                        ? 'text-gray-900'
                        : 'text-gray-400'
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
                    <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['trial', 'premium', 'enterprise'])
                        ? 'text-gray-900'
                        : 'text-gray-400'
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
                    <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['premium', 'enterprise']) ? 'text-gray-900' : 'text-gray-400'
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
                    <Lock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  )}
                  <span
                    className={
                      hasFeature(['premium', 'enterprise']) ? 'text-gray-900' : 'text-gray-400'
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
        <div className="px-6 pt-4 pb-6 border-t border-gray-100 space-y-2">
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
            className="w-full bg-red-500 hover:bg-red-600 text-white"
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
