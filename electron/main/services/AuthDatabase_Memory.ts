// In-memory storage for demo purposes
import { v4 as uuidv4 } from 'uuid'

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

interface AuthToken {
  token: string
  userId: string
  expiresAt: string
  deviceInfo: string
  lastUsed: string
}

interface UserConfig {
  id: string
  userId: string
  configData: string
  platform: string
  createdAt: string
  updatedAt: string
}

const users: User[] = []
let tokens: AuthToken[] = []
let userConfigs: UserConfig[] = []

export class AuthDatabase {
  constructor() {
    // Initialize with demo user
    this.initDemoData()
  }

  private initDemoData() {
    // Create demo user if not exists
    if (users.length === 0) {
      const demoUser: User = {
        id: 'demo-user-id',
        username: 'demo',
        email: 'demo@example.com',
        passwordHash: '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6ukx.LFvOa', // password: demo123
        createdAt: new Date().toISOString(),
        lastLogin: null,
        status: 'active',
        licenseType: 'trial',
        expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        deviceId: 'demo-device',
        machineFingerprint: 'demo-fingerprint',
      }
      users.push(demoUser)
    }
  }

  // User operations
  createUser(user: Omit<User, 'id' | 'createdAt'>): User {
    const id = uuidv4()
    const now = new Date().toISOString()

    const newUser: User = {
      id,
      ...user,
      createdAt: now,
    }

    users.push(newUser)
    return newUser
  }

  getUserByUsername(username: string): User | null {
    return users.find(u => u.username === username) || null
  }

  getUserByEmail(email: string): User | null {
    return users.find(u => u.email === email) || null
  }

  getUserById(id: string): User | null {
    return users.find(u => u.id === id) || null
  }

  updateUserLastLogin(userId: string): void {
    const user = users.find(u => u.id === userId)
    if (user) {
      user.lastLogin = new Date().toISOString()
    }
  }

  // Token operations
  createToken(token: Omit<AuthToken, 'id'>): void {
    tokens.push(token)
  }

  getToken(token: string): AuthToken | null {
    return tokens.find(t => t.token === token) || null
  }

  updateTokenLastUsed(token: string): void {
    const tokenData = tokens.find(t => t.token === token)
    if (tokenData) {
      tokenData.lastUsed = new Date().toISOString()
    }
  }

  deleteToken(token: string): void {
    tokens = tokens.filter(t => t.token !== token)
  }

  deleteExpiredTokens(): void {
    const now = new Date()
    tokens = tokens.filter(t => new Date(t.expiresAt) > now)
  }

  // Config operations
  saveUserConfig(config: Omit<UserConfig, 'id' | 'createdAt' | 'updatedAt'>): UserConfig {
    const id = uuidv4()
    const now = new Date().toISOString()

    const newConfig: UserConfig = {
      id,
      ...config,
      createdAt: now,
      updatedAt: now,
    }

    // Remove existing config for same user/platform
    userConfigs = userConfigs.filter(
      c => !(c.userId === config.userId && c.platform === config.platform),
    )
    userConfigs.push(newConfig)

    return newConfig
  }

  getUserConfig(userId: string, platform: string): UserConfig | null {
    return userConfigs.find(c => c.userId === userId && c.platform === platform) || null
  }

  updateUserConfig(configId: string, configData: string): void {
    const config = userConfigs.find(c => c.id === configId)
    if (config) {
      config.configData = configData
      config.updatedAt = new Date().toISOString()
    }
  }

  close(): void {
    // No-op for in-memory storage
  }
}

// Singleton instance
let authDatabase: AuthDatabase | null = null

export function getAuthDatabase(): AuthDatabase {
  if (!authDatabase) {
    authDatabase = new AuthDatabase()
  }
  return authDatabase
}
