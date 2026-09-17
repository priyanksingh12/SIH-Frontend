/**
 * Schemes API Service for SwasthyaSahay.
 * Connects directly to the live backend API gateway (https://sih-otuc.onrender.com).
 * No external APIs or mock data used.
 */

import { BASE_URL } from './apiClient.js'

/**
 * Fetch all health schemes with search, state filter, and pagination.
 */
export async function getSchemes({ page = 1, limit, q = '', state = '', category = 'health' } = {}) {
  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (page) params.set('page', page.toString())

  const isStateSelected = state && state.trim() && state !== 'All States' && state !== 'All'
  if (isStateSelected) {
    params.set('state', state.trim())
    // When a state is selected, fetch all schemes available in that state without limiting
    params.set('limit', (limit || 500).toString())
  } else if (limit) {
    params.set('limit', limit.toString())
  }

  if (q && q.trim()) params.set('q', q.trim())

  const res = await fetch(`${BASE_URL}/api/schemes?${params.toString()}`)
  if (!res.ok) {
    throw new Error(`Failed to load schemes: ${res.statusText}`)
  }
  return res.json()
}

/**
 * Fetch full scheme details by slug.
 */
export async function getSchemeBySlug(slug) {
  if (!slug) throw new Error('Scheme slug is required')
  const res = await fetch(`${BASE_URL}/api/schemes/${encodeURIComponent(slug)}`)
  if (!res.ok) {
    throw new Error(`Failed to load scheme details: ${res.statusText}`)
  }
  return res.json()
}

/**
 * Fetch smart scheme recommendations based on user health criteria.
 */
export async function getSchemeRecommendations({ state = '', need = '', age = '', gender = '', income = '', category = 'health' } = {}) {
  // Can use GET query or POST JSON body
  const body = {
    category: category || 'health',
  }
  if (state && state !== 'All States' && state !== 'All') body.state = state
  if (need) body.need = need
  if (age) body.age = age.toString()
  if (gender) body.gender = gender
  if (income) body.income = income

  const res = await fetch(`${BASE_URL}/api/schemes/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    // Fallback to GET recommend if POST isn't supported on some router configs
    const params = new URLSearchParams()
    if (body.state) params.set('state', body.state)
    if (body.need) params.set('need', body.need)
    if (body.age) params.set('age', body.age)
    if (body.gender) params.set('gender', body.gender)

    const fallbackRes = await fetch(`${BASE_URL}/api/schemes/recommend?${params.toString()}`)
    if (!fallbackRes.ok) {
      throw new Error(`Failed to get recommendations: ${fallbackRes.statusText}`)
    }
    return fallbackRes.json()
  }

  return res.json()
}

/**
 * Fetch scheme count statistics by level (Central vs State).
 */
export async function getSchemeLevelStats() {
  const res = await fetch(`${BASE_URL}/api/schemes/stats/levels`)
  if (!res.ok) return null
  return res.json()
}
