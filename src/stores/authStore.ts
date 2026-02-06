import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  AUTH_LAST_IDENTIFIER_KEY,
  AUTH_REMEMBER_ME_KEY,
  AUTH_ZUSTAND_PERSIST_KEY,
} from '@/constants/authStorageKeys'
import { getMe, getTrialStatus, getUserStatus, startTrial } from '../services/apiClient'
import { MockAuthService } from '../services/MockAuthService'
import type {
  AuthResponse,
  AuthState,
  LoginCredentials,
  RegisterData,
  SafeUser,
  UserStatus,
} from '../types/auth'
import { mapAuthError } from '../utils/mapAuthError'

/** authAPI 可能返回的 Mock 标记（用于降级到 MockAuthService） */
type LoginResponseWithMock = AuthResponse & { __useMock?: boolean; data?: LoginCredentials }
type RegisterResponseWithMock = AuthResponse & { __useMock?: boolean; data?: RegisterData }

/** 从 /me 返回的 username（即 sub）构建前端展示用 SafeUser */
function safeUserFromUsername(username: string): SafeUser {
  return {
    id: username,
    username,
    email: '',
    createdAt: new Date().toISOString(),
    lastLogin: null,
    status: 'active',
    licenseType: 'free',
    expiryDate: null,
    deviceId: '',
    machineFingerprint: '',
  }
}

