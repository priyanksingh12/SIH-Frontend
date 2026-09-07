import { useState, useEffect, useRef } from 'react'
import { createVideoSocket } from '../services/socketService.js'
import { getStoredUser } from '../api/apiClient.js'

/**
 * Hook to listen for incoming WebRTC video calls on approved appointments.
 *
 * Backend API (per docs):
 *   peer-joined: { user_id, role }                    — NO appointment_id
 *   offer:       { sdp, from_user_id, from_role }     — NO appointment_id
 *   call-ended:  { ended_by_user_id, ended_by_role, reason }
 *   join:        { appointment_id }                   — we emit this
 *
 * Since there's no appointment_id in incoming events, we track the
 * "active room" from which room we joined, using a ref map.
 */
export function useCallListener(appointments, isCallActive = false) {
  const [incomingCall, setIncomingCall] = useState(null)
  const socketRef = useRef(null)

  const user = getStoredUser()
  const isDoctor = user?.role === 'doctor'

  const approvedAppts = (appointments || []).filter((a) => a.status === 'approved')

  useEffect(() => {
    // If no approved appointments, or user is already in an active video call, don't run background listener
    if (approvedAppts.length === 0 || isCallActive) {
      if (socketRef.current) {
        try {
          socketRef.current.disconnect()
        } catch (e) {}
        socketRef.current = null
      }
      return
    }

    const socket = createVideoSocket()
    socketRef.current = socket

    const joinRooms = () => {
      console.log(`[CallListener] Joining ${approvedAppts.length} approved video rooms`)
      approvedAppts.forEach((appt) => {
        socket.emit('join', { appointment_id: appt.id })
      })
    }

    if (socket.connected) {
      joinRooms()
    }
    socket.on('connect', joinRooms)
    socket.on('reconnect', joinRooms)

    const findMatchingAppt = (data) => {
      if (!data) return approvedAppts[0] || null

      // 1. By explicit appointment_id
      if (data.appointment_id) {
        const found = approvedAppts.find((a) => a.id === data.appointment_id)
        if (found) return found
      }

      // 2. By peer user_id / from_user_id
      const peerId = data.user_id || data.from_user_id
      if (peerId) {
        const found = approvedAppts.find((a) => {
          if (isDoctor) {
            return a.patient_id === peerId || a.patient?.id === peerId
          } else {
            return (
              a.doctor_id === peerId ||
              a.doctor?.id === peerId ||
              a.doctor?.user?.id === peerId ||
              a.doctor?.user_id === peerId
            )
          }
        })
        if (found) return found
      }

      // 3. Fallback to first approved appointment
      return approvedAppts[0] || null
    }

    // peer-joined: { user_id, role }
    socket.on('peer-joined', (data) => {
      if (!data) return
      console.log('[CallListener] Received peer-joined:', data)
      if (isDoctor && data.role === 'doctor') return
      if (!isDoctor && data.role === 'patient') return

      const matchedAppt = findMatchingAppt(data)
      if (!matchedAppt) return

      const { callerName, callerRole } = getCallerInfo(matchedAppt, isDoctor)
      setIncomingCall((prev) => {
        if (prev) return prev
        return { appointment: matchedAppt, sdp: null, callerName, callerRole }
      })
    })

    // offer: { sdp, from_user_id, from_role }
    socket.on('offer', (data) => {
      if (!data) return
      console.log('[CallListener] Received offer from peer:', data)

      const matchedAppt = findMatchingAppt(data)
      if (!matchedAppt) return

      const { callerName, callerRole } = getCallerInfo(matchedAppt, isDoctor)
      setIncomingCall({
        appointment: matchedAppt,
        sdp: data.sdp,
        callerName,
        callerRole,
      })
    })

    // call-ended: { ended_by_user_id, ended_by_role, reason }
    socket.on('call-ended', () => {
      console.log('[CallListener] Received call-ended')
      setIncomingCall(null)
    })

    socket.on('error', (err) => {
      console.warn('[CallListener] Socket error:', err)
    })

    return () => {
      try {
        socket.off('connect', joinRooms)
        socket.off('reconnect', joinRooms)
        socket.off('peer-joined')
        socket.off('offer')
        socket.off('call-ended')
        socket.off('error')
        socket.disconnect()
      } catch (e) {}
      socketRef.current = null
    }
  }, [JSON.stringify(approvedAppts.map((a) => a.id)), isCallActive])

  const declineIncomingCall = () => {
    if (incomingCall?.appointment && socketRef.current) {
      try {
        socketRef.current.emit('end-call', {
          appointment_id: incomingCall.appointment.id,
        })
      } catch (e) {}
    }
    setIncomingCall(null)
  }

  return { incomingCall, setIncomingCall, declineIncomingCall }
}

function getCallerInfo(appt, isDoctor) {
  if (isDoctor) {
    return {
      callerName: appt.patient?.name || 'Patient',
      callerRole: 'Patient',
    }
  }
  const docName =
    appt.doctor?.user?.name
      ? `Dr. ${appt.doctor.user.name}`
      : appt.doctor?.name
        ? `Dr. ${appt.doctor.name}`
        : 'Attending Doctor'
  return { callerName: docName, callerRole: 'Doctor' }
}

// Backward-compatible alias
export const useDoctorCallListener = useCallListener
