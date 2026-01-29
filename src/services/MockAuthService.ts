/**
 * Mock 认证服务 - 使用 localStorage 存储用户信息
 * 用于在没有真实后端时提供本地注册/登录功能
 *
 * 使用方式：
 * 1. 在 electron/main/ipc/auth.ts 中根据环境变量选择使用 MockAuthService 或 AuthService
 * 2. 或者在前端直接使用此服务（绕过 IPC）
 */

import { v4 as uuidv4 } from 'uuid'
import type { AuthResponse, LoginCredentials, RegisterData, User } from '@/types/auth'

const STORAGE_KEY_USERS = 'mock_auth_users'
const STORAGE_KEY_TOKENS = 'mock_auth_tokens'
const TOKEN_EXPIRY_HOURS = 24 * 7 // 7 days

interface StoredUser extends Omit<User, 'passwordHash'> {
  passwordHash: string // localStorage 中存储密码哈希
}

interface StoredToken {
  token: string
  userId: string
  expiresAt: string
  deviceInfo: string
  lastUsed: string
}

/**
 * 简单的密码哈希（仅用于 mock，生产环境应使用 bcrypt）
 */
function hashPassword(password: string): string {
  // 简单的哈希实现（仅用于 mock）
  // 生产环境应使用 bcrypt
  return btoa(`${password}mock_salt`).substring(0, 50)
}

/**
 * 验证密码
 */
function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash
}

/**
 * 生成 mock token
 */
function generateToken(userId: string): string {
  const payload = {
    userId,
    timestamp: Date.now(),
    random: Math.random().toString(36).substring(2),
  }
  return `mock_token_${btoa(JSON.stringify(payload)).replace(/[^a-zA-Z0-9]/g, '')}`
}

/**
 * 从 localStorage 获取用户列表
 */
