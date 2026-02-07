import { Eye, EyeOff, Loader2, LogIn, UserPlus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AUTH_LAST_IDENTIFIER_KEY,
  AUTH_REMEMBER_ME_KEY,
  BLOCKED_TEST_IDENTIFIERS,
  getSanitizedLastIdentifier,
} from '@/constants/authStorageKeys'
import { useToast } from '@/hooks/useToast'
import { useAuthStore } from '@/stores/authStore'

interface AuthDialogProps {
  isOpen: boolean
  onClose: () => void
  feature?: string
}

export function AuthDialog({ isOpen, onClose, feature }: AuthDialogProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loginForm, setLoginForm] = useState({
    username: '',
    password: '',
    rememberMe: false,
  })

  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  })

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  /** 登录失败时原始错误，仅开发环境折叠展示 */
  const [lastLoginRawError, setLastLoginRawError] = useState<string | null>(null)
  const [devDetailsOpen, setDevDetailsOpen] = useState(false)

  const { login, register, isLoading, error, clearError } = useAuthStore()
  const { toast } = useToast()

  // 用于跟踪是否已经回填过，避免重复回填
  const hasAutoFilledRef = useRef(false)

  // 清除错误和重置模式
  useEffect(() => {
    if (isOpen) {
      clearError()
      setValidationError(null)
      setLastLoginRawError(null)
      setDevDetailsOpen(false)
      setMode('login') // 默认显示登录
      // 重置回填标记，允许下次打开时重新回填
      hasAutoFilledRef.current = false
    } else {
      // 关闭弹窗时清空表单（密码始终清空，账号根据 rememberMe 决定）
      const rememberMe = localStorage.getItem(AUTH_REMEMBER_ME_KEY) === 'true'
      const lastIdentifier = getSanitizedLastIdentifier()
      if (rememberMe && lastIdentifier) {
        // 如果勾选了记住我，保留账号，只清空密码
        setLoginForm({ username: lastIdentifier, password: '', rememberMe: true })
      } else {
        // 如果未勾选记住我，清空所有
        setLoginForm({ username: '', password: '', rememberMe: false })
      }
    }
  }, [isOpen, clearError])

  // 切换到登录模式时，如果勾选了"记住我"，自动回填账号
  useEffect(() => {
    if (mode === 'login' && isOpen && !hasAutoFilledRef.current) {
      const rememberMe = localStorage.getItem(AUTH_REMEMBER_ME_KEY) === 'true'
      const lastIdentifier = getSanitizedLastIdentifier()

      // 只在当前表单为空时回填，避免覆盖用户手动输入
      if (rememberMe && lastIdentifier && !loginForm.username.trim()) {
        setLoginForm(prev => ({ ...prev, username: lastIdentifier, rememberMe: true }))
        hasAutoFilledRef.current = true

        // 延迟聚焦密码输入框，提升用户体验
        setTimeout(() => {
          const passwordInput = document.getElementById('login-password') as HTMLInputElement
          if (passwordInput) {
            passwordInput.focus()
          }
        }, 100)
      } else if (rememberMe && !loginForm.username.trim()) {
        // 如果勾选了记住我但账号为空，设置 rememberMe 状态
        setLoginForm(prev => ({ ...prev, rememberMe: true }))
        hasAutoFilledRef.current = true
      } else if (!rememberMe) {
        // 如果未勾选记住我，确保 rememberMe 状态为 false
        setLoginForm(prev => ({ ...prev, rememberMe: false }))
        hasAutoFilledRef.current = true
      }
    }
  }, [mode, isOpen, loginForm.username.trim]) // 注意：不依赖 loginForm.username，避免循环更新

  // 前端校验函数
  const validateLoginForm = (): string | null => {
    if (!loginForm.username || !loginForm.username.trim()) {
      return '请输入账号（手机号或邮箱）'
    }
    if (!loginForm.password) {
      return '请输入密码'
    }
    return null
  }

  const validateRegisterForm = (): string | null => {
    const { email, password, confirmPassword } = registerForm

    // 手机号或邮箱格式校验
    const phoneRegex = /^1[3-9]\d{9}$/
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!email || (!phoneRegex.test(email) && !emailRegex.test(email))) {
      return '请输入有效的手机号或邮箱地址'
    }

    // 密码长度校验
    if (!password || password.length < 6) {
      return '密码长度至少6位'
    }

    // 确认密码一致性校验
    if (password !== confirmPassword) {
      return '两次输入的密码不一致'
    }

    return null
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setValidationError(null)

    // 前端校验
    const validationErr = validateLoginForm()
    if (validationErr) {
      setValidationError(validationErr)
      toast.error(validationErr)
      return
    }

    const result = await login(loginForm)
    if (result.success) {
      // 登录成功后，保存"记住我"设置和账号
      const { rememberMe, username } = loginForm
      if (rememberMe) {
        localStorage.setItem(AUTH_REMEMBER_ME_KEY, 'true')
        const trimmed = username.trim()
        if (trimmed && !BLOCKED_TEST_IDENTIFIERS.has(trimmed)) {
          localStorage.setItem(AUTH_LAST_IDENTIFIER_KEY, trimmed)
        } else {
          localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
        }
      } else {
        localStorage.setItem(AUTH_REMEMBER_ME_KEY, 'false')
        localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
      }

      // 登录成功后，触发成功事件（用于继续执行待执行的操作）
      window.dispatchEvent(new CustomEvent('auth:success', { detail: { feature } }))
      toast.success('登录成功')
      onClose()
      setLoginForm({ username: '', password: '', rememberMe: false })
    } else {
      // 仅清空密码、保留账号；展示友好文案；开发环境可展开原始错误
      const userMessage = result.error || '登录失败，请稍后重试'
      setLoginForm(prev => ({ ...prev, password: '' }))
      setValidationError(userMessage)
      setLastLoginRawError(result.rawError ?? null)
      setDevDetailsOpen(false)
      toast.error(userMessage)
      setTimeout(() => {
        const passwordInput = document.getElementById('login-password') as HTMLInputElement | null
        if (passwordInput) passwordInput.focus()
      }, 100)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    clearError()
    setValidationError(null)

    // 前端校验
    const validationErr = validateRegisterForm()
    if (validationErr) {
      setValidationError(validationErr)
      toast.error(validationErr)
      return
    }

    // 防重复提交
    if (isSubmitting || isLoading) {
      return
    }

    setIsSubmitting(true)

    try {
      // 将 email 作为 username 传递，保持与后端接口兼容
      const result = await register({
        username: registerForm.email,
        email: registerForm.email,
        password: registerForm.password,
        confirmPassword: registerForm.confirmPassword,
      })
      if (result.success) {
        toast.success('注册成功')
        // 注册成功后切换到登录模式
        setMode('login')
        setRegisterForm({ email: '', password: '', confirmPassword: '' })
        // 可选：自动填充登录表单
        setLoginForm(prev => ({ ...prev, username: registerForm.email }))
      } else {
        // 显示后端错误
        const errorMessage = result.error || '注册失败，请检查网络或稍后重试'
        setValidationError(errorMessage)
        toast.error(errorMessage)
      }
    } catch (error) {
      console.error('[AuthDialog] Unexpected error during registration:', error)
      const errorMessage = '注册失败，请稍后重试'
      setValidationError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }

  // 处理 Enter 键提交
  const handleKeyDown = (e: React.KeyboardEvent, formType: 'login' | 'register') => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // 创建一个模拟的 FormEvent 来调用处理函数
      const formEvent = {
        ...e,
        currentTarget: e.currentTarget,
        target: e.target,
      } as unknown as React.FormEvent
      if (formType === 'login') {
        handleLogin(formEvent)
      } else {
        handleRegister(formEvent)
      }
    }
  }

  if (!isOpen) return null

  // 获取当前显示的错误信息（优先显示后端错误）
  const displayError = error || validationError

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="w-full max-w-[26.25rem] bg-white rounded-xl border border-[hsl(var(--border))] p-6"
        style={{ boxShadow: 'var(--shadow-card)' }}
      >
        {/* Header */}
        <div className="text-center mb-5">
          <h1
            className="text-xl font-semibold mb-0"
            style={{
              color: 'var(--text-primary)',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            }}
          >
            {mode === 'login' ? '登录' : '注册'}
          </h1>
        </div>

        {/* Content */}
        <div>
          {/* Error Message（仅展示友好文案，不展示状态码/URL/英文原文） */}
          {displayError && (
            <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg space-y-2">
              <p
                className="text-[13px] text-destructive"
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {displayError}
              </p>
              {import.meta.env.DEV && lastLoginRawError && (
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setDevDetailsOpen(prev => !prev)}
                    className="text-[12px] text-muted-foreground hover:text-foreground underline"
                  >
                    {devDetailsOpen ? '收起' : '更多信息'}
                  </button>
                  {devDetailsOpen && (
                    <pre className="mt-1 p-2 bg-muted/50 rounded text-[11px] overflow-auto max-h-24 break-all whitespace-pre-wrap">
                      {lastLoginRawError}
                    </pre>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Login Form */}
          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-3">
              <Input
                id="login-username"
                type="text"
                placeholder="手机号或邮箱"
                value={loginForm.username}
                onChange={e => setLoginForm(prev => ({ ...prev, username: e.target.value }))}
                onKeyDown={e => handleKeyDown(e, 'login')}
                className="h-10 border-input text-foreground placeholder:text-muted-foreground rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-ring/30"
                required
                autoFocus
              />

              <div className="relative">
                <Input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="密码"
                  value={loginForm.password}
                  onChange={e => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                  onKeyDown={e => handleKeyDown(e, 'login')}
                  className="h-10 border-input text-foreground placeholder:text-muted-foreground rounded-lg text-sm pr-12 focus-visible:ring-2 focus-visible:ring-ring/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center space-x-2 pt-0.5">
                <input
                  type="checkbox"
                  id="remember-me"
                  checked={loginForm.rememberMe}
                  onChange={e => setLoginForm(prev => ({ ...prev, rememberMe: e.target.checked }))}
                  className="h-4 w-4 rounded border-input text-primary focus:ring-ring/30"
                />
                <Label
                  htmlFor="remember-me"
                  className="text-[13px] text-muted-foreground cursor-pointer"
                >
                  记住登录状态
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full h-10 rounded-lg text-sm font-medium mt-4"
                disabled={isLoading}
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    登录中...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <LogIn className="h-4 w-4" />
                    登录
                  </div>
                )}
              </Button>

              {/* Footer */}
              <div className="mt-4 space-y-2">
                {/* 第一行：还没有账号？ + 立即注册 */}
                <div className="flex items-center justify-center gap-2 text-[14px]">
                  <span className="text-muted-foreground">还没有账号？</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register')
                      clearError()
                      setValidationError(null)
                    }}
                    className="text-primary hover:opacity-80 font-medium transition-colors duration-150"
                  >
                    立即注册
                  </button>
                </div>

                {/* 第二行：忘记密码？ */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      // 忘记密码功能暂不实现，只显示提示
                      toast.error('忘记密码功能开发中')
                    }}
                    className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    忘记密码？
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-3">
              <Input
                id="register-email"
                type="text"
                placeholder="手机号或邮箱"
                value={registerForm.email}
                onChange={e => setRegisterForm(prev => ({ ...prev, email: e.target.value }))}
                className="h-10 border-input text-foreground placeholder:text-muted-foreground rounded-lg text-sm focus-visible:ring-2 focus-visible:ring-ring/30"
                required
                autoFocus
              />

              <div className="relative">
                <Input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="密码（至少6位）"
                  value={registerForm.password}
                  onChange={e => setRegisterForm(prev => ({ ...prev, password: e.target.value }))}
                  className="h-10 border-input text-foreground placeholder:text-muted-foreground rounded-lg text-sm pr-12 focus-visible:ring-2 focus-visible:ring-ring/30"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 p-1"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="relative">
                <Input
                  id="register-confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="确认密码"
                  value={registerForm.confirmPassword}
                  onChange={e =>
                    setRegisterForm(prev => ({ ...prev, confirmPassword: e.target.value }))
                  }
                  onKeyDown={e => handleKeyDown(e, 'register')}
                  className="h-10 border-input text-foreground placeholder:text-muted-foreground rounded-lg text-sm pr-12 focus-visible:ring-2 focus-visible:ring-ring/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150 p-1"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full h-10 rounded-lg text-sm font-medium mt-4"
                disabled={isLoading || isSubmitting}
              >
                {isLoading || isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    注册中...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    注册
                  </div>
                )}
              </Button>

              {/* Footer */}
              <div className="mt-4 space-y-2">
                {/* 第一行：已有账号？ + 立即登录 */}
                <div className="flex items-center justify-center gap-2 text-[14px]">
                  <span className="text-muted-foreground">已有账号？</span>
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      clearError()
                      setValidationError(null)
                    }}
                    className="text-primary hover:opacity-80 font-medium transition-colors duration-150"
                  >
                    立即登录
                  </button>
                </div>

                {/* 第二行：忘记密码？ */}
                <div className="flex items-center justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      // 忘记密码功能暂不实现，只显示提示
                      toast.error('忘记密码功能开发中')
                    }}
                    className="text-[13px] text-muted-foreground hover:text-foreground transition-colors duration-150"
                  >
                    忘记密码？
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Cancel Button */}
          <div className="mt-4 text-center">
            <Button
              variant="ghost"
              onClick={onClose}
              className="text-[13px] text-muted-foreground hover:text-foreground h-auto p-0"
            >
              取消
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
