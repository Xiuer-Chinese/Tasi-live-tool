import { ipcMain } from 'electron'
import type { LoginCredentials, RegisterData, SafeUser, User } from '../../../src/types/auth'
import { AuthService } from '../services/AuthService'
import { clearStoredTokens, getStoredTokens, setStoredTokens } from '../services/CloudAuthStorage'
import { cloudLogin, cloudMe, cloudRefresh, cloudRegister } from '../services/cloudAuthClient'
import { cloudUserToSafeUser } from '../services/cloudAuthMappers'

const USE_MOCK_AUTH =
  process.env.USE_MOCK_AUTH === 'true' ||
  (process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')

const USE_CLOUD_AUTH = !!process.env.AUTH_API_BASE_URL || !!process.env.VITE_AUTH_API_BASE_URL

export function setupAuthHandlers() {
  // ----- 云鉴权：恢复会话（启动时 refresh -> me） -----
  ipcMain.handle('auth:restoreSession', async () => {
    if (!USE_CLOUD_AUTH) {
      return { success: false, user: null, token: null }
    }
    const { refresh_token } = getStoredTokens()
    if (!refresh_token) return { success: false, user: null, token: null }
    const refreshRes = await cloudRefresh(refresh_token)
    if (!refreshRes.success || !refreshRes.access_token) {
      clearStoredTokens()
      return { success: false, user: null, token: null }
    }
    const meRes = await cloudMe(refreshRes.access_token)
    if (!meRes.success || !meRes.user) {
      return { success: false, user: null, token: null }
    }
    setStoredTokens({
      access_token: refreshRes.access_token,
      refresh_token,
    })
    return {
      success: true,
      user: cloudUserToSafeUser(meRes.user),
      token: refreshRes.access_token,
    }
  })

  // Register
  ipcMain.handle('auth:register', async (_, data: RegisterData) => {
    if (USE_MOCK_AUTH) {
      return { __useMock: true, data }
    }
    if (USE_CLOUD_AUTH) {
      const identifier = (data.email || '').trim()
      if (!identifier) {
        return { success: false, error: '请输入手机号或邮箱' }
      }
      const res = await cloudRegister(identifier, data.password)
      if (!res.success) {
        return { success: false, error: res.error }
      }
      if (res.access_token && res.refresh_token && res.user) {
        setStoredTokens({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        })
        return {
          success: true,
          user: cloudUserToSafeUser(res.user),
          token: res.access_token,
          refresh_token: res.refresh_token,
        }
      }
      return { success: false, error: res.error }
    }
    return await AuthService.register(data)
  })

  // Login
  ipcMain.handle('auth:login', async (_, credentials: LoginCredentials) => {
    if (USE_MOCK_AUTH) {
      return { __useMock: true, data: credentials }
    }
    if (USE_CLOUD_AUTH) {
      const identifier = (credentials.username || '').trim()
      if (!identifier) {
        return { success: false, error: '请输入手机号或邮箱' }
      }
      const res = await cloudLogin(identifier, credentials.password)
      if (!res.success) {
        return { success: false, error: res.error }
      }
      if (res.access_token && res.refresh_token && res.user) {
        setStoredTokens({
          access_token: res.access_token,
          refresh_token: res.refresh_token,
        })
        return {
          success: true,
          user: cloudUserToSafeUser(res.user),
          token: res.access_token,
          refresh_token: res.refresh_token,
        }
      }
      return { success: false, error: res.error }
    }
    return await AuthService.login(credentials)
  })

  // Logout
  ipcMain.handle('auth:logout', async (_, token: string) => {
    if (USE_MOCK_AUTH) {
      return { __useMock: true, data: { token } }
    }
    if (USE_CLOUD_AUTH) {
      clearStoredTokens()
      return true
    }
    return await AuthService.logout(token)
  })

  // Get current user（401 时自动 refresh 并重试一次）
  ipcMain.handle('auth:getCurrentUser', async (_, token: string) => {
    if (USE_MOCK_AUTH) {
      return { __useMock: true, data: { token } }
    }
    if (USE_CLOUD_AUTH) {
      if (!token) return null
      let meRes = await cloudMe(token)
      if (meRes.success && meRes.user) {
        return cloudUserToSafeUser(meRes.user)
      }
      const { refresh_token } = getStoredTokens()
      if (!refresh_token) return null
      const refreshRes = await cloudRefresh(refresh_token)
      if (!refreshRes.success || !refreshRes.access_token) return null
      meRes = await cloudMe(refreshRes.access_token)
      if (!meRes.success || !meRes.user) return null
      setStoredTokens({
        access_token: refreshRes.access_token,
        refresh_token,
      })
      return cloudUserToSafeUser(meRes.user)
    }
    return AuthService.getCurrentUser(token)
  })

  // Validate token
  ipcMain.handle('auth:validateToken', async (_, token: string) => {
    if (USE_CLOUD_AUTH) {
      const meRes = await cloudMe(token)
      return meRes.success && meRes.user ? cloudUserToSafeUser(meRes.user) : null
    }
    return AuthService.validateToken(token)
  })

  // Check feature access（IPC 只暴露 SafeUser；本地 AuthService 返回 User 时在此映射为 SafeUser）
  ipcMain.handle('auth:checkFeatureAccess', async (_, token: string, feature: string) => {
    const rawUser = await (async () => {
      if (USE_CLOUD_AUTH && token) {
        const meRes = await cloudMe(token)
        if (meRes.success && meRes.user) return cloudUserToSafeUser(meRes.user)
      }
      if (USE_CLOUD_AUTH) return null
      return AuthService.getCurrentUser(token)
    })()
    const user: SafeUser | null =
      rawUser == null
        ? null
        : 'passwordHash' in rawUser
          ? AuthService.sanitizeUser(rawUser as User)
          : rawUser
    const requiresAuth = AuthService.requiresAuthentication(feature)
    const requiredLicense = AuthService.getRequiredLicense(feature)
    return {
      canAccess: !requiresAuth || AuthService.hasLicense(user, requiredLicense),
      requiresAuth,
      requiredLicense,
      user,
    }
  })

  ipcMain.handle('auth:requiresAuthentication', async (_, feature: string) => {
    return AuthService.requiresAuthentication(feature)
  })

  ipcMain.handle('auth:updateUserProfile', async (_, _token: string, _data: unknown) => {
    return { success: false, error: '功能开发中' }
  })

  ipcMain.handle('auth:changePassword', async (_, _token: string, _data: unknown) => {
    return { success: false, error: '功能开发中' }
  })
}
