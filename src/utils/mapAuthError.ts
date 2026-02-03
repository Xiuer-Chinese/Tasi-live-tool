/**
 * 将登录/注册接口的原始错误映射为对用户友好的中文提示，不暴露状态码、英文原文、请求 URL。
 * 用于 UI 展示；原始信息仅用于开发环境「更多信息」或日志。
 */
export type AuthErrorInput =
  | {
      status?: number
      detail?: string
      requestUrl?: string
      error?: string
      responseDetail?: string
    }
  | Error

/** 对象形式的鉴权错误入参，与 AuthErrorInput 的对象分支一致 */
type AuthErrorObject = Exclude<AuthErrorInput, Error>

export interface MapAuthErrorResult {
  /** 面向用户的简短中文提示，UI 直接展示 */
  userMessage: string
  /** 原始错误摘要，仅开发环境折叠展示或日志，可含 status/detail/url */
  rawForDev: string
}

function isNetworkError(raw: AuthErrorInput): boolean {
  if (raw instanceof Error) {
    const msg = raw.message?.toLowerCase() ?? ''
    return (
      msg.includes('network') ||
      msg.includes('timeout') ||
      msg.includes('fetch') ||
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('err_connection')
    )
  }
  const r = raw as AuthErrorObject
  if (typeof r.status === 'number' && r.status === 0) return true
  const err = String(r.error ?? r.detail ?? r.responseDetail ?? '').toLowerCase()
  return /network|timeout|fetch|failed|unreachable|refused/.test(err)
}

/**
 * 映射鉴权错误为用户文案 + 调试用原始信息。
 * 优先级：网络/超时 => 401 => 403 禁用 => 5xx => 其它。
 */
export function mapAuthError(raw: AuthErrorInput): MapAuthErrorResult {
  if (isNetworkError(raw)) {
    const rawForDev = raw instanceof Error ? raw.message : JSON.stringify(raw)
    return { userMessage: '网络异常，请检查网络后重试', rawForDev }
  }

  const status = raw instanceof Error ? undefined : (raw as { status?: number }).status
  const detail =
    raw instanceof Error
      ? raw.message
      : ((raw as { detail?: string }).detail ??
        (raw as { responseDetail?: string }).responseDetail ??
        (raw as { error?: string }).error ??
        '')
  const requestUrl = raw instanceof Error ? undefined : (raw as { requestUrl?: string }).requestUrl
  const detailStr = String(detail)

  if (status === 401) {
    const rawForDev = requestUrl ? `401 ${detailStr} (${requestUrl})` : `401 ${detailStr}`
    return { userMessage: '账号或密码错误，请重试', rawForDev }
  }

  if (status === 403 && /disabled|禁用|account_disabled/.test(detailStr)) {
    const rawForDev = requestUrl ? `403 ${detailStr} (${requestUrl})` : `403 ${detailStr}`
    return { userMessage: '该账号已被禁用，请联系管理员', rawForDev }
  }

  if (typeof status === 'number' && status >= 500) {
    const rawForDev = requestUrl
      ? `${status} ${detailStr} (${requestUrl})`
      : `${status} ${detailStr}`
    const userMessage =
      status === 502 || status === 503 ? '服务暂时不可用，请稍后再试' : '服务器开小差了，请稍后再试'
    return { userMessage, rawForDev }
  }

  const rawForDev =
    requestUrl && status !== undefined
      ? `${status} ${detailStr} (${requestUrl})`
      : status !== undefined
        ? `${status} ${detailStr}`
        : detailStr || 'unknown'
  return { userMessage: '登录失败，请稍后重试', rawForDev }
}
