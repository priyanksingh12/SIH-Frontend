import { apiGet, apiPost, apiPatch } from './apiClient.js'

/**
 * GET /patients/:id/profile
 */
export async function getPatientProfile(patientId) {
  const data = await apiGet(`/patients/${patientId}/profile`)
  return data.user || null
}

/**
 * PATCH /patients/:id/profile
 */
export async function updatePatientProfile(patientId, updates) {
  return apiPatch(`/patients/${patientId}/profile`, updates)
}

/**
 * POST /patients/:id/onboarding-records — combined vitals + history + profile intake.
 */
export async function saveOnboardingRecords(patientId, { vitals, medical_history, profile }) {
  return apiPost(`/patients/${patientId}/onboarding-records`, {
    vitals,
    medical_history,
    profile,
  })
}

/**
 * GET /patients/:id/vitals — newest first.
 * Response includes: bp, sugar, sugar_type, spo2, hr, temperature, risk_level,
 *                    flagged_metrics, recommendation
 */
export async function getVitals(patientId) {
  const data = await apiGet(`/patients/${patientId}/vitals`)
  return data.vitals || []
}

/**
 * POST /patients/:id/vitals — log a new vitals entry.
 * Risk level auto-calculated on backend.
 */
export async function saveVitals(patientId, {
  bp,
  sugar,
  sugar_type,
  spo2,
  hr,
  weight,
  height,
  temperature,
  notes,
}) {
  return apiPost(`/patients/${patientId}/vitals`, {
    bp,
    sugar,
    spo2,
    hr,
    ...(sugar_type ? { sugar_type } : {}),
    ...(weight !== undefined ? { weight } : {}),
    ...(height !== undefined ? { height } : {}),
    ...(temperature !== undefined ? { temperature } : {}),
    ...(notes ? { notes } : {}),
  })
}

/**
 * GET /patients/:id/medical-history
 * Response: { conditions[], surgeries[], had_typhoid, had_malaria, doctor_notes, date }
 */
export async function getMedicalHistory(patientId) {
  const data = await apiGet(`/patients/${patientId}/medical-history`)
  return data.medical_history || []
}

/**
 * POST /patients/:id/medical-history
 */
export async function addMedicalHistory(patientId, {
  conditions,
  surgeries,
  had_typhoid,
  had_malaria,
  doctor_notes,
}) {
  return apiPost(`/patients/${patientId}/medical-history`, {
    conditions,
    surgeries,
    had_typhoid,
    had_malaria,
    doctor_notes,
  })
}

/**
 * GET /patients/:id/reports
 * Response: { id, pdf_url, generated_at }
 */
export async function getReports(patientId) {
  const data = await apiGet(`/patients/${patientId}/reports`)
  return data.reports || []
}
