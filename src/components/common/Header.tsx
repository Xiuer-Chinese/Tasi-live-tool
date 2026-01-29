import { Moon, Package, Sun, User } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { AccountSwitcher } from './AccountSwitcher'

export function Header() {
  const { user, isAuthenticated } = useAuthStore()
  const [theme, setTheme] = useTheme()

  const handleToggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }

  const handleOpenUserCenter = () => {
    window.dispatchEvent(new CustomEvent('auth:user-center'))
  }

  return (
    <header
      className="w-full px-6 flex min-h-[64px] h-16 shrink-0 items-center justify-between relative z-10"
      style={{
        backgroundColor: 'var(--header-bg)',
        boxShadow: 'var(--header-top-shadow), var(--header-separator)',
      }}
    >
      {/* <div className=""> */}
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shadow-sm">
          <Package className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <h1 className="text-lg font-semibold sm:text-xl" style={{ color: 'var(--text-primary)' }}>
            她似-Live-Supertool
          </h1>
        </div>
      </div>

      {/* 用户操作区：主题切换 + 登录/用户信息 + 账号下拉，独立容器保证 Light/Dark 可读 */}
      <div
        className="header-account-area flex items-center gap-2 rounded-xl"
        style={{
          backgroundColor: 'var(--header-action-bg)',
          border: '1px solid var(--header-action-border)',
          color: 'var(--header-action-fg)',
          padding: '8px 12px',
        }}
      >
        <button
          type="button"
          className="rounded-lg p-2 transition-colors hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--header-action-bg)]"
          aria-label={theme === 'light' ? '切换到夜间模式' : '切换到日间模式'}
          style={{ color: 'var(--header-action-fg)' }}
          onClick={handleToggleTheme}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </button>
        {isAuthenticated && user ? (
          <button
            type="button"
            onClick={handleOpenUserCenter}
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--header-action-bg)]"
            style={{
              color: 'var(--header-action-fg)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--sidebar-item-hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">{user.username}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent('auth:required', { detail: { feature: 'login' } }),
              )
            }
            className="flex items-center gap-2 rounded-lg px-3 py-2 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--header-action-bg)]"
            style={{
              backgroundColor: 'var(--primary)',
              color: 'var(--on-primary)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = 'var(--primary-hover)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--primary)'
            }}
          >
            <User className="h-4 w-4" />
            <span className="text-sm font-medium">登录</span>
          </button>
        )}
        <AccountSwitcher />
      </div>
      {/* </div> */}
    </header>
  )
}
