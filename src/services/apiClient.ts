/**
 * 鉴权请求统一出口：所有需要登录态的后端 API 必须经 requestWithRefresh 或 getMe 发起，禁止在业务代码中手写带 token 的 fetch。
 * 自动带 Bearer Token；401 时若有 refresh_token 则自动 POST /refresh 后重试一次（加锁防并发）。
 * API_BASE_URL 来自 src/config/authApi.ts，勿在此硬编码。
 */
import { API_BASE_URL } from '@/config/authApi'
import { useAuthStore } from '@/stores/authStore'
import type { UserStatus } from '@/types/auth'

export type ApiResult<T = unknown> =
  | { ok: true; data: T; status: number }
  | { ok: false; status: number; error?: { code?: string; message?: string } }

async function request<T>(
  method: string,
  path: string,
  token: string | null,
  body?: object,
): Promise<ApiResult<T>> {
  const url = `${API_BASE_URL.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
  // [AUTH-AUDIT] 临时审计日志：真正发起 fetch 前打印 process、method、full_url。可删除。
  const processType =
    typeof process !== 'undefined' && process && 'type' in process
      ? (process as { type?: string }).type
      : 'renderer'
  console.log('[AUTH-AUDIT]', processType ?? 'renderer', method, url)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    let json: T | { detail?: { code?: string; message?: string } } | null = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      // ignore
    }
    if (!res.ok) {
      const rawDetail =
        json && typeof json === 'object' && 'detail' in json
          ? (json as { detail?: unknown }).detail
          : undefined
      let message = text || res.statusText
      if (typeof rawDetail === 'string') {
        message = rawDetail
      } else if (rawDetail && typeof rawDetail === 'object' && 'message' in (rawDetail as object)) {
        message = (rawDetail as { message?: string }).message ?? message
      } else if (Array.isArray(rawDetail) && rawDetail.length > 0) {
        message = (rawDetail as { msg?: string }[]).map(d => d?.msg ?? JSON.stringify(d)).join('; ')
      }
      const code =
        rawDetail && typeof rawDetail === 'object' && 'code' in (rawDetail as object)
          ? (rawDetail as { code?: string }).code
          : undefined
      return {
        ok: false,
        status: res.status,
        error: { code, message },
      }
    }
    return { ok: true, data: json as T, status: res.status }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, status: 0, error: { code: 'network_error', message } }
  }
}

/** POST /auth/refresh 响应：仅返回 access_token */
interface RefreshResponse {
  access_token: string
  token_type?: string
}

let refreshLock: Promise<string | null> | null = null

/** 调用 POST /auth/refresh，成功返回新 access_token 并写入 store，失败清空 token 并返回 null */
async function doRefresh(): Promise<string | null> {
  const { refreshToken, setToken, clearTokensAndUnauth } = useAuthStore.getState()
  if (!refreshToken) return null
  const result = await request<RefreshResponse>('POST', '/auth/refresh', null, {
    refresh_token: refreshToken,
  })
  if (result.ok && result.data?.access_token) {
    setToken(result.data.access_token)
    return result.data.access_token
  }
  clearTokensAndUnauth()
  return null
}

/**
 * 带 401 自动 refresh 的请求：先带当前 token 请求；若 401 且有 refresh_token 则刷新后重试一次（加锁防并发）
 */
export async function requestWithRefresh<T>(
  method: string,
  path: string,
  body?: object,
): Promise<ApiResult<T>> {
  const token = useAuthStore.getState().token
  const result = await request<T>(method, path, token, body)

  if (result.ok || result.status !== 401) return result

  const refreshToken = useAuthStore.getState().refreshToken
  if (!refreshToken) return result

  // 加锁：并发 401 时只发起一次 refresh，其余等待
  if (!refreshLock) {
    refreshLock = doRefresh().finally(() => {
      refreshLock = null
    })
  }
  const newToken = await refreshLock
  if (!newToken) return result

  return request<T>(method, path, newToken, body)
}

/** GET /me 返回格式：{ ok: true, username: string }；401 时自动尝试 refresh 后重试一次 */
export interface MeResponse {
  ok: boolean
  username: string
}

export async function getMe(): Promise<ApiResult<MeResponse>> {
  return requestWithRefresh<MeResponse>('GET', '/me')
}

/**
 * GET /auth/status：获取当前用户状态（只读）。使用 access_token，不做 fallback/mock。
 * 失败时只记录日志，返回 null，不登出、不弹窗。
 */
export async function getUserStatus(): Promise<UserStatus | null> {
  const result = await requestWithRefresh<UserStatus>('GET', '/auth/status')
  if (result.ok && result.data) {
    return result.data
  }
  if (!result.ok) {
    console.warn('[apiClient] getUserStatus failed:', result.status, result.error)
  }
  return null
}

/** 后端 POST /auth/trial/start 返回 */
export interface TrialStartResponse {
  success: boolean
  start_ts?: number
  end_ts?: number
}

/** 后端 GET /auth/trial/status 返回 */
export interface TrialStatusResponse {
  has_trial: boolean
  active: boolean
  start_ts?: number
  end_ts?: number
}

/**
 * POST /auth/trial/start：开启 7 天试用。必须带 Authorization: Bearer <token>，Body 必须包含 { username }。
 * 从当前登录状态读取 username，不允许空 body。
 */
export async function startTrial(): Promise<ApiResult<TrialStartResponse>> {
  const username = useAuthStore.getState().user?.username
  if (!username) {
    return {
      ok: false,
      status: 0,
      error: { message: '未获取到当前用户名，请重新登录' },
    }
  }
  const result = await requestWithRefresh<TrialStartResponse>('POST', '/auth/trial/start', {
    username,
  })
  if (!result.ok) {
    console.warn('[apiClient] startTrial failed:', result.status, result.error)
  }
  return result
}

/**
 * GET /auth/trial/status?username=xxx：查询当前用户试用状态。必须带 Authorization。
 * 返回 { has_trial, active, start_ts, end_ts }。
 */
export async function getTrialStatus(username: string): Promise<ApiResult<TrialStatusResponse>> {
  const path = `/auth/trial/status?username=${encodeURIComponent(username)}`
  return requestWithRefresh<TrialStatusResponse>('GET', path)
}
