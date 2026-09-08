/**
 * Central API client for SwasthyaSahay backend.
 * Handles base URL, auth headers, and silent token refresh on 401.
 */

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sih-otuc.onrender.com'

// ─── Token helpers ───────────────────────────────────────────────────────────

export function getAccessToken() {
  return localStorage.getItem('SwasthyaSahay-access-token')
}

export function getRefreshToken() {
  return localStorage.getItem('SwasthyaSahay-refresh-token')
}

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem('SwasthyaSahay-access-token', accessToken)
  if (refreshToken) localStorage.setItem('SwasthyaSahay-refresh-token', refreshToken)
}

export function clearTokens() {
  localStorage.removeItem('SwasthyaSahay-access-token')
  localStorage.removeItem('SwasthyaSahay-refresh-token')
  localStorage.removeItem('SwasthyaSahay-user')
  localStorage.removeItem('SwasthyaSahay-signup-complete')
  localStorage.removeItem('SwasthyaSahay-vitals-complete')
  localStorage.removeItem('SwasthyaSahay-doctor-info-complete')
  localStorage.removeItem('SwasthyaSahay-account-created')
  localStorage.removeItem('SwasthyaSahay-auth-mode')
}

/** Full logout: clears all app state and redirects to landing page. */
export function logout() {
  clearTokens()
  localStorage.clear()
  sessionStorage.clear()
  window.location.href = '/'
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('SwasthyaSahay-user') || 'null')
  } catch {
    return null
  }
}

export function storeUser(user) {
  localStorage.setItem('SwasthyaSahay-user', JSON.stringify(user))
}

// ─── Silent refresh ───────────────────────────────────────────────────────────

let isRefreshing = false
let refreshQueue = []

export async function runRefresh() {
  const refreshToken = getRefreshToken()
  if (!refreshToken) throw new Error('No refresh token')

  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refreshToken }),
  })

  if (!res.ok) throw new Error('Refresh failed')
  const data = await res.json()
  setTokens(data.access_token)
  return data.access_token
}

// ─── Core request function ────────────────────────────────────────────────────

async function request(method, path, body, retry = true) {
  const token = getAccessToken()

  const headers = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const options = { method, headers }
  if (body !== undefined) options.body = JSON.stringify(body)

  const res = await fetch(`${BASE_URL}${path}`, options)

  // Silent token refresh on 401
  if (res.status === 401 && retry) {
    try {
      if (isRefreshing) {
        // Queue this request until refresh completes
        return new Promise((resolve, reject) => {
          refreshQueue.push({ resolve, reject })
        }).then(() => request(method, path, body, false))
      }

      isRefreshing = true
      await runRefresh()
      isRefreshing = false

      // Flush queue
      refreshQueue.forEach(({ resolve }) => resolve())
      refreshQueue = []

      // Retry original request
      return request(method, path, body, false)
    } catch {
      isRefreshing = false
      refreshQueue.forEach(({ reject }) => reject(new Error('Session expired')))
      refreshQueue = []
      clearTokens()
      window.location.reload()
      return
    }
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`)
  }

  return data
}

// ─── Exported helpers ─────────────────────────────────────────────────────────

export const apiGet = (path) => request('GET', path)
export const apiPost = (path, body) => request('POST', path, body)
export const apiPatch = (path, body) => request('PATCH', path, body)
export const apiDelete = (path) => request('DELETE', path)
