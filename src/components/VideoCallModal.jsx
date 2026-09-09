import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  PhoneOff,
  PhoneCall,
  X,
  ShieldCheck,
  Maximize2,
  Minimize2,
  AlertTriangle,
  User,
} from 'lucide-react'
import { createVideoSocket } from '../services/socketService.js'
import { getVideoToken } from '../api/appointmentApi.js'

const DEFAULT_ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
]

export default function VideoCallModal({
  appointment,
  currentUser,
  isInitiator = false,
  autoAccept = false,
  initialOffer = null,
  onClose,
}) {
  const [callStatus, setCallStatus] = useState(autoAccept ? 'connected' : 'initializing') // initializing, ringing, connected, ended, error
  const [errorMessage, setErrorMessage] = useState('')
  const [isAudioMuted, setIsAudioMuted] = useState(false)
  const [isVideoMuted, setIsVideoMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [isIncomingCall, setIsIncomingCall] = useState(!isInitiator && !autoAccept)
  const [hasAccepted, setHasAccepted] = useState(isInitiator || autoAccept)

  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const localStreamRef = useRef(null)
  const peerConnectionRef = useRef(null)
  const socketRef = useRef(null)
  const iceCandidatesQueueRef = useRef([])
  const timerRef = useRef(null)

  const appointmentId = appointment?.id
  const isDoctor = currentUser?.role === 'doctor'
  const otherName = isDoctor
    ? appointment?.patient?.name || 'Patient'
    : appointment?.doctor?.user?.name
      ? `Dr. ${appointment.doctor.user.name}`
      : appointment?.doctor?.name
        ? `Dr. ${appointment.doctor.name}`
        : 'Attending Doctor'

  // Timer for connected call duration
  useEffect(() => {
    if (callStatus === 'connected') {
      timerRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [callStatus])

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // Cleanup helper
  const cleanUpCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    if (socketRef.current) {
      try {
        socketRef.current.disconnect()
      } catch (e) {}
      socketRef.current = null
    }
  }

  // Initialize Media & Socket
  useEffect(() => {
    if (!appointmentId) return
    let isCancelled = false

    async function startSetup() {
      try {
        setCallStatus(isInitiator ? 'ringing' : autoAccept ? 'connecting' : 'waiting')

        // 1. Connect socket and setup WebRTC IMMEDIATELY with fast default STUN servers (zero network delay)
        const socket = createVideoSocket()
        socketRef.current = socket

        const pc = new RTCPeerConnection({ iceServers: DEFAULT_ICE_SERVERS })
        peerConnectionRef.current = pc

        // 2. Fetch backend video-token asynchronously in background (non-blocking)
        getVideoToken(appointmentId)
          .then((tokenRes) => {
            if (!isCancelled && pc.signalingState !== 'closed' && tokenRes?.ice_servers?.length) {
              try {
                pc.setConfiguration({ iceServers: tokenRes.ice_servers })
              } catch (e) {}
            }
          })
          .catch((err) => {
            console.warn('[Video] Using default STUN servers:', err.message)
          })

        // Handle remote stream tracks
        pc.ontrack = (event) => {
          if (remoteVideoRef.current && event.streams && event.streams[0]) {
            remoteVideoRef.current.srcObject = event.streams[0]
            setCallStatus('connected')
          }
        }

        // Handle ICE candidates — emit to server
        pc.onicecandidate = (event) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit('ice-candidate', {
              appointment_id: appointmentId,
              candidate: event.candidate,
            })
          }
        }

        // Helper: join the room
        const joinRoom = () => {
          if (!isCancelled && socket.connected) {
            socket.emit('join', { appointment_id: appointmentId })
          }
        }

        let mediaStreamReady = false
        const sendOffer = async () => {
          if (!isInitiator || isCancelled || pc.signalingState === 'closed') return
          try {
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true })
            if (pc.signalingState === 'closed' || isCancelled) return
            await pc.setLocalDescription(offer)
            socket.emit('offer', {
              appointment_id: appointmentId,
              sdp: offer,
            })
            console.log('[Video] Sent SDP offer to peer')
          } catch (offerErr) {
            console.warn('[Video] Offer creation error:', offerErr)
          }
        }

        // Socket Event Listeners — register BEFORE connecting
        socket.on('connect', () => {
          console.log('[Video] Socket connected, joining room:', appointmentId)
          joinRoom()
          // If media already acquired before socket connected, send offer now
          if (isInitiator && mediaStreamReady) {
            sendOffer()
          }
        })

        socket.on('joined', (data) => {
          console.log('[Video] Joined video room:', data)
          if (isInitiator && mediaStreamReady) {
            sendOffer()
          }
        })

        // peer-joined payload: { user_id, role }
        // When peer joins, ensure offer is ready and delivered
        socket.on('peer-joined', async (data) => {
          console.log('[Video] Peer joined:', data)
          if (isInitiator && pc.signalingState !== 'closed') {
            sendOffer()
          }
        })

        // offer payload from server: { sdp, from_user_id, from_role }
        socket.on('offer', async (data) => {
          console.log('[Video] Received offer from peer, hasAccepted:', hasAccepted, 'autoAccept:', autoAccept)
          if (hasAccepted || autoAccept) {
            await handleApplyOffer(data.sdp)
          } else {
            window.__pendingOffer = data.sdp
            setIsIncomingCall(true)
          }
        })

        // answer payload from server: { sdp, from_user_id, from_role }
        socket.on('answer', async (data) => {
          console.log('[Video] Received SDP answer')
          if (pc.signalingState === 'have-local-offer') {
            try {
              await pc.setRemoteDescription(new RTCSessionDescription(data.sdp))
              setCallStatus('connected')
              while (iceCandidatesQueueRef.current.length > 0) {
                const candidate = iceCandidatesQueueRef.current.shift()
                try {
                  await pc.addIceCandidate(new RTCIceCandidate(candidate))
                } catch (e) {
                  console.warn('[Video] Error adding queued ICE candidate:', e)
                }
              }
            } catch (err) {
              console.warn('[Video] Error setting remote description from answer:', err)
            }
          }
        })

        // ice-candidate payload: { candidate, from_user_id }
        socket.on('ice-candidate', async (data) => {
          const cand = data?.candidate
          if (!cand) return
          if (pc.remoteDescription && pc.remoteDescription.type) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(cand))
            } catch (e) {
              console.warn('[Video] Error adding ICE candidate:', e)
            }
          } else {
            iceCandidatesQueueRef.current.push(cand)
          }
        })

        // call-ended: { ended_by_user_id, ended_by_role, reason }
        socket.on('call-ended', () => {
          console.log('[Video] Call ended by remote peer')
          setCallStatus('ended')
          setTimeout(() => {
            cleanUpCall()
            onClose()
          }, 1800)
        })

        socket.on('error', (err) => {
          console.warn('[Video] Socket error:', err)
        })

        // If already connected when we set up, join immediately
        if (socket.connected) {
          joinRoom()
        }

        // 3. Acquire media in parallel immediately
        if (isInitiator || autoAccept) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            if (isCancelled) {
              stream.getTracks().forEach((t) => t.stop())
              return
            }
            localStreamRef.current = stream
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = stream
            }
            stream.getTracks().forEach((track) => pc.addTrack(track, stream))
            mediaStreamReady = true
            console.log('[Video] Local media acquired')

            // If initiator: send initial offer immediately
            if (isInitiator) {
              await sendOffer()

              // Retry offer once after 1.2s if still in ringing state to ensure delivery
              setTimeout(() => {
                if (!isCancelled && pc.signalingState === 'have-local-offer' && socket.connected) {
                  console.log('[Video] Re-transmitting offer to ensure delivery')
                  if (pc.localDescription) {
                    socket.emit('offer', {
                      appointment_id: appointmentId,
                      sdp: pc.localDescription,
                    })
                  }
                }
              }, 1200)
            }

            // autoAccept: doctor answering an incoming call
            if (autoAccept && initialOffer) {
              try {
                await pc.setRemoteDescription(new RTCSessionDescription(initialOffer))
                const answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                if (socket.connected) {
                  joinRoom()
                }
                socket.emit('answer', {
                  appointment_id: appointmentId,
                  sdp: answer,
                })
                console.log('[Video] Sent SDP answer (autoAccept)')
                while (iceCandidatesQueueRef.current.length > 0) {
                  const candidate = iceCandidatesQueueRef.current.shift()
                  try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch (e) {}
                }
                setCallStatus('connected')
              } catch (sdpErr) {
                console.warn('[Video] SDP answer error:', sdpErr)
                setCallStatus('error')
                setErrorMessage('Failed to establish video connection. Please try again.')
              }
            }
          } catch (mediaErr) {
            console.warn('[Video] Camera/mic access error:', mediaErr)
            if (!isCancelled) {
              setCallStatus('error')
              setErrorMessage('Unable to access camera and microphone. Please check browser permissions.')
            }
            return
          }
        }
      } catch (err) {
        if (!isCancelled) {
          setCallStatus('error')
          setErrorMessage(err.message || 'Error initializing video session.')
        }
      }
    }

    startSetup()

    return () => {
      isCancelled = true
      cleanUpCall()
    }
  }, [appointmentId, isInitiator, autoAccept])


  // Callee accepts incoming call
  const handleAcceptCall = async () => {
    setHasAccepted(true)
    setIsIncomingCall(false)
    setCallStatus('connected')

    const pc = peerConnectionRef.current
    if (!pc) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      localStreamRef.current = stream
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      stream.getTracks().forEach((track) => pc.addTrack(track, stream))

      // Apply pending offer if received
      const offer = window.__pendingOffer
      if (offer) {
        await handleApplyOffer(offer)
      }
    } catch (err) {
      setCallStatus('error')
      setErrorMessage('Could not access your camera/mic to accept the call.')
    }
  }

  const handleApplyOffer = async (offerSdp) => {
    const pc = peerConnectionRef.current
    const socket = socketRef.current
    if (!pc || !socket) return

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offerSdp))
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('answer', {
        appointment_id: appointmentId,
        sdp: answer,
      })
      setCallStatus('connected')

      // Drain any queued ICE candidates
      while (iceCandidatesQueueRef.current.length > 0) {
        const candidate = iceCandidatesQueueRef.current.shift()
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch (e) {}
      }
    } catch (err) {
      console.error('Error answering offer:', err)
    }
  }

  // Callee declines incoming call
  const handleDeclineCall = () => {
    if (socketRef.current) {
      socketRef.current.emit('end-call', { appointment_id: appointmentId })
    }
    cleanUpCall()
    onClose()
  }

  // End call
  const handleEndCall = () => {
    if (socketRef.current) {
      socketRef.current.emit('end-call', { appointment_id: appointmentId })
    }
    setCallStatus('ended')
    setTimeout(() => {
      cleanUpCall()
      onClose()
    }, 1000)
  }

  // Toggle Audio
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled
        setIsAudioMuted(!audioTrack.enabled)
      }
    }
  }

  // Toggle Video
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled
        setIsVideoMuted(!videoTrack.enabled)
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-[#09120f]/95 backdrop-blur-xl flex items-center justify-center p-0 sm:p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        className="w-full sm:max-w-4xl lg:max-w-[1040px] h-full sm:h-[88vh] md:h-[740px] max-h-screen sm:max-h-[94vh] bg-[#152520] sm:rounded-[28px] shadow-2xl border-0 sm:border border-white/10 flex flex-col relative overflow-hidden"
      >
        {/* Top Floating Bar */}
        <div className="absolute top-3 sm:top-5 left-3 sm:left-6 right-3 sm:right-6 z-10 flex items-center justify-between bg-[#152520]/80 backdrop-blur-md px-3.5 sm:px-5 py-2 sm:py-3 rounded-full border border-white/12 text-white shadow-lg">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <span
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                callStatus === 'connected'
                  ? 'bg-[#00ff88] shadow-[0_0_12px_#00ff88]'
                  : 'bg-[#fbbf24] shadow-[0_0_12px_#fbbf24]'
              }`}
            />
            <strong className="text-sm sm:text-base font-bold text-white truncate max-w-[130px] sm:max-w-xs">
              {otherName}
            </strong>
            <span className="text-xs text-[#a7f3d0]/85 hidden sm:inline">
              • {isDoctor ? 'Patient' : 'Attending Clinician'}
            </span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3.5 shrink-0">
            {callStatus === 'connected' ? (
              <span className="font-mono text-xs sm:text-sm font-bold text-[#00ff88] bg-[#00ff88]/15 px-2.5 sm:px-3 py-1 rounded-full">
                {formatDuration(callDuration)}
              </span>
            ) : (
              <span className="text-xs text-slate-300 hidden sm:inline">
                {callStatus === 'ringing'
                  ? 'Calling… Waiting for partner to accept'
                  : callStatus === 'waiting'
                    ? 'Connecting to secure room…'
                    : callStatus === 'ended'
                      ? 'Call Ended'
                      : ''}
              </span>
            )}
            <button
              onClick={handleEndCall}
              className="w-7 sm:w-8 h-7 sm:h-8 rounded-full bg-white/15 hover:bg-white/25 border-0 text-white grid place-items-center cursor-pointer transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Video Stage / Remote Feed */}
        <div className="flex-1 relative bg-[#0d1815] flex items-center justify-center overflow-hidden">
          {/* Remote video element */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`w-full h-full object-cover ${callStatus === 'connected' ? 'block' : 'hidden'}`}
          />

          {/* Placeholder when not connected or remote video not yet broadcasting */}
          {callStatus !== 'connected' && (
            <div className="text-center text-white p-6">
              <div className="w-20 sm:w-24 h-20 sm:h-24 rounded-full bg-[#00ff88]/12 border-2 border-[#00ff88] text-[#00ff88] grid place-items-center mx-auto mb-4 sm:mb-5">
                <User size={40} className="sm:w-12 sm:h-12" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold m-0 mb-2 text-white">{otherName}</h2>
              <p className="text-slate-400 text-sm sm:text-base m-0 max-w-sm mx-auto leading-relaxed">
                {callStatus === 'ringing'
                  ? 'Calling clinician… Please wait for them to accept.'
                  : callStatus === 'waiting'
                    ? 'Preparing encrypted WebRTC teleconsultation…'
                    : callStatus === 'ended'
                      ? 'The call has ended.'
                      : callStatus === 'error'
                        ? errorMessage
                        : 'Connecting…'}
              </p>
            </div>
          )}

          {/* Floating Local Picture-in-Picture Video */}
          <div className="absolute bottom-20 sm:bottom-24 right-3 sm:right-6 w-28 sm:w-44 md:w-52 h-20 sm:h-32 md:h-36 rounded-xl sm:rounded-2xl overflow-hidden bg-black border-2 border-white/20 shadow-2xl z-20">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover -scale-x-100 ${isVideoMuted ? 'hidden' : 'block'}`}
            />
            {isVideoMuted && (
              <div className="w-full h-full bg-[#1b342e] flex items-center justify-center text-[#a7f3d0] text-xs sm:text-sm font-semibold">
                Camera Off
              </div>
            )}
            <div className="absolute bottom-1.5 left-2 bg-black/60 text-white text-[10px] sm:text-xs px-1.5 py-0.5 rounded">
              You
            </div>
          </div>

          {/* Incoming Call Prompt Modal (Doctor side) */}
          {isIncomingCall && !hasAccepted && (
            <div className="absolute inset-0 bg-[#0f1d19]/95 z-30 flex flex-col items-center justify-center p-6 text-center">
              <div className="w-16 sm:w-20 h-16 sm:h-20 rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center mb-4 sm:mb-5 shadow-[0_0_30px_rgba(0,255,136,0.3)]">
                <PhoneCall size={36} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold m-0 mb-2 text-white">
                Incoming Video Consultation
              </h3>
              <p className="text-slate-300 text-sm sm:text-lg m-0 mb-6 sm:mb-7 max-w-md leading-relaxed">
                <strong>{otherName}</strong> is requesting to start the video consultation session.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full max-w-xs sm:max-w-md">
                <button
                  onClick={handleDeclineCall}
                  className="w-full sm:flex-1 py-3 sm:py-3.5 px-6 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500 text-sm sm:text-base font-bold cursor-pointer transition-colors"
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptCall}
                  className="w-full sm:flex-[1.4] py-3 sm:py-3.5 px-6 rounded-full bg-[#00ff88] hover:bg-[#00e67a] text-[#171d1b] border-0 text-sm sm:text-base font-extrabold cursor-pointer shadow-lg shadow-[#00ff88]/35 transition-all"
                >
                  ✓ Accept Video Call
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Floating Control Bar */}
        <div className="p-3.5 sm:p-5 bg-[#13211c] border-t border-white/10 flex items-center justify-center gap-4 sm:gap-6 z-10 shrink-0">
          {/* Mute Mic */}
          <button
            onClick={toggleAudio}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
            className={`w-12 sm:w-14 h-12 sm:h-14 rounded-full grid place-items-center border-0 cursor-pointer transition-all ${
              isAudioMuted
                ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                : 'bg-white/12 hover:bg-white/20 text-white'
            }`}
          >
            {isAudioMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Toggle Video */}
          <button
            onClick={toggleVideo}
            title={isVideoMuted ? 'Start Camera' : 'Stop Camera'}
            className={`w-12 sm:w-14 h-12 sm:h-14 rounded-full grid place-items-center border-0 cursor-pointer transition-all ${
              isVideoMuted
                ? 'bg-red-500 text-white shadow-md shadow-red-500/30'
                : 'bg-white/12 hover:bg-white/20 text-white'
            }`}
          >
            {isVideoMuted ? <VideoOff size={22} /> : <VideoIcon size={22} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            title="End Consultation"
            className="w-13 sm:w-16 h-13 sm:h-16 rounded-full bg-red-500 hover:bg-red-600 text-white border-0 grid place-items-center cursor-pointer shadow-lg shadow-red-500/40 transition-all"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}