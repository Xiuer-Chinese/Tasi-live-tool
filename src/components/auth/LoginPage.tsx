/**
 * 未登录时全屏登录页：点击「登录」打开登录弹窗，登录成功后由 gate 进入主界面
 */
import { LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LoginPage() {
  const openLogin = () => {
    window.dispatchEvent(new CustomEvent('auth:required', { detail: { feature: 'login' } }))
  }

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-6"
      style={{ backgroundColor: 'var(--app-bg)' }}
    >
      <p className="text-muted-foreground text-base">请登录后使用</p>
      <Button onClick={openLogin} size="lg">
        <LogIn className="mr-2 h-4 w-4" />
        登录
      </Button>
    </div>
  )
}
