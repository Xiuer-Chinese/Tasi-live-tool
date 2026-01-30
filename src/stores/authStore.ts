import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { MockAuthService } from '../services/MockAuthService'
import type {
  AuthResponse,
  AuthState,
  LoginCredentials,
  RegisterData,
  SafeUser,
} from '../types/auth'

/** authAPI 可能返回的 Mock 标记（用于降级到 MockAuthService） */
type LoginResponseWithMock = AuthResponse & { __useMock?: boolean; data?: LoginCredentials }
type RegisterResponseWithMock = AuthResponse & { __useMock?: boolean; data?: RegisterData }

interface AuthStore extends AuthState {
  // Actions
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  checkAuth: () => Promise<void>
  setUser: (user: SafeUser | null) => void
  setToken: (token: string | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // Initial state
      isAuthenticated: false,
      user: null,
      token: null,
      isLoading: false,
      error: null,

      // Login action
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null })

        try {
          let response = (await window.authAPI.login(credentials)) as LoginResponseWithMock

          // 如果返回 __useMock 标记，使用 MockAuthService
          if (response?.__useMock) {
            console.log('[AuthStore] Using MockAuthService for login')
            response = (await MockAuthService.login(
              response.data || credentials,
            )) as LoginResponseWithMock
          }

          if (response.success && response.user && response.token) {
            set({
              isAuthenticated: true,
              user: response.user,
              token: response.token,
              isLoading: false,
              error: null,
            })
            return { success: true }
          }
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: response.error || '登录失败',
          })
          return { success: false, error: response.error }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : '登录失败'
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: errorMessage,
          })
          return { success: false, error: errorMessage }
        }
      },

      // Register action
      register: async (data: RegisterData) => {
        set({ isLoading: true, error: null })

        // 【步骤D】生成请求追踪 ID
        const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

        // 【步骤B】统一错误处理：准备错误信息提取函数
        const extractErrorMessage = (error: unknown, defaultMessage: string): string => {
          // 如果是 AuthResponse 格式的错误
          const err = error as { error?: string } | null | undefined
          if (err?.error) {
            return err.error
          }
          // 如果是 Error 对象
          if (error instanceof Error) {
            return error.message || defaultMessage
          }
          // 如果是字符串
          if (typeof error === 'string') {
            return error
          }
          // 默认错误信息
          return defaultMessage
        }

        try {
          // 【步骤B】记录请求信息（去掉密码，打码处理）
          const payloadForLog = {
            ...data,
            password: '***',
            confirmPassword: '***',
          }
          console.log(`[AuthStore] Register request [${requestId}]:`, payloadForLog)

          let response = (await window.authAPI.register(data)) as RegisterResponseWithMock

          // 如果返回 __useMock 标记，使用 MockAuthService
          if (response?.__useMock) {
            console.log(`[AuthStore] Using MockAuthService for registration [${requestId}]`)
            response = (await MockAuthService.register(
              response.data || data,
            )) as RegisterResponseWithMock
          }

          // 【步骤B】记录响应信息
          console.log(`[AuthStore] Register response [${requestId}]:`, {
            success: response.success,
            hasUser: !!response.user,
            hasToken: !!response.token,
            error: response.error || null,
          })

          if (response.success && response.user && response.token) {
            set({
              isAuthenticated: true,
              user: response.user,
              token: response.token,
              isLoading: false,
              error: null,
            })
            console.log(`[AuthStore] Register success [${requestId}]`)
            return { success: true }
          }
          // 【步骤B】统一错误处理：优先显示后端返回的 error 字段
          const errorMessage = extractErrorMessage(response, '注册失败')
          console.error(`[AuthStore] Register failed [${requestId}]:`, {
            error: errorMessage,
            response: response,
          })

          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: errorMessage,
          })
          return { success: false, error: errorMessage }
        } catch (error) {
          // 【步骤B】统一错误处理：区分网络错误和其他错误
          // 【步骤E】如果后端不可用/未启动，也要能提示
          let errorMessage: string

          if (error instanceof Error) {
            // 检查是否是网络错误（IPC 调用失败）
            if (
              error.message.includes('IPC') ||
              error.message.includes('invoke') ||
              error.message.includes('timeout')
            ) {
              errorMessage = '无法连接服务器，请确认后端服务已启动/网络可用'
              console.error(`[AuthStore] Register network error [${requestId}]:`, error)
              console.error('[AuthStore] Error stack:', error.stack)
            } else {
              errorMessage = error.message || '注册失败，请稍后重试'
              console.error(`[AuthStore] Register error [${requestId}]:`, error)
            }
          } else {
            errorMessage = extractErrorMessage(error, '注册失败，请稍后重试')
            console.error(`[AuthStore] Register unknown error [${requestId}]:`, error)
          }

          // 【步骤B】记录完整的错误信息
          console.error(`[AuthStore] Register failed [${requestId}]:`, {
            error: errorMessage,
            errorObject: error,
            requestId,
          })

          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: errorMessage,
          })
          return { success: false, error: errorMessage }
        }
      },

      // Logout action
      logout: async () => {
        const { token } = get()

        try {
          if (token) {
            const result = (await window.authAPI.logout(token)) as boolean | { __useMock?: boolean }
            // 如果返回 __useMock 标记，使用 MockAuthService
            if (typeof result === 'object' && result?.__useMock) {
              MockAuthService.logout(token)
            }
          }
        } catch (error) {
          console.error('Logout error:', error)
        } finally {
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: null,
          })
        }
      },

      // Check authentication status
      checkAuth: async () => {
        const { token } = get()

        if (!token) {
          set({ isAuthenticated: false, user: null })
          return
        }

        set({ isLoading: true })

        try {
          let user = (await window.authAPI.getCurrentUser(token)) as
            | SafeUser
            | null
            | (SafeUser & { __useMock?: boolean })
          // 如果返回 __useMock 标记，使用 MockAuthService
          if (user && typeof user === 'object' && '__useMock' in user && user.__useMock) {
            user = MockAuthService.getCurrentUser(token)
          }

          if (user && !('__useMock' in user)) {
            set({
              isAuthenticated: true,
              user: user as SafeUser,
              isLoading: false,
              error: null,
            })
          } else {
            // Token invalid, clear auth state
            set({
              isAuthenticated: false,
              user: null,
              token: null,
              isLoading: false,
              error: null,
            })
          }
        } catch (error) {
          console.error('Auth check error:', error)
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            isLoading: false,
            error: null,
          })
        }
      },

      // Set user
      setUser: (user: SafeUser | null) => set({ user }),

      // Set token
      setToken: (token: string | null) => set({ token }),

      // Set loading state
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      // Set error
      setError: (error: string | null) => set({ error }),

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)

// Selectors for easier access
export const useAuth = () => useAuthStore()
export const useUser = () => useAuthStore(state => state.user)
export const useIsAuthenticated = () => useAuthStore(state => state.isAuthenticated)
export const useAuthLoading = () => useAuthStore(state => state.isLoading)
export const useAuthError = () => useAuthStore(state => state.error)
