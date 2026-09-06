import { apiGet } from './apiClient.js'

/**
 * GET /facilities — list all facilities with doctor/appointment counts.
 */
export async function getFacilities() {
  const data = await apiGet('/facilities')
  return data.facilities || []
}

/**
 * GET /facilities/:id — detailed profile with verified doctors.
 */
export async function getFacility(id) {
  const data = await apiGet(`/facilities/${id}`)
  return data.facility || null
}

/**
 * GET /facilities/:id/stats — real-time dashboard stats.
 */
export async function getFacilityStats(id) {
  const data = await apiGet(`/facilities/${id}/stats`)
  return data.stats || null
}

/**
 * GET /facilities/:id/queue — live appointment queue (pending + approved).
 */
export async function getFacilityQueue(id) {
  const data = await apiGet(`/facilities/${id}/queue`)
  return data.queue || []
}

/**
 * GET /facilities/:id/analytics — timeseries data + wait times.
 * Query: ?range=7d or ?range=30d
 */
export async function getFacilityAnalytics(id, range = '7d') {
  const data = await apiGet(`/facilities/${id}/analytics?range=${range}`)
  return data.analytics || null
}

/**
 * GET /facilities/:id/high-risk — high-risk patients in facility.
 */
export async function getFacilityHighRisk(id) {
  const data = await apiGet(`/facilities/${id}/high-risk`)
  return data.high_risk_patients || []
}
