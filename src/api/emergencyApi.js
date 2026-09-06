import { apiGet, apiPost } from './apiClient.js'

/**
 * POST /emergency/sos — immediate SOS distress call.
 * Uses lat/lng (not latitude/longitude) per updated API.
 */
export async function triggerSOS({ lat, lng, reason, facility_id, session_id }) {
  return apiPost('/emergency/sos', {
    lat,
    lng,
    ...(reason ? { reason } : {}),
    ...(facility_id ? { facility_id } : {}),
    ...(session_id ? { session_id } : {}),
  })
}

/**
 * GET /emergency/alerts — active emergency alerts for responders.
 */
export async function getAlerts() {
  const data = await apiGet('/emergency/alerts')
  return data.alerts || []
}