interface AuthStore extends AuthState {
  /** 仅用于 refresh 流程，与 token（access）一起持久化 */
  refreshToken: string | null
  /** 启动时鉴权是否已完成（用于区分 loading / 登录页 / 主界面） */
  authCheckDone: boolean
  /** 有 token 但 /me 非 401 失败（断网/5xx）：保持已登录，仅提示离线 */
  isOffline: boolean
  /** GET /auth/status 返回的用户状态（只读感知，不做限制） */
  userStatus: UserStatus | null
  // Actions
  login: (
    credentials: LoginCredentials,
  ) => Promise<{ success: boolean; error?: string; rawError?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  /** 启动时调用：无 token→未登录；有 token→GET /me，200→已登录，401→尝试 refresh 后恢复或回登录页，其他→已登录但离线 */
  checkAuth: () => Promise<void>
  setUser: (user: SafeUser | null) => void
  setToken: (token: string | null) => void
  setRefreshToken: (refreshToken: string | null) => void
  /** refresh 失败时由 apiClient 调用：清空 token/refreshToken，回到登录页 */
  clearTokensAndUnauth: () => void
  setUserStatus: (userStatus: UserStatus | null) => void
  /** 拉取 /auth/status 并写入 store */
  refreshUserStatus: () => Promise<UserStatus | null>
  /** 调用 POST /auth/trial/start，成功则写入 userStatus；失败不改登录态，返回 errorCode（如 trial_already_used）供弹窗提示 */
  startTrialAndRefresh: () => Promise<
    { success: true; status: UserStatus } | { success: false; errorCode?: string; message?: string }
  >
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
      refreshToken: null,
      isLoading: false,
      error: null,
      authCheckDone: false,
      isOffline: false,
      userStatus: null,

      // Login action
      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null })
        const requestId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
        console.log(`[AuthStore] Login request [${requestId}]:`, {
          url: '(main process)',
          method: 'POST',
          body: { username: credentials.username, password: '***' },
        })

        try {
          let response = (await window.authAPI.login(credentials)) as LoginResponseWithMock

          // 如果返回 __useMock 标记，使用 MockAuthService
          if (response?.__useMock) {
            console.log('[AuthStore] Using MockAuthService for login')
            response = (await MockAuthService.login(
              response.data || credentials,
            )) as LoginResponseWithMock
          }

          console.log(`[AuthStore] Login response [${requestId}]:`, {
            success: response.success,
            hasToken: !!response.token,
            status: (response as { status?: number }).status,
            detail:
              (response as { detail?: string }).detail ??
              (response as { error?: string }).error ??
              null,
          })

          const refreshToken = response.refresh_token ?? null
          // 成功条件与后端一致：status==200 且 res.data.token 存在；不依赖 hasUser
          if (response.success && response.token) {
            const user = response.user ?? safeUserFromUsername(credentials.username)
            set({
              isAuthenticated: true,
              user,
              token: response.token,
              refreshToken: refreshToken ?? get().refreshToken,
              isLoading: false,
              error: null,
            })
            getUserStatus()
              .then(status => {
                if (status) {
                  get().setUserStatus(status)
                  console.log('[USER-STATUS]', status)
                }
              })
              .catch(() => {})
            return { success: true }
          }
          const status = (response as { status?: number }).status
          const detail = (response as { detail?: string }).detail ?? response.error ?? ''
          const requestUrl = (response as { requestUrl?: string }).requestUrl
          const raw = { status, detail, requestUrl }
          const { userMessage, rawForDev } = mapAuthError(raw)
          console.log(`[AuthStore] Login failed [${requestId}]:`, {
            status,
            detail: detail || '(none)',
          })
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
            isLoading: false,
            error: userMessage,
          })
          return { success: false, error: userMessage, rawError: rawForDev }
        } catch (error) {
          const { userMessage, rawForDev } = mapAuthError(
            error instanceof Error ? error : { error: String(error) },
          )
          console.log(`[AuthStore] Login failed [${requestId}] (throw):`, rawForDev)
          set({
            isAuthenticated: false,
            user: null,
            token: null,
            refreshToken: null,
            isLoading: false,
            error: userMessage,
          })
          return { success: false, error: userMessage, rawError: rawForDev }
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

          // 【步骤B】记录响应信息（证据链：与后端一致，不看 hasUser/hasToken）
          console.log(`[AuthStore] Register response [${requestId}]:`, {
            success: response.success,
            status: (response as { status?: number }).status,
            responseData: {
              success: response.success,
              user: !!response.user,
              token: !!response.token,
            },
          })

          const refreshToken = response.refresh_token ?? null
          // 成功条件与后端一致：res.status==200 且 res.data.success===true；不依赖 user/token
          if (response.success) {
            if (response.token && response.user) {
              set({
                isAuthenticated: true,
                user: response.user,
                token: response.token,
                refreshToken: refreshToken ?? get().refreshToken,
                isLoading: false,
                error: null,
              })
            } else {
              set({ isLoading: false, error: null })
            }
            console.log(`[AuthStore] Register success [${requestId}]`)
            return { success: true }
          }
          // 【步骤B】统一错误处理：展示 status + 后端 detail + requestUrl，不允许只显示「注册失败」
          const status = (response as { status?: number }).status
          const detail =
            (response as { detail?: string }).detail ?? extractErrorMessage(response, '') ?? ''
          const requestUrl = (response as { requestUrl?: string }).requestUrl
          const errorMessage =
            typeof status === 'number'
              ? `注册失败（${status}）：${detail || '(无详情)'}${typeof requestUrl === 'string' ? `（请求地址：${requestUrl}）` : ''}`
              : (detail || '注册失败') +
                (typeof requestUrl === 'string' ? ` (请求地址: ${requestUrl})` : '')
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
            refreshToken: null,
            userStatus: null,
            isLoading: false,
            error: null,
            isOffline: false,
          })
          // 退出登录后：若未勾选「记住账号」，清空本地保存的账号与记住状态
          if (
            typeof localStorage !== 'undefined' &&
            localStorage.getItem(AUTH_REMEMBER_ME_KEY) !== 'true'
          ) {
            localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
            localStorage.setItem(AUTH_REMEMBER_ME_KEY, 'false')
          }
        }
      },

      // 启动时鉴权：无 token→未登录；有 token→GET /me（内部 401 会尝试 refresh 后重试），200→已登录，401→回登录页，其他→已登录但离线
      checkAuth: async () => {
        set({ isLoading: true, authCheckDone: false })

        const { token, refreshToken } = get()
        if (!token && !refreshToken) {
          set({
            isAuthenticated: false,
            user: null,
            isLoading: false,
            authCheckDone: true,
            isOffline: false,
          })
          return
        }

        const result = await getMe()

        if (result.ok && result.data?.username != null) {
          set({
            isAuthenticated: true,
            user: safeUserFromUsername(result.data.username),
            isLoading: false,
            authCheckDone: true,
            isOffline: false,
            error: null,
          })
          getUserStatus()
            .then(status => {
              if (status) {
                get().setUserStatus(status)
                console.log('[USER-STATUS]', status)
              }
            })
            .catch(() => {})
          return
        }

        if (result.status === 401) {
          get().clearTokensAndUnauth()
          set({ isLoading: false, authCheckDone: true })
          return
        }

        // 断网/超时/5xx：不踢回登录页，保持已登录但离线
        set({
          isAuthenticated: true,
          isLoading: false,
          authCheckDone: true,
          isOffline: true,
        })
      },

      // Set user
      setUser: (user: SafeUser | null) => set({ user }),

      // Set token
      setToken: (token: string | null) => set({ token }),

      setRefreshToken: (refreshToken: string | null) => set({ refreshToken }),

      /** refresh 失败时由 apiClient 调用：清空 token/refreshToken，回到登录页 */
      clearTokensAndUnauth: () =>
        set({
          isAuthenticated: false,
          user: null,
          token: null,
          refreshToken: null,
          userStatus: null,
          isOffline: false,
        }),

      setUserStatus: (userStatus: UserStatus | null) => set({ userStatus }),

      refreshUserStatus: async () => {
        const status = await getUserStatus()
        if (status) set({ userStatus: status })
        return status
      },

      startTrialAndRefresh: async () => {
        const token = get().token
        if (!token) {
          return { success: false as const, message: '请先登录' }
        }
        const result = await startTrial()
        if (!result.ok) {
          return {
            success: false as const,
            errorCode: result.error?.code,
            message: result.error?.message ?? `请求失败（${result.status}）`,
          }
        }
        if (!result.data?.success) {
          return { success: false as const, message: '开通试用失败' }
        }
        const username = get().user?.username ?? ''
        const statusResult = await getTrialStatus(username)
        const statusData = statusResult.ok ? statusResult.data : null
        const userStatus: UserStatus = statusData
          ? {
              username: get().user?.username ?? username,
              status: 'active',
              plan: statusData.active ? 'trial' : 'free',
              trial: {
                start_at:
                  statusData.start_ts != null
                    ? new Date(statusData.start_ts * 1000).toISOString()
                    : null,
                end_at:
                  statusData.end_ts != null
                    ? new Date(statusData.end_ts * 1000).toISOString()
                    : null,
                is_active: statusData.active,
                is_expired: statusData.has_trial && !statusData.active,
              },
            }
          : {
              username: get().user?.username ?? username,
              status: 'active',
              plan: 'trial',
              trial: { is_active: true },
            }
        set({ userStatus })
        return { success: true as const, status: userStatus }
      },

      // Set loading state
      setLoading: (loading: boolean) => set({ isLoading: loading }),

      // Set error
      setError: (error: string | null) => set({ error }),

      // Clear error
      clearError: () => set({ error: null }),
    }),
    {
      name: AUTH_ZUSTAND_PERSIST_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        token: state.token,
        refreshToken: state.refreshToken,
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
export const useAuthCheckDone = () => useAuthStore(state => state.authCheckDone)
export const useIsOffline = () => useAuthStore(state => state.isOffline)