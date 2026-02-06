import { Moon, Package, Sun, User } from 'lucide-react'
import { memo, useCallback } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { useAuthStore } from '@/stores/authStore'
import { AccountSwitcher } from './AccountSwitcher'

/**
 * Header 组件 - 已优化
 * 1. 使用 memo 避免父组件重渲染时不必要的更新
 * 2. 使用 selector 精确订阅 store 状态，避免订阅整个 store
 * 3. 使用 useCallback 缓存事件处理函数
 */
export const Header = memo(function Header() {
  // 使用 selector 精确订阅，避免订阅整个 store 导致不必要的重渲染
  const user = useAuthStore(state => state.user)
  const isAuthenticated = useAuthStore(state => state.isAuthenticated)
  const [theme, setTheme] = useTheme()

  // 使用 useCallback 缓存事件处理函数
  const handleToggleTheme = useCallback(() => {
    setTheme(theme === 'light' ? 'dark' : 'light')
  }, [theme, setTheme])

  const handleOpenUserCenter = useCallback(() => {
    window.dispatchEvent(new CustomEvent('auth:user-center'))
  }, [])

  const handleLoginClick = useCallback(() => {
    window.dispatchEvent(new CustomEvent('auth:required', { detail: { feature: 'login' } }))
  }, [])

  return (
    <header
      className="w-full px-6 flex min-h-[60px] h-[60px] shrink-0 items-center justify-between relative z-10"
      style={{
        backgroundColor: 'var(--header-bg)',
        boxShadow: 'var(--header-top-shadow), var(--header-separator)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <Package className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <h1
            className="text-base font-semibold sm:text-lg tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            她似-Live-Supertool
          </h1>
        </div>
      </div>

      <div
        className="header-account-area flex items-center gap-1.5 rounded-lg"
        style={{
          backgroundColor: 'var(--header-action-bg)',
          border: '1px solid var(--header-action-border)',
          color: 'var(--header-action-fg)',
          padding: '6px 10px',
        }}
      >
        <button
          type="button"
          className="rounded-md p-1.5 transition-colors duration-150 hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--header-action-bg)]"
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
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--header-action-bg)]"
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
            <span className="text-sm font-medium truncate max-w-[120px]">{user.username}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleLoginClick}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2 focus:ring-offset-[var(--header-action-bg)]"
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
})
