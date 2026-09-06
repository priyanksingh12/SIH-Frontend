/**
 * Central API client for MediMate backend.
 * Handles base URL, auth headers, and silent token refresh on 401.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://sih-otuc.onrender.com'

// ─── Token helpers ───────────────────────────────────────────────────────────

export function getAccessToken() {
  return localStorage.getItem('medimate-access-token')
}

export function getRefreshToken() {
  return localStorage.getItem('medimate-refresh-token')
}

export function setTokens(accessToken, refreshToken) {
  localStorage.setItem('medimate-access-token', accessToken)
  if (refreshToken) localStorage.setItem('medimate-refresh-token', refreshToken)
}

export function clearTokens() {
  localStorage.removeItem('medimate-access-token')
  localStorage.removeItem('medimate-refresh-token')
  localStorage.removeItem('medimate-user')
  localStorage.removeItem('medimate-signup-complete')
  localStorage.removeItem('medimate-vitals-complete')
  localStorage.removeItem('medimate-doctor-info-complete')
  localStorage.removeItem('medimate-account-created')
  localStorage.removeItem('medimate-auth-mode')
}

/** Full logout: clears all app state and returns to landing. */
export function logout() {
  clearTokens()
  localStorage.removeItem('medimate-account-role')
  localStorage.removeItem('medimate-account-name')
  localStorage.removeItem('medimate-account-email')
  localStorage.removeItem('medimate-doctor-medical-id')
  localStorage.removeItem('medimate-doctor-facility')
  sessionStorage.clear()
  window.location.reload()
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('medimate-user') || 'null')
  } catch {
    return null
  }
}

export function storeUser(user) {
  localStorage.setItem('medimate-user', JSON.stringify(user))
}

// ─── Silent refresh ───────────────────────────────────────────────────────────

let isRefreshing = false
let refreshQueue = []

async function runRefresh() {
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
