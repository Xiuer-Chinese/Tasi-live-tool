/**
 * 登录相关 localStorage / 持久化 Key，集中管理便于修改与文档一致。
 * 参见 docs/LOGIN_FIRST_RUN_AND_CLEAR_DATA.md
 */

/** 是否记住登录状态："true" | "false" */
export const AUTH_REMEMBER_ME_KEY = 'auth.rememberMe'

/** 上次成功登录且勾选“记住”时的账号（手机/邮箱），仅当 AUTH_REMEMBER_ME_KEY === 'true' 时有效 */
export const AUTH_LAST_IDENTIFIER_KEY = 'auth.lastIdentifier'

/** 禁止用于预填的测试/占位账号，读取到则清除并视为空（不预填） */
export const BLOCKED_TEST_IDENTIFIERS: ReadonlySet<string> = new Set(['19999999999'])

/**
 * 读取上次登录账号用于预填；若为测试账号则从 storage 清除并返回空字符串。
 */
export function getSanitizedLastIdentifier(): string {
  if (typeof localStorage === 'undefined') return ''
  const raw = localStorage.getItem(AUTH_LAST_IDENTIFIER_KEY) || ''
  const trimmed = raw.trim()
  if (!trimmed || BLOCKED_TEST_IDENTIFIERS.has(trimmed)) {
    if (trimmed) localStorage.removeItem(AUTH_LAST_IDENTIFIER_KEY)
    return ''
  }
  return trimmed
}

/** Zustand persist 存储 key（token、refreshToken、user、isAuthenticated） */
export const AUTH_ZUSTAND_PERSIST_KEY = 'auth-storage'
