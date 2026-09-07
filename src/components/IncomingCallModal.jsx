import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PhoneCall, PhoneOff, Video, User } from 'lucide-react'

export default function IncomingCallModal({ incomingCall, onAccept, onDecline }) {
  if (!incomingCall) return null

  const { appointment, callerName, callerRole } = incomingCall

  // Play a repeating chime while ringing
  useEffect(() => {
    let intervalId
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext
      if (AudioCtx) {
        const playChime = () => {
          try {
            const ctx = new AudioCtx()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.type = 'sine'
            osc.frequency.setValueAtTime(523.25, ctx.currentTime) // C5
            osc.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.25) // E5
            gain.gain.setValueAtTime(0.12, ctx.currentTime)
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6)
            osc.connect(gain)
            gain.connect(ctx.destination)
            osc.start()
            osc.stop(ctx.currentTime + 0.6)
          } catch (e) {}
        }
        playChime()
        intervalId = setInterval(playChime, 2400)
      }
    } catch (e) {}

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  return (
    <AnimatePresence>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999999,
          background: 'rgba(9, 18, 15, 0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -20 }}
          style={{
            width: '100%',
            maxWidth: '460px',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.35)',
            border: '2px solid #a7f3d0',
            overflow: 'hidden',
            textAlign: 'center',
            padding: '36px 28px',
            position: 'relative',
          }}
        >
          {/* Pulsing Call Avatar */}
          <div style={{ position: 'relative', width: '90px', height: '90px', margin: '0 auto 20px' }}>
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                inset: -8,
                borderRadius: '50%',
                background: '#00ff88',
                zIndex: 1,
              }}
            />
            <div
              style={{
                position: 'relative',
                zIndex: 2,
                width: '100%',
                height: '100%',
                borderRadius: '50%',
                background: '#29574b',
                color: '#00ff88',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 8px 24px rgba(41,87,75,0.35)',
              }}
            >
              <PhoneCall size={40} />
            </div>
          </div>

          <span
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: '999px',
              background: '#d1fae5',
              color: '#065f46',
              fontSize: '0.85rem',
              fontWeight: 800,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
              marginBottom: '10px',
            }}
          >
            Incoming Video Consultation
          </span>

          <h3
            style={{
              margin: '0 0 6px',
              fontSize: '1.6rem',
              color: '#171d1b',
              fontWeight: 800,
            }}
          >
            {callerName || 'Patient'}
          </h3>

          <p
            style={{
              margin: '0 0 24px',
              fontSize: '0.95rem',
              color: '#59756e',
              lineHeight: 1.45,
            }}
          >
            {callerRole || 'Patient'} is requesting to start the video consultation session now.
            {appointment?.slot && (
              <span style={{ display: 'block', marginTop: '6px', fontSize: '0.85rem', color: '#29574b', fontWeight: 600 }}>
                🗓 Scheduled for {new Date(appointment.slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '14px', justifyContent: 'center' }}>
            <button
              onClick={onDecline}
              style={{
                flex: 1,
                padding: '14px 20px',
                borderRadius: '999px',
                background: '#fee2e2',
                color: '#991b1b',
                border: '1px solid #fecaca',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s',
              }}
            >
              <PhoneOff size={18} /> Decline
            </button>

            <button
              onClick={onAccept}
              style={{
                flex: 1.4,
                padding: '14px 24px',
                borderRadius: '999px',
                background: '#29574b',
                color: '#00ff88',
                border: 'none',
                fontSize: '1.05rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 8px 24px rgba(41,87,75,0.3)',
                transition: 'all 0.2s',
              }}
            >
              <Video size={18} /> Accept Call
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
