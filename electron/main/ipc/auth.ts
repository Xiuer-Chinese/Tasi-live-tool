import { ipcMain } from 'electron'
import type { RegisterData } from '../../../src/types/auth'
import { AuthService } from '../services/AuthService'

// 检查是否使用 Mock 认证服务
// 可以通过环境变量控制：USE_MOCK_AUTH=true
const USE_MOCK_AUTH = process.env.USE_MOCK_AUTH === 'true' || process.env.NODE_ENV === 'development'

/**
 * 获取认证服务（根据配置选择使用 Mock 或真实服务）
 * 注意：MockAuthService 在 renderer 进程中运行（使用 localStorage）
 * 真实后端在 main 进程中运行（使用 SQLite）
 */
async function _getAuthService() {
  if (USE_MOCK_AUTH) {
    // Mock 服务在 renderer 进程中，需要通过 IPC 调用
    // 这里返回一个代理对象，实际调用会在 preload 中处理
    return {
      register: async (_data: RegisterData) => {
        // 转发到 renderer 进程的 MockAuthService
        // 注意：这需要在 preload 中实现
        throw new Error('MockAuthService should be called from renderer process')
      },
    }
  }
  return AuthService
}

export function setupAuthHandlers() {
  // Register user
  ipcMain.handle('auth:register', async (_, data) => {
    if (USE_MOCK_AUTH) {
      // Mock 服务在 renderer 进程中，返回特殊标记让 preload 处理
      return { __useMock: true, data }
    }
    return await AuthService.register(data)
  })

  // Login user
  ipcMain.handle('auth:login', async (_, credentials) => {
    return await AuthService.login(credentials)
  })

  // Logout user
  ipcMain.handle('auth:logout', async (_, token) => {
    return AuthService.logout(token)
  })

  // Validate token
  ipcMain.handle('auth:validateToken', async (_, token) => {
    return AuthService.validateToken(token)
  })

  // Get current user
  ipcMain.handle('auth:getCurrentUser', async (_, token) => {
    return AuthService.getCurrentUser(token)
  })

  // Check feature access
  ipcMain.handle('auth:checkFeatureAccess', async (_, token, feature) => {
    const user = AuthService.getCurrentUser(token)
    const requiresAuth = AuthService.requiresAuthentication(feature)
    const requiredLicense = AuthService.getRequiredLicense(feature)

    return {
      canAccess: !requiresAuth || AuthService.hasLicense(user, requiredLicense),
      requiresAuth,
      requiredLicense,
      user,
    }
  })

  // Check if feature requires authentication
  ipcMain.handle('auth:requiresAuthentication', async (_, feature) => {
    return AuthService.requiresAuthentication(feature)
  })

  // Update user profile
  ipcMain.handle('auth:updateUserProfile', async (_, _token, _data) => {
    // TODO: Implement user profile update
    return { success: false, error: '功能开发中' }
  })

  // Change password
  ipcMain.handle('auth:changePassword', async (_, _token, _data) => {
    // TODO: Implement password change
    return { success: false, error: '功能开发中' }
  })
}
