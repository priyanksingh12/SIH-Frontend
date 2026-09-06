import { apiGet, apiPost, apiPatch } from './apiClient.js'

/**
 * GET /referrals — auto-scoped by role.
 */
export async function getReferrals(filters = {}) {
  const params = new URLSearchParams()
  if (filters.patient_id) params.set('patient_id', filters.patient_id)
  if (filters.status) params.set('status', filters.status)
  const qs = params.toString()
  const data = await apiGet(`/referrals${qs ? `?${qs}` : ''}`)
  return data.referrals || []
}

/**
 * POST /referrals — create a referral.
 * Uses to_facility / from_facility per updated API.
 */
export async function createReferral({ patient_id, to_facility, from_facility, reason }) {
  return apiPost('/referrals', {
    patient_id,
    to_facility,
    reason,
    ...(from_facility ? { from_facility } : {}),
  })
}

/**
 * PATCH /referrals/:id/status
 * Values: "pending" | "accepted" | "rejected" | "completed"
 */
export async function updateReferralStatus(id, status) {
  return apiPatch(`/referrals/${id}/status`, { status })
}
