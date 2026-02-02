import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Define types inline to avoid import issues
interface User {
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

interface LoginCredentials {
  username: string
  password: string
  rememberMe?: boolean
}

interface RegisterData {
  username: string
  email: string
  password: string
  confirmPassword: string
}

interface AuthResponse {
  success: boolean
  user?: Omit<User, 'passwordHash'>
  token?: string
  error?: string
}

import { getAuthDatabase } from './AuthDatabase'

export class AuthService {
  private static readonly JWT_SECRET = 'tashi-live-supertool-secret-key-change-in-production'
  private static readonly TOKEN_EXPIRY_HOURS = 24 * 7 // 7 days

  // User registration
  static async register(data: RegisterData): Promise<AuthResponse> {
    try {
      const db = getAuthDatabase()

      // Validate input
      if (data.password !== data.confirmPassword) {
        return { success: false, error: '密码确认不匹配' }
      }

      if (data.password.length < 6) {
        return { success: false, error: '密码长度至少6位' }
      }

      // Check if user already exists
      const existingUser = db.getUserByUsername(data.username) || db.getUserByEmail(data.email)
      if (existingUser) {
        return { success: false, error: '用户名或邮箱已存在' }
      }

      // Hash password
      const passwordHash = await bcrypt.hash(data.password, 10)

      // Create user
      const user = db.createUser({
        username: data.username,
        email: data.email,
        passwordHash,
        lastLogin: null,
        status: 'active',
        licenseType: 'free',
        expiryDate: null,
        deviceId: '',
        machineFingerprint: '',
      })

      // Generate token
      const token = AuthService.generateToken(user.id)

      // Save token
      db.createToken({
        token,
        userId: user.id,
        expiresAt: new Date(
          Date.now() + AuthService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        ).toISOString(),
        deviceInfo: 'Unknown Device',
        lastUsed: new Date().toISOString(),
      })

      return {
        success: true,
        user: AuthService.sanitizeUser(user),
        token,
      }
    } catch (error) {
      console.error('Registration error:', error)
      return { success: false, error: '注册失败，请稍后重试' }
    }
  }

  // User login
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const db = getAuthDatabase()

      // Find user
      const user = db.getUserByUsername(credentials.username)
      if (!user) {
        return { success: false, error: '用户名或密码错误' }
      }

      // Check user status
      if (user.status !== 'active') {
        return { success: false, error: '账户已被禁用' }
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(credentials.password, user.passwordHash)
      if (!isValidPassword) {
        return { success: false, error: '用户名或密码错误' }
      }

      // Update last login
      db.updateUserLastLogin(user.id)

      // Generate token
      const token = AuthService.generateToken(user.id)

      // Save token
      db.createToken({
        token,
        userId: user.id,
        expiresAt: new Date(
          Date.now() + AuthService.TOKEN_EXPIRY_HOURS * 60 * 60 * 1000,
        ).toISOString(),
        deviceInfo: 'Unknown Device',
        lastUsed: new Date().toISOString(),
      })

      return {
        success: true,
        user: AuthService.sanitizeUser(user),
        token,
      }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: '登录失败，请稍后重试' }
    }
  }

  // Validate token
  static validateToken(token: string): User | null {
    try {
      const db = getAuthDatabase()

      // Check if token exists and is not expired
      const tokenData = db.getToken(token)
      if (!tokenData || new Date(tokenData.expiresAt) < new Date()) {
        if (tokenData) {
          db.deleteToken(token)
        }
        return null
      }

      // Verify JWT
      const decoded = jwt.verify(token, AuthService.JWT_SECRET) as { userId: string }
      const user = db.getUserById(decoded.userId)

      if (!user || user.status !== 'active') {
        db.deleteToken(token)
        return null
      }

      // Update token last used
      db.updateTokenLastUsed(token)

      return user
    } catch (error) {
      console.error('Token validation error:', error)
      return null
    }
  }

  // Logout
  static logout(token: string): boolean {
    try {
      const db = getAuthDatabase()
      db.deleteToken(token)
      return true
    } catch (error) {
      console.error('Logout error:', error)
      return false
    }
  }

  // Get current user
  static getCurrentUser(token: string): User | null {
    return AuthService.validateToken(token)
  }

  // Clean up expired tokens
  static cleanupExpiredTokens(): void {
    try {
      const db = getAuthDatabase()
      db.deleteExpiredTokens()
    } catch (error) {
      console.error('Token cleanup error:', error)
    }
  }

  // Generate JWT token
  private static generateToken(userId: string): string {
    return jwt.sign({ userId }, AuthService.JWT_SECRET, {
      expiresIn: `${AuthService.TOKEN_EXPIRY_HOURS}h`,
    })
  }

  /** 供 IPC 等边界使用：User → SafeUser，不暴露 passwordHash */
  static sanitizeUser(user: User): Omit<User, 'passwordHash'> {
    const { passwordHash, ...sanitizedUser } = user
    return sanitizedUser
  }

  // Check if user has required license（接受 SafeUser | null，IPC 仅暴露 SafeUser）
  static hasLicense(
    user: Omit<User, 'passwordHash'> | null,
    requiredLicense: 'free' | 'trial' | 'premium' | 'enterprise',
  ): boolean {
    if (!user) return requiredLicense === 'free'

    const licenseHierarchy: Record<string, number> = {
      free: 0,
      trial: 1,
      premium: 2,
      enterprise: 3,
    }

    const userLevel = licenseHierarchy[user.licenseType]
    const requiredLevel = licenseHierarchy[requiredLicense]

    // Check if user has trial that hasn't expired
    if (user.licenseType === 'trial' && user.expiryDate) {
      return new Date(user.expiryDate) > new Date() && userLevel >= requiredLevel
    }

    return userLevel >= requiredLevel
  }

  // Check if feature requires authentication
  static requiresAuthentication(feature: string): boolean {
    const featuresRequiringAuth: Record<string, boolean> = {
      auto_reply: true,
      auto_message: true,
      auto_popup: true,
      ai_chat: true,
      live_control: false,
      settings: false,
      preview: false,
    }

    return featuresRequiringAuth[feature] || false
  }

  // Get required license for feature
  static getRequiredLicense(feature: string): 'free' | 'trial' | 'premium' | 'enterprise' {
    const featureLicenses: Record<string, 'free' | 'trial' | 'premium' | 'enterprise'> = {
      auto_reply: 'trial',
      auto_message: 'trial',
      auto_popup: 'trial',
      ai_chat: 'premium',
      live_control: 'free',
      settings: 'free',
      preview: 'free',
    }

    return featureLicenses[feature] || 'free'
  }
}
