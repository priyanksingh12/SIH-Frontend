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
      <div className="fixed inset-0 z-[999999] bg-[#09120f]/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.85, y: -20 }}
          className="w-full max-w-[460px] bg-white rounded-3xl shadow-[0_25px_60px_rgba(0,0,0,0.35)] border-2 border-[#a7f3d0] overflow-hidden text-center p-6 sm:p-9 relative"
        >
          {/* Pulsing Call Avatar */}
          <div className="relative w-20 sm:w-24 h-20 sm:h-24 mx-auto mb-5">
            <motion.div
              animate={{ scale: [1, 1.35, 1], opacity: [0.6, 0, 0.6] }}
              transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
              className="absolute -inset-2 rounded-full bg-[#00ff88] z-[1]"
            />
            <div className="relative z-[2] w-full h-full rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center shadow-lg shadow-[#29574b]/35">
              <PhoneCall size={36} />
            </div>
          </div>

          <span className="inline-block px-3.5 py-1 rounded-full bg-[#d1fae5] text-[#065f46] text-xs font-extrabold tracking-wide uppercase mb-2.5">
            Incoming Video Consultation
          </span>

          <h3 className="m-0 mb-1.5 text-2xl sm:text-3xl text-[#171d1b] font-extrabold truncate px-2">
            {callerName || 'Patient'}
          </h3>

          <p className="m-0 mb-6 text-sm sm:text-base text-[#59756e] leading-relaxed px-2">
            {callerRole || 'Patient'} is requesting to start the video consultation session now.
            {appointment?.slot && (
              <span className="block mt-1.5 text-xs sm:text-sm text-[#29574b] font-semibold">
                🗓 Scheduled for {new Date(appointment.slot).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-3.5 justify-center">
            <button
              onClick={onDecline}
              className="w-full sm:flex-1 py-3.5 px-5 rounded-full bg-[#fee2e2] hover:bg-[#fecaca] text-[#991b1b] border border-[#fecaca] text-sm sm:text-base font-bold cursor-pointer flex items-center justify-center gap-2 transition-all"
            >
              <PhoneOff size={18} /> Decline
            </button>

            <button
              onClick={onAccept}
              className="w-full sm:flex-[1.4] py-3.5 px-6 rounded-full bg-[#29574b] hover:bg-[#1e4037] text-[#00ff88] border-0 text-sm sm:text-base font-extrabold cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-[#29574b]/30 transition-all"
            >
              <Video size={18} /> Accept Call
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
