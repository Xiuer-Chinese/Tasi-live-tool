/**
 * Auth API 基址：dev/prod 可配置，用于云鉴权（注册/登录/refresh/me）
 * 不设置时走本地/Mock 鉴权
 */
const devBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'http://127.0.0.1:8000'
const prodBase = import.meta.env.VITE_AUTH_API_BASE_URL ?? 'https://your-auth-api.example.com'

export const API_BASE_URL = import.meta.env.MODE === 'production' ? prodBase : devBase

export const isCloudAuthEnabled = (): boolean => {
  const url = import.meta.env.VITE_AUTH_API_BASE_URL
  return typeof url === 'string' && url.length > 0
}
