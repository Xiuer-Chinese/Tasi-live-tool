/**
 * Auth API 基址：与 authApiBase.ts 约定一致，渲染进程 getMe/refresh/status 等用此 base
 */
import { AUTH_API_BASE } from './authApiBase'

export const API_BASE_URL = import.meta.env.VITE_AUTH_API_BASE_URL ?? AUTH_API_BASE

export const isCloudAuthEnabled = (): boolean => {
  const url = import.meta.env.VITE_AUTH_API_BASE_URL ?? AUTH_API_BASE
  return typeof url === 'string' && url.length > 0
}
