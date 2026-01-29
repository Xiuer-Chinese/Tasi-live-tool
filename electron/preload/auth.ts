import { contextBridge, ipcRenderer } from 'electron'
import type { User } from '../../src/types/auth'

// 检查是否使用 Mock 认证服务
// 默认在开发环境使用 Mock，生产环境使用真实后端
const USE_MOCK_AUTH =
  process.env.USE_MOCK_AUTH === 'true' ||
  (process.env.NODE_ENV === 'development' && process.env.USE_REAL_AUTH !== 'true')

export const authAPI = {
  // Authentication
  register: async (data: {
    username: string
    email: string
    password: string
    confirmPassword: string
  }) => {
    if (USE_MOCK_AUTH) {
      // Mock 服务在 renderer 进程中运行，通过特殊标记让前端处理
      // 前端会在 authStore 中检测到这个标记并调用 MockAuthService
      return { __useMock: true, data }
    }
    // 使用真实后端（IPC）
    return await ipcRenderer.invoke('auth:register', data)
  },

  login: async (credentials: { username: string; password: string; rememberMe?: boolean }) => {
    if (USE_MOCK_AUTH) {
      return { __useMock: true, data: credentials }
    }
    return await ipcRenderer.invoke('auth:login', credentials)
  },

  logout: async (token: string) => {
    if (USE_MOCK_AUTH) {
      return { __useMock: true, data: { token } }
    }
    return ipcRenderer.invoke('auth:logout', token)
  },

  validateToken: async (token: string) => {
    if (USE_MOCK_AUTH) {
      return { __useMock: true, data: { token } }
    }
    return ipcRenderer.invoke('auth:validateToken', token)
  },

  getCurrentUser: async (token: string) => {
    if (USE_MOCK_AUTH) {
      return { __useMock: true, data: { token } }
    }
    return ipcRenderer.invoke('auth:getCurrentUser', token)
  },

  // Feature access
  checkFeatureAccess: (token: string, feature: string) =>
    ipcRenderer.invoke('auth:checkFeatureAccess', token, feature),

  requiresAuthentication: (feature: string) =>
    ipcRenderer.invoke('auth:requiresAuthentication', feature),

  // User management
  updateUserProfile: (token: string, data: { username?: string; email?: string }) =>
    ipcRenderer.invoke('auth:updateUserProfile', token, data),

  changePassword: (token: string, data: { currentPassword: string; newPassword: string }) =>
    ipcRenderer.invoke('auth:changePassword', token, data),

  // Events
  onAuthStateChanged: (callback: (user: User | null) => void) => {
    ipcRenderer.on('auth:stateChanged', (_, user) => callback(user))
  },

  onLoginRequired: (callback: (feature: string) => void) => {
    ipcRenderer.on('auth:loginRequired', (_, feature) => callback(feature))
  },

  removeAllListeners: () => {
    ipcRenderer.removeAllListeners('auth:stateChanged')
    ipcRenderer.removeAllListeners('auth:loginRequired')
  },
}

contextBridge.exposeInMainWorld('authAPI', authAPI)
