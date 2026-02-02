export interface User {
  id: string
  username: string
  email: string
  passwordHash: string
  createdAt: string
  lastLogin: string | null
  status: 'active' | 'inactive' | 'banned'
  licenseType: 'free' | 'trial' | 'premium' | 'enterprise'
  expiryDate: string | null
  deviceId: string
  machineFingerprint: string
}

export interface AuthToken {
  token: string
  userId: string
  expiresAt: string
  deviceInfo: string
  lastUsed: string
}

export interface UserConfig {
  id: string
  userId: string
  configData: string
  platform: string
  createdAt: string
  updatedAt: string
}

export interface AuthState {
  isAuthenticated: boolean
  user: SafeUser | null
  token: string | null
  isLoading: boolean
  error: string | null
}

export interface LoginCredentials {
  username: string
  password: string
  rememberMe?: boolean
}

export interface RegisterData {
  username: string
  email: string
  password: string
  confirmPassword: string
}

/** 前端展示用用户类型（不含密码哈希） */
export type SafeUser = Omit<User, 'passwordHash'>

export interface AuthResponse {
  success: boolean
  user?: SafeUser
  token?: string
  refresh_token?: string
  error?: string
}

export interface Permission {
  id: string
  name: string
  description: string
  requiredLicense: 'free' | 'trial' | 'premium' | 'enterprise'
}

export interface FeatureRestriction {
  feature: string
  requiresAuth: boolean
  requiredLicense: 'free' | 'trial' | 'premium' | 'enterprise'
  message: string
}

// ----- 云 API 类型（预留订阅） -----
export interface CloudUserOut {
  id: string
  email: string | null
  phone: string | null
  created_at: string
  last_login_at: string | null
  status: string
}

export interface CloudSubscriptionOut {
  plan: string
  status: string
  current_period_end: string | null
  features: string[]
}

export interface CloudAuthResponse {
  user: CloudUserOut
  access_token: string
  refresh_token: string
  token_type?: string
}

export interface CloudRefreshResponse {
  access_token: string
  token_type?: string
}

export interface CloudMeResponse {
  user: CloudUserOut
  subscription: CloudSubscriptionOut
}

/** 云 API 错误详情 */
export interface CloudErrorDetail {
  code: string
  message: string
}

/** GET /auth/status 返回：用户状态（只读感知，含 trial） */
export interface UserStatus {
  username: string
  status: 'active' | 'disabled'
  plan: 'free' | 'trial' | 'pro'
  created_at?: string
  last_login_at?: string
  trial?: {
    start_at?: string | null
    end_at?: string | null
    is_active?: boolean
    is_expired?: boolean
  }
}