function getUsers(): StoredUser[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_USERS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * 保存用户列表到 localStorage
 */
function saveUsers(users: StoredUser[]): void {
  localStorage.setItem(STORAGE_KEY_USERS, JSON.stringify(users))
}

/**
 * 从 localStorage 获取 token 列表
 */
function getTokens(): StoredToken[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_TOKENS)
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * 保存 token 列表到 localStorage
 */
function saveTokens(tokens: StoredToken[]): void {
  localStorage.setItem(STORAGE_KEY_TOKENS, JSON.stringify(tokens))
}

/**
 * 验证手机号格式（简单验证）
 */
function isValidPhone(phone: string): boolean {
  // 简单的手机号验证：11位数字，以1开头
  return /^1[3-9]\d{9}$/.test(phone)
}

/**
 * 验证邮箱格式
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

/**
 * 判断输入是手机号还是邮箱
 */
function isPhoneOrEmail(input: string): 'phone' | 'email' | 'invalid' {
  if (isValidPhone(input)) {
    return 'phone'
  }
  if (isValidEmail(input)) {
    return 'email'
  }
  return 'invalid'
}

export class MockAuthService {
  /**
   * 用户注册
   * 支持手机号或邮箱注册
   */
  static async register(data: RegisterData): Promise<AuthResponse> {
    try {
      // 验证输入
      if (data.password !== data.confirmPassword) {
        return { success: false, error: '密码确认不匹配' }
      }

      if (data.password.length < 6) {
        return { success: false, error: '密码长度至少6位' }
      }

      // 判断是手机号还是邮箱
      const inputType = isPhoneOrEmail(data.email)
      if (inputType === 'invalid') {
        return { success: false, error: '请输入有效的手机号或邮箱地址' }
      }

      const users = getUsers()

      // 检查用户是否已存在（通过用户名、手机号或邮箱）
      const existingUser = users.find(
        u =>
          u.username === data.username ||
          u.email === data.email ||
          (inputType === 'phone' && u.email === data.email),
      )

      if (existingUser) {
        return { success: false, error: '用户名或手机号/邮箱已存在' }
      }

      // 创建用户
      const userId = uuidv4()
      const now = new Date().toISOString()
      const passwordHash = hashPassword(data.password)

      const user: StoredUser = {
        id: userId,
        username: data.username,
        email: data.email, // 存储手机号或邮箱
        passwordHash,
        createdAt: now,
        lastLogin: null,
        status: 'active',
        licenseType: 'free',
        expiryDate: null,
        deviceId: '',
        machineFingerprint: '',
      }

      users.push(user)
      saveUsers(users)

      // 生成 token
      const token = generateToken(userId)

      // 保存 token
      const tokens = getTokens()
      tokens.push({
        token,
        userId,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
        deviceInfo: 'Mock Device',
        lastUsed: now,
      })
      saveTokens(tokens)

      // 返回用户信息（不包含密码）
      const { passwordHash: _, ...userWithoutPassword } = user

      return {
        success: true,
        user: userWithoutPassword as Omit<User, 'passwordHash'>,
        token,
      }
    } catch (error) {
      console.error('[MockAuthService] Registration error:', error)
      return { success: false, error: '注册失败，请稍后重试' }
    }
  }

  /**
   * 用户登录
   * 支持通过用户名、手机号或邮箱登录
   */
  static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const users = getUsers()

      // 查找用户（支持用户名、手机号或邮箱登录）
      const user = users.find(
        u => u.username === credentials.username || u.email === credentials.username,
      )

      if (!user) {
        return { success: false, error: '用户名或密码错误' }
      }

      // 检查用户状态
      if (user.status !== 'active') {
        return { success: false, error: '账户已被禁用' }
      }

      // 验证密码
      if (!verifyPassword(credentials.password, user.passwordHash)) {
        return { success: false, error: '用户名或密码错误' }
      }

      // 更新最后登录时间
      user.lastLogin = new Date().toISOString()
      saveUsers(users)

      // 生成 token
      const token = generateToken(user.id)

      // 保存 token
      const tokens = getTokens()
      tokens.push({
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000).toISOString(),
        deviceInfo: 'Mock Device',
        lastUsed: new Date().toISOString(),
      })
      saveTokens(tokens)

      // 返回用户信息（不包含密码）
      const { passwordHash: _, ...userWithoutPassword } = user

      return {
        success: true,
        user: userWithoutPassword as Omit<User, 'passwordHash'>,
        token,
      }
    } catch (error) {
      console.error('[MockAuthService] Login error:', error)
      return { success: false, error: '登录失败，请稍后重试' }
    }
  }

  /**
   * 验证 token
   */
  static validateToken(token: string): User | null {
    try {
      const tokens = getTokens()
      const tokenData = tokens.find(t => t.token === token)

      if (!tokenData) {
        return null
      }

      // 检查 token 是否过期
      if (new Date(tokenData.expiresAt) < new Date()) {
        // 删除过期 token
        const updatedTokens = tokens.filter(t => t.token !== token)
        saveTokens(updatedTokens)
        return null
      }

      // 更新 token 最后使用时间
      tokenData.lastUsed = new Date().toISOString()
      saveTokens(tokens)

      // 获取用户信息
      const users = getUsers()
      const user = users.find(u => u.id === tokenData.userId)

      if (!user || user.status !== 'active') {
        return null
      }

      // 返回用户信息（不包含密码）
      const { passwordHash: _, ...userWithoutPassword } = user
      return userWithoutPassword as Omit<User, 'passwordHash'>
    } catch (error) {
      console.error('[MockAuthService] Token validation error:', error)
      return null
    }
  }

  /**
   * 获取当前用户
   */
  static getCurrentUser(token: string): User | null {
    return MockAuthService.validateToken(token)
  }

  /**
   * 登出
   */
  static logout(token: string): boolean {
    try {
      const tokens = getTokens()
      const updatedTokens = tokens.filter(t => t.token !== token)
      saveTokens(updatedTokens)
      return true
    } catch (error) {
      console.error('[MockAuthService] Logout error:', error)
      return false
    }
  }

  /**
   * 检查功能是否需要认证
   */
  static requiresAuthentication(_feature: string): boolean {
    // Mock 实现：所有功能都需要认证
    return true
  }

  /**
   * 获取功能所需的许可证类型
   */
  static getRequiredLicense(_feature: string): 'free' | 'trial' | 'premium' | 'enterprise' {
    // Mock 实现：默认返回 free
    return 'free'
  }

  /**
   * 检查用户是否有许可证
   */
  static hasLicense(user: User | null, _requiredLicense: string): boolean {
    if (!user) {
      return false
    }
    // Mock 实现：所有用户都有 free 许可证
    return true
  }
}
