import { apiGet, apiPost, apiPatch } from './apiClient.js'

/**
 * POST /appointments — patient books appointment.
 * Uses `slot` (was `scheduled_at`), adds `share_records`.
 */
export async function bookAppointment({ doctor_id, slot, share_records = true }) {
  return apiPost('/appointments', { doctor_id, slot, share_records })
}

/**
 * GET /appointments — auto-scoped by role.
 * Response: appointment.slot (ISO), appointment.doctor.user.name (nested)
 */
export async function getAppointments() {
  const data = await apiGet('/appointments')
  return data.appointments || []
}

/**
 * GET /appointments/:id — full detail, optionally includes patient_records.
 */
export async function getAppointment(id) {
  return apiGet(`/appointments/${id}`)
}

/**
 * GET /appointments/:id/video-token — ICE servers for WebRTC call.
 */
export async function getVideoToken(id) {
  return apiGet(`/appointments/${id}/video-token`)
}

/**
 * PATCH /appointments/:id/approve
 */
export async function approveAppointment(id) {
  return apiPatch(`/appointments/${id}/approve`)
}

/**
 * PATCH /appointments/:id/reject
 */
export async function rejectAppointment(id) {
  return apiPatch(`/appointments/${id}/reject`)
}

/**
 * PATCH /appointments/:id/complete
 */
export async function completeAppointment(id) {
  return apiPatch(`/appointments/${id}/complete`)
}
