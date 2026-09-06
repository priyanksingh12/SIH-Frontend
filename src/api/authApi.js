import { apiPost, setTokens, storeUser } from './apiClient.js'

/**
 * POST /auth/signup
 */
export async function signup({ name, phone, password, role, email, preferred_language = 'en' }) {
  const data = await apiPost('/auth/signup', {
    name,
    phone,
    password,
    role,
    ...(email ? { email } : {}),
    preferred_language,
  })
  setTokens(data.access_token, data.refresh_token)
  storeUser(data.user)
  return data
}

/**
 * POST /auth/login — accepts phone OR email with password.
 */
export async function login({ phone, email, password }) {
  const data = await apiPost('/auth/login', {
    ...(phone ? { phone } : {}),
    ...(email ? { email } : {}),
    password,
  })
  setTokens(data.access_token, data.refresh_token)
  storeUser(data.user)
  return data
}

/**
 * POST /auth/refresh
 */
export async function refreshToken(refreshTokenValue) {
  return apiPost('/auth/refresh', { refresh_token: refreshTokenValue })
}

/**
 * POST /auth/google — Google One Tap / Identity Services login.
 */
export async function googleLogin({ id_token, role = 'patient', phone, preferred_language = 'en' }) {
  const data = await apiPost('/auth/google', {
    id_token,
    role,
    preferred_language,
    ...(phone ? { phone } : {}),
  })
  setTokens(data.access_token, data.refresh_token)
  storeUser(data.user)
  return data
}
