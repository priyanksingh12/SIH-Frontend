import { apiGet, apiPost, apiPatch } from './apiClient.js'

/**
 * GET /doctors — list verified doctors. Public.
 * Response: doctor.user.name, doctor.facility.name (nested)
 */
export async function getDoctors(filters = {}) {
  const params = new URLSearchParams()
  if (filters.facility_id) params.set('facility_id', filters.facility_id)
  if (filters.specialization) params.set('specialization', filters.specialization)
  if (filters.available !== undefined) params.set('available', String(filters.available))
  const qs = params.toString()
  const data = await apiGet(`/doctors${qs ? `?${qs}` : ''}`)
  return data.doctors || []
}

/**
 * POST /doctors/register — doctor onboarding after signup.
 */
export async function registerDoctor({
  specialization,
  facility_id,
  qualification = 'MBBS',
  experience_years = 0,
  bio = '',
  license_number,
}) {
  return apiPost('/doctors/register', {
    specialization,
    facility_id,
    license_number,
    qualification: qualification || 'MBBS',
    experience_years: Number(experience_years) || 0,
    bio: bio || '',
  })
}

/**
 * GET /doctors/profile/me — logged-in doctor's full profile.
 */
export async function getDoctorProfile() {
  return apiGet('/doctors/profile/me')
}

/**
 * PATCH /doctors/profile/me — update logged-in doctor's profile.
 */
export async function updateDoctorProfile(updates) {
  return apiPatch('/doctors/profile/me', updates)
}

/**
 * PATCH /doctors/:id/availability
 */
export async function toggleAvailability(doctorId, isAvailable) {
  return apiPatch(`/doctors/${doctorId}/availability`, { is_available: isAvailable })
}
