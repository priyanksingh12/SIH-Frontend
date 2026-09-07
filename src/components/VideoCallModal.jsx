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
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(9, 18, 15, 0.94)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.92 }}
        style={{
          width: '100%',
          maxWidth: '1040px',
          height: '740px',
          maxHeight: '92vh',
          background: '#152520',
          borderRadius: '28px',
          boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top Floating Bar */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 24,
            right: 24,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(21, 37, 32, 0.65)',
            backdropFilter: 'blur(10px)',
            padding: '12px 20px',
            borderRadius: '999px',
            border: '1px solid rgba(255,255,255,0.12)',
            color: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: callStatus === 'connected' ? '#00ff88' : '#fbbf24',
                boxShadow:
                  callStatus === 'connected'
                    ? '0 0 12px #00ff88'
                    : '0 0 12px #fbbf24',
              }}
            />
            <strong style={{ fontSize: '1.05rem', color: '#fff' }}>{otherName}</strong>
            <span style={{ fontSize: '0.82rem', color: '#a7f3d0', opacity: 0.85 }}>
              • {isDoctor ? 'Patient' : 'Attending Clinician'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            {callStatus === 'connected' ? (
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  color: '#00ff88',
                  background: 'rgba(0,255,136,0.15)',
                  padding: '4px 12px',
                  borderRadius: '999px',
                }}
              >
                {formatDuration(callDuration)}
              </span>
            ) : (
              <span style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
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
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                color: '#fff',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Video Stage / Remote Feed */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            background: '#0d1815',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {/* Remote video element */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: callStatus === 'connected' ? 'block' : 'none',
            }}
          />

          {/* Placeholder when not connected or remote video not yet broadcasting */}
          {callStatus !== 'connected' && (
            <div style={{ textAlign: 'center', color: '#fff', padding: '24px' }}>
              <div
                style={{
                  width: '96px',
                  height: '96px',
                  borderRadius: '50%',
                  background: 'rgba(0, 255, 136, 0.12)',
                  border: '2px solid #00ff88',
                  color: '#00ff88',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 20px',
                  fontSize: '2.5rem',
                }}
              >
                <User size={48} />
              </div>
              <h2 style={{ fontSize: '1.6rem', margin: '0 0 8px', color: '#fff' }}>{otherName}</h2>
              <p style={{ color: '#94a3b8', fontSize: '1rem', margin: 0 }}>
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
          <div
            style={{
              position: 'absolute',
              bottom: 100,
              right: 24,
              width: '200px',
              height: '140px',
              borderRadius: '16px',
              overflow: 'hidden',
              background: '#000',
              border: '2px solid rgba(255,255,255,0.2)',
              boxShadow: '0 12px 30px rgba(0,0,0,0.5)',
              zIndex: 20,
            }}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: 'scaleX(-1)', // mirror selfie
                display: isVideoMuted ? 'none' : 'block',
              }}
            />
            {isVideoMuted && (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: '#1b342e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#a7f3d0',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                }}
              >
                Camera Off
              </div>
            )}
            <div
              style={{
                position: 'absolute',
                bottom: 6,
                left: 8,
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                fontSize: '0.7rem',
                padding: '2px 6px',
                borderRadius: '4px',
              }}
            >
              You
            </div>
          </div>

          {/* Incoming Call Prompt Modal (Doctor side) */}
          {isIncomingCall && !hasAccepted && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(15, 29, 25, 0.92)',
                zIndex: 30,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '24px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '50%',
                  background: '#29574b',
                  color: '#00ff88',
                  display: 'grid',
                  placeItems: 'center',
                  marginBottom: '20px',
                  boxShadow: '0 0 30px rgba(0,255,136,0.3)',
                }}
              >
                <PhoneCall size={38} />
              </div>
              <h3 style={{ fontSize: '1.7rem', margin: '0 0 8px', color: '#fff' }}>
                Incoming Video Consultation
              </h3>
              <p style={{ color: '#cbd5e1', fontSize: '1.1rem', margin: '0 0 28px' }}>
                <strong>{otherName}</strong> is requesting to start the video consultation session.
              </p>
              <div style={{ display: 'flex', gap: '16px' }}>
                <button
                  onClick={handleDeclineCall}
                  style={{
                    padding: '14px 28px',
                    borderRadius: '999px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    color: '#f87171',
                    border: '1px solid #ef4444',
                    fontSize: '1rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Decline
                </button>
                <button
                  onClick={handleAcceptCall}
                  style={{
                    padding: '14px 34px',
                    borderRadius: '999px',
                    background: '#00ff88',
                    color: '#171d1b',
                    border: 'none',
                    fontSize: '1.05rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(0,255,136,0.35)',
                  }}
                >
                  ✓ Accept Video Call
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Floating Control Bar */}
        <div
          style={{
            padding: '20px',
            background: '#13211c',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '20px',
            zIndex: 10,
          }}
        >
          {/* Mute Mic */}
          <button
            onClick={toggleAudio}
            title={isAudioMuted ? 'Unmute' : 'Mute'}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: isAudioMuted ? '#ef4444' : 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: 'none',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isAudioMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>

          {/* Toggle Video */}
          <button
            onClick={toggleVideo}
            title={isVideoMuted ? 'Start Camera' : 'Stop Camera'}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: isVideoMuted ? '#ef4444' : 'rgba(255,255,255,0.12)',
              color: '#fff',
              border: 'none',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isVideoMuted ? <VideoOff size={22} /> : <VideoIcon size={22} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            title="End Consultation"
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '50%',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)',
              transition: 'all 0.2s',
            }}
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </motion.div>
    </div>
  )
}
