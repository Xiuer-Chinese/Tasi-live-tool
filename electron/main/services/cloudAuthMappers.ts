/** 云 API 用户映射为前端 SafeUser（兼容现有 UI） */
import type { CloudUserOut, SafeUser } from '../../../src/types/auth'

export function cloudUserToSafeUser(u: CloudUserOut): SafeUser {
  const identifier = u.email ?? u.phone ?? u.id
  return {
    id: u.id,
    username: identifier,
    email: identifier,
    createdAt: u.created_at,
    lastLogin: u.last_login_at,
    status: u.status as 'active' | 'inactive' | 'banned',
    licenseType: 'free',
    expiryDate: null,
    deviceId: '',
    machineFingerprint: '',
  }
}
