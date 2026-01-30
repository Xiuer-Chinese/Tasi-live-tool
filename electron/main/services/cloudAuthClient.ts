/**
 * 主进程内云 Auth API 客户端：register / login / refresh / me，401 时自动 refresh 并重试一次
 */
import type {
  CloudAuthResponse,
  CloudErrorDetail,
  CloudMeResponse,
  CloudRefreshResponse,
} from '../../../src/types/auth'

const getBaseUrl = (): string => {
  const url = process.env.AUTH_API_BASE_URL ?? process.env.VITE_AUTH_API_BASE_URL ?? ''
  return url.replace(/\/$/, '')
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: object; accessToken?: string } = {},
): Promise<{ data?: T; status: number; error?: CloudErrorDetail }> {
  const base = getBaseUrl()
  if (!base) {
    return { status: 0, error: { code: 'invalid_params', message: 'AUTH_API_BASE_URL 未配置' } }
  }
  const url = `${base}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`
  }
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    })
    const text = await res.text()
    let json: T | { detail?: CloudErrorDetail } = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      // ignore
    }
    if (!res.ok) {
      const detail = json && typeof json === 'object' && 'detail' in json ? json.detail : undefined
      return {
        status: res.status,
        error:
          typeof detail === 'object' && detail && 'code' in detail
            ? (detail as CloudErrorDetail)
            : { code: 'request_failed', message: text || res.statusText },
      }
    }
    return { data: json as T, status: res.status }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { status: 0, error: { code: 'network_error', message } }
  }
}

export async function cloudRegister(
  identifier: string,
  password: string,
): Promise<{
  success: boolean
  user?: CloudAuthResponse['user']
  access_token?: string
  refresh_token?: string
  error?: string
}> {
  const { data, status, error } = await request<CloudAuthResponse>('POST', '/auth/register', {
    body: { identifier, password },
  })
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? '注册失败',
    }
  }
  return {
    success: true,
    user: data.user,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  }
}

export async function cloudLogin(
  identifier: string,
  password: string,
): Promise<{
  success: boolean
  user?: CloudAuthResponse['user']
  access_token?: string
  refresh_token?: string
  error?: string
}> {
  const { data, error } = await request<CloudAuthResponse>('POST', '/auth/login', {
    body: { identifier, password },
  })
  if (error || !data) {
    return {
      success: false,
      error: error?.message ?? '登录失败',
    }
  }
  return {
    success: true,
    user: data.user,
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  }
}

export async function cloudRefresh(refreshToken: string): Promise<{
  success: boolean
  access_token?: string
  error?: string
}> {
  const { data, error } = await request<CloudRefreshResponse>('POST', '/auth/refresh', {
    body: { refresh_token: refreshToken },
  })
  if (error || !data) {
    return { success: false, error: error?.message ?? 'refresh 失败' }
  }
  return { success: true, access_token: data.access_token }
}

export async function cloudMe(accessToken: string): Promise<{
  success: boolean
  user?: CloudMeResponse['user']
  subscription?: CloudMeResponse['subscription']
  error?: string
}> {
  const { data, status, error } = await request<CloudMeResponse>('GET', '/me', {
    accessToken: accessToken,
  })
  if (status === 401 || error || !data) {
    return {
      success: false,
      error: error?.message ?? 'token 失效',
    }
  }
  return {
    success: true,
    user: data.user,
    subscription: data.subscription,
  }
}
