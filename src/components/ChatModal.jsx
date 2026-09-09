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
      <div className="fixed inset-0 z-[9999] bg-[#0f1d19]/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full sm:max-w-lg md:max-w-[540px] h-[85vh] sm:h-[620px] max-h-[92vh] bg-white rounded-t-[28px] sm:rounded-3xl shadow-2xl border border-[#dcece5] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 bg-[#29574b] text-white flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-10 sm:w-11 h-10 sm:h-11 rounded-xl bg-[#00ff88] text-[#171d1b] grid place-items-center font-extrabold text-lg shrink-0">
                <MessageSquare size={22} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="m-0 text-base sm:text-lg font-bold text-white truncate max-w-[180px] sm:max-w-xs">
                    {otherName}
                  </h3>
                  <span className="bg-[#00ff88]/20 text-[#00ff88] text-xs font-bold px-2 py-0.5 rounded-full border border-[#00ff88]/40 shrink-0">
                    {otherRole}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-[#d1fae5] mt-0.5 flex-wrap">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isConnected ? 'bg-[#00ff88]' : 'bg-[#fbbf24]'
                    }`}
                  />
                  <span>{isConnected ? 'Real-time Connected' : 'Connecting…'}</span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck size={13} /> Encrypted Session
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/12 hover:bg-white/20 border-0 text-white grid place-items-center cursor-pointer transition-colors shrink-0"
              title="Close chat"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body / Messages */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 bg-[#f8faf9] flex flex-col gap-3">
            {!isApproved ? (
              <div className="p-6 text-center bg-[#fef3c7] rounded-2xl border border-[#fde68a] text-[#92400e] my-auto">
                <Clock size={32} className="mx-auto mb-2 block" />
                <strong className="block text-base font-bold mb-1.5">
                  Awaiting Doctor Approval
                </strong>
                <p className="m-0 text-sm leading-relaxed">
                  Consultation chat will be automatically unlocked as soon as the doctor confirms and
                  approves this appointment.
                </p>
              </div>
            ) : loadingHistory ? (
              <div className="my-auto text-center text-[#59756e] text-sm sm:text-base font-medium">
                Loading conversation…
              </div>
            ) : messages.length === 0 ? (
              <div className="my-auto text-center text-[#717975] py-8 px-4 max-w-xs mx-auto">
                <div className="w-14 h-14 rounded-full bg-[#eaf3ee] text-[#29574b] grid place-items-center mx-auto mb-3">
                  <UserCheck size={26} />
                </div>
                <strong className="block text-base font-bold text-[#171d1b] mb-1">
                  Consultation Room Ready
                </strong>
                <p className="text-sm m-0 leading-normal">
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
                    className={`flex flex-col ${isMine ? 'items-end' : 'items-start'} w-full`}
                  >
                    <span className="text-xs text-[#717975] font-semibold mb-1 px-1">
                      {senderLabel} {formattedTime ? `• ${formattedTime}` : ''}
                    </span>
                    <div
                      className={`max-w-[85%] sm:max-w-[80%] px-4 py-3 text-sm sm:text-base leading-relaxed break-words ${
                        isMine
                          ? 'rounded-[18px_18px_4px_18px] bg-[#29574b] text-white shadow-sm'
                          : 'rounded-[18px_18px_18px_4px] bg-white text-[#171d1b] shadow-sm border border-[#e2eae5]'
                      }`}
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
              className="px-4 sm:px-5 py-3.5 sm:py-4 bg-white border-t border-[#e5ebe8] flex items-center gap-2.5 sm:gap-3 shrink-0"
            >
              <input
                type="text"
                placeholder={`Message ${otherName}…`}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                className="flex-1 px-4 py-2.5 sm:py-3 rounded-full border border-[#d5ded9] focus:border-[#29574b] focus:ring-2 focus:ring-[#29574b]/10 bg-[#f9fbfa] text-sm sm:text-base text-[#171d1b] outline-none transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className={`w-10 sm:w-11 h-10 sm:h-11 rounded-full grid place-items-center border-0 transition-all shrink-0 ${
                  inputText.trim()
                    ? 'bg-[#29574b] text-[#00ff88] cursor-pointer shadow-md'
                    : 'bg-[#e2eae5] text-[#a0aea8] cursor-not-allowed'
                }`}
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
