import { apiGet, apiPatch, apiDelete } from './apiClient.js'

/**
 * GET /notifications — get notifications for the logged-in user.
 */
export async function getNotifications() {
  const data = await apiGet('/notifications')
  return data.notifications || []
}

/**
 * PATCH /notifications/:id/read — mark a notification as read.
 */
export async function markRead(id) {
  return apiPatch(`/notifications/${id}/read`)
}

/**
 * DELETE /notifications/:id — delete a notification.
 */
export async function deleteNotification(id) {
  return apiDelete(`/notifications/${id}`)
}
