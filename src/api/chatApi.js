import { apiGet } from './apiClient.js'

/**
 * GET /chat/history/:appointment_id
 * Returns message history for an approved appointment.
 */
export async function getChatHistory(appointmentId) {
  try {
    const data = await apiGet(`/chat/history/${appointmentId}`)
    return data.messages || data.history || data || []
  } catch (error) {
    console.warn('Could not fetch chat history from REST endpoint:', error.message)
    return []
  }
}
