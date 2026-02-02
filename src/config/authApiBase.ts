/**
 * auth-api 基准地址（与后端约定唯一配置）
 * 所有登录/注册请求必须使用本常量拼接：POST ${API_BASE}/login、POST ${API_BASE}/register
 * 后端仅支持无 /auth 前缀：/login、/register
 */
export const AUTH_API_BASE = 'http://121.41.179.197:8000'
