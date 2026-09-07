import { io } from 'socket.io-client'
import { BASE_URL, getAccessToken, runRefresh } from '../api/apiClient.js'

function buildSocket(namespace) {
  const token = getAccessToken()
  const socket = io(`${BASE_URL}${namespace}`, {
    auth: { token, Authorization: token ? `Bearer ${token}` : '' },
    extraHeaders: token ? { Authorization: `Bearer ${token}` } : {},
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  })

  // Automatically refresh token and retry if rejected with Unauthorized
  socket.on('connect_error', async (err) => {
    const msg = (err?.message || '').toLowerCase()
    if (msg.includes('unauthorized') || msg.includes('jwt') || msg.includes('token') || msg.includes('forbidden')) {
      console.warn(`[Socket ${namespace}] Auth failed (${err.message}), attempting token refresh…`)
      try {
        const newToken = await runRefresh()
        if (newToken) {
          socket.auth = { token: newToken, Authorization: `Bearer ${newToken}` }
          if (socket.io?.opts?.extraHeaders) {
            socket.io.opts.extraHeaders.Authorization = `Bearer ${newToken}`
          }
          socket.connect()
        }
      } catch (refreshErr) {
        console.error(`[Socket ${namespace}] Token refresh failed:`, refreshErr)
      }
    }
  })

  return socket
}

/**
 * Creates and returns a Socket.IO connection for the /chat namespace.
 */
export function createChatSocket() {
  return buildSocket('/chat')
}

/**
 * Creates and returns a Socket.IO connection for the /video namespace.
 */
export function createVideoSocket() {
  return buildSocket('/video')
}

