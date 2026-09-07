import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, X, MessageSquare, ShieldCheck, UserCheck, Clock } from 'lucide-react'
import { createChatSocket } from '../services/socketService.js'
import { getChatHistory } from '../api/chatApi.js'

export default function ChatModal({ appointment, currentUser, onClose }) {
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const messagesEndRef = useRef(null)
  const socketRef = useRef(null)

  const appointmentId = appointment?.id
  const isApproved = appointment?.status === 'approved'

  // Determine other participant's info
  const isDoctor = currentUser?.role === 'doctor'
  const otherName = isDoctor
    ? appointment?.patient?.name || 'Patient'
    : appointment?.doctor?.user?.name
      ? `Dr. ${appointment.doctor.user.name}`
      : appointment?.doctor?.name
        ? `Dr. ${appointment.doctor.name}`
        : 'Attending Doctor'

  const otherRole = isDoctor ? 'Patient' : 'Doctor'

  // Scroll to bottom when messages update
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Setup Chat Socket and Load History
  useEffect(() => {
    if (!appointmentId || !isApproved) {
      setLoadingHistory(false)
      return
    }

    let isMounted = true

    // 1. Fetch REST history
    getChatHistory(appointmentId).then((history) => {
      if (isMounted && Array.isArray(history)) {
        setMessages((prev) => {
          const seen = new Set()
          const merged = []
          for (const m of [...history, ...prev]) {
            if (!m) continue
            const key = m.id || `${m.sender_id}_${m.text || m.message || m.content}_${m.created_at}`
            if (!seen.has(key)) {
              seen.add(key)
              merged.push(m)
            }
          }
          return merged
        })
      }
      if (isMounted) setLoadingHistory(false)
    })

    // 2. Connect to Socket.IO /chat namespace
    const socket = createChatSocket()
    socketRef.current = socket

    const handleConnect = () => {
      if (!isMounted) return
      setIsConnected(true)
      console.log('[Chat] Socket connected, joining room:', appointmentId)
      socket.emit('join', { appointment_id: appointmentId })
    }

    if (socket.connected) {
      handleConnect()
    }
    socket.on('connect', handleConnect)
    socket.on('reconnect', handleConnect)

    socket.on('disconnect', () => {
      if (isMounted) setIsConnected(false)
    })

    socket.on('message', (msg) => {
      if (!isMounted || !msg) return
      console.log('[Chat] Received message from socket:', msg)
      setMessages((prev) => {
        // If msg already exists by id, do nothing
        if (msg.id && prev.some((m) => m.id === msg.id)) {
          return prev
        }

        const incomingText = (msg.text || msg.message || msg.content || '').trim()

        // Check if this matches a local optimistic message
        const localIdx = prev.findIndex((m) => {
          if (!m.id?.startsWith?.('local_')) return false
          const mText = (m.text || m.message || m.content || '').trim()
          return mText === incomingText
        })

        if (localIdx !== -1) {
          // Replace optimistic message with official server record
          const next = [...prev]
          next[localIdx] = msg
          return next
        }

        return [...prev, msg]
      })
    })

    socket.on('joined', (data) => {
      console.log('[Chat] Joined chat room successfully:', data)
      if (isMounted) setIsConnected(true)
    })

    socket.on('error', (err) => {
      console.warn('[Chat] Socket error:', err)
    })

    return () => {
      isMounted = false
      if (socket) {
        try {
          socket.emit('leave', { appointment_id: appointmentId })
          socket.off('connect', handleConnect)
          socket.off('reconnect', handleConnect)
          socket.off('disconnect')
          socket.off('message')
          socket.off('joined')
          socket.off('error')
          socket.disconnect()
        } catch (e) {
          // Ignore clean disconnect error
        }
      }
    }
  }, [appointmentId, isApproved])

  const handleSendMessage = (e) => {
    e?.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || !socketRef.current) return

    const tempId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`
    const optimisticMsg = {
      id: tempId,
      appointment_id: appointmentId,
      sender_id: currentUser?.id,
      sender: {
        id: currentUser?.id,
        name: currentUser?.name || (currentUser?.role === 'doctor' ? 'Doctor' : 'Patient'),
        role: currentUser?.role,
      },
      text: trimmed,
      created_at: new Date().toISOString(),
    }

    // Immediately display locally
    setMessages((prev) => [...prev, optimisticMsg])

    // Emit over socket
    socketRef.current.emit('message', {
      appointment_id: appointmentId,
      text: trimmed,
    })
    setInputText('')
  }

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9999,
          background: 'rgba(15, 29, 25, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          style={{
            width: '100%',
            maxWidth: '540px',
            height: '620px',
            maxHeight: '90vh',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 25px 60px -15px rgba(23, 45, 38, 0.35)',
            border: '1px solid #dcece5',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '18px 24px',
              background: '#29574b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '14px',
                  background: '#00ff88',
                  color: '#171d1b',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem',
                }}
              >
                <MessageSquare size={22} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff' }}>
                    {otherName}
                  </h3>
                  <span
                    style={{
                      background: 'rgba(0, 255, 136, 0.2)',
                      color: '#00ff88',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: '1px solid rgba(0, 255, 136, 0.4)',
                    }}
                  >
                    {otherRole}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontSize: '0.8rem',
                    color: '#d1fae5',
                    marginTop: '3px',
                  }}
                >
                  <span
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      background: isConnected ? '#00ff88' : '#fbbf24',
                    }}
                  />
                  <span>{isConnected ? 'Real-time Connected' : 'Connecting…'}</span>
                  <span>•</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <ShieldCheck size={13} /> Encrypted Session
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                background: 'rgba(255,255,255,0.12)',
                border: 'none',
                color: '#ffffff',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              title="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body / Messages */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              background: '#f8faf9',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            {!isApproved ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  background: '#fef3c7',
                  borderRadius: '16px',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  margin: 'auto 0',
                }}
              >
                <Clock size={32} style={{ margin: '0 auto 8px', display: 'block' }} />
                <strong style={{ display: 'block', fontSize: '1.05rem', marginBottom: '6px' }}>
                  Awaiting Doctor Approval
                </strong>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.4 }}>
                  Consultation chat will be automatically unlocked as soon as the doctor confirms and
                  approves this appointment.
                </p>
              </div>
            ) : loadingHistory ? (
              <div style={{ margin: 'auto', textAlign: 'center', color: '#59756e', fontSize: '0.95rem' }}>
                Loading conversation…
              </div>
            ) : messages.length === 0 ? (
              <div
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  color: '#717975',
                  padding: '30px 20px',
                  maxWidth: '340px',
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: '#eaf3ee',
                    color: '#29574b',
                    display: 'grid',
                    placeItems: 'center',
                    margin: '0 auto 12px',
                  }}
                >
                  <UserCheck size={26} />
                </div>
                <strong style={{ display: 'block', fontSize: '1rem', color: '#171d1b', marginBottom: '4px' }}>
                  Consultation Room Ready
                </strong>
                <p style={{ fontSize: '0.88rem', margin: 0 }}>
                  Send a message below to start your direct consultation with {otherName}.
                </p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isMine =
                  msg.id?.startsWith?.('local_') ||
                  (msg.sender_id && currentUser?.id ? msg.sender_id === currentUser.id : false) ||
                  (!msg.sender_id && msg.sender?.role && currentUser?.role ? msg.sender.role === currentUser.role : false)

                const senderLabel = isMine ? 'You' : msg.sender?.name || otherName
                const formattedTime = msg.created_at
                  ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''

                return (
                  <div
                    key={msg.id || idx}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMine ? 'flex-end' : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.75rem',
                        color: '#717975',
                        fontWeight: 600,
                        marginBottom: '3px',
                        padding: '0 4px',
                      }}
                    >
                      {senderLabel} {formattedTime ? `• ${formattedTime}` : ''}
                    </span>
                    <div
                      style={{
                        maxWidth: '80%',
                        padding: '12px 16px',
                        borderRadius: isMine ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                        background: isMine ? '#29574b' : '#ffffff',
                        color: isMine ? '#ffffff' : '#171d1b',
                        boxShadow: isMine
                          ? '0 4px 12px rgba(41, 87, 75, 0.2)'
                          : '0 2px 8px rgba(0,0,0,0.06)',
                        border: isMine ? 'none' : '1px solid #e2eae5',
                        fontSize: '0.95rem',
                        lineHeight: 1.45,
                        wordBreak: 'break-word',
                      }}
                    >
                      {msg.text || msg.message || msg.content}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer / Input */}
          {isApproved && (
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: '16px 20px',
                background: '#ffffff',
                borderTop: '1px solid #e5ebe8',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}
            >
              <input
                type="text"
                placeholder={`Message ${otherName}…`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                style={{
                  flex: 1,
                  padding: '12px 18px',
                  borderRadius: '999px',
                  border: '1.5px solid #d5ded9',
                  outline: 'none',
                  fontSize: '0.95rem',
                  fontFamily: 'inherit',
                  background: '#f9fbfa',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#29574b')}
                onBlur={(e) => (e.target.style.borderColor = '#d5ded9')}
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: inputText.trim() ? '#29574b' : '#e2eae5',
                  color: inputText.trim() ? '#00ff88' : '#a0aea8',
                  border: 'none',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                <Send size={18} />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
