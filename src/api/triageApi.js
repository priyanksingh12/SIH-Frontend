import { apiGet, apiPost, apiPatch, apiDelete } from './apiClient.js'

/**
 * POST /triage/chat — send symptom message to AI triage agent.
 */
export async function triageChat({ message, language = 'en', session_id }) {
  return apiPost('/triage/chat', {
    message,
    language,
    ...(session_id ? { session_id } : {}),
  })
}

/**
 * POST /triage/report — generate clinical PDF from triage session.
 */
export async function triageReport(session_id) {
  return apiPost('/triage/report', { session_id })
}

/**
 * GET /triage/sessions — list past triage conversations (sorted by most recent).
 */
export async function getTriageSessions() {
  const data = await apiGet('/triage/sessions')
  return data.sessions || []
}

/**
 * GET /triage/sessions/:id — full chat history of a session.
 */
export async function getTriageSession(sessionId) {
  return apiGet(`/triage/sessions/${sessionId}`)
}

/**
 * POST /triage/sessions/new — create a blank new session immediately.
 */
export async function createNewTriageSession() {
  return apiPost('/triage/sessions/new', {})
}

/**
 * PATCH /triage/sessions/:id — rename a session title.
 */
export async function renameTriageSession(sessionId, title) {
  return apiPatch(`/triage/sessions/${sessionId}`, { title })
}

/**
 * DELETE /triage/sessions/:id — delete a session and its reports.
 */
export async function deleteTriageSession(sessionId) {
  return apiDelete(`/triage/sessions/${sessionId}`)
}

