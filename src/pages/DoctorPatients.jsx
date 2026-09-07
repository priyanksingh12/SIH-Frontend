import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getStoredUser, logout } from '../api/apiClient.js'
import { getAppointments, approveAppointment, rejectAppointment, completeAppointment } from '../api/appointmentApi.js'
import ChatModal from '../components/ChatModal.jsx'
import VideoCallModal from '../components/VideoCallModal.jsx'
import IncomingCallModal from '../components/IncomingCallModal.jsx'
import { useDoctorCallListener } from '../hooks/useDoctorCallListener.js'

const toneMap = ['sage', 'rose', 'blue', 'sand', 'mint', 'lilac']

function getInitials(name) {
  if (!name) return '??'
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`
  return `${Math.floor(hours / 24)} day${Math.floor(hours / 24) > 1 ? 's' : ''} ago`
}

function statusLabel(status) {
  if (status === 'pending') return 'New request'
  if (status === 'approved') return 'Scheduled'
  if (status === 'rejected') return 'Rejected'
  if (status === 'completed') return 'Completed'
  return status
}

export default function DoctorPatients() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const doctorName = user?.name ? `Dr. ${user.name}` : 'Dr. Doctor'

  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [actionLoading, setActionLoading] = useState('')
  const [activeChatAppt, setActiveChatAppt] = useState(null)
  const [activeVideoAppt, setActiveVideoAppt] = useState(null)

  // Background incoming call listener for doctor
  const { incomingCall, setIncomingCall, declineIncomingCall } = useDoctorCallListener(appointments, !!activeVideoAppt)

  const handleAcceptIncomingCall = () => {
    if (incomingCall?.appointment) {
      const appt = incomingCall.appointment
      const sdp = incomingCall.sdp
      setIncomingCall(null)
      setActiveVideoAppt({
        ...appt,
        isInitiator: false,
        autoAccept: true,
        initialOffer: sdp,
      })
    }
  }

  useEffect(() => {
    getAppointments()
      .then(setAppointments)
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = appointments.filter((appt) => {
    const patientName = appt.patient?.name || ''
    const reason = appt.reason || ''
    return `${patientName} ${reason}`.toLowerCase().includes(query.toLowerCase())
  })

  const handleAction = async (id, action) => {
    setActionLoading(id + action)
    try {
      let updated
      if (action === 'approve') updated = await approveAppointment(id)
      else if (action === 'reject') updated = await rejectAppointment(id)
      else if (action === 'complete') updated = await completeAppointment(id)
      if (updated?.appointment) {
        setAppointments((prev) => prev.map((a) => a.id === id ? { ...a, status: updated.appointment.status } : a))
      }
    } catch (err) {
      console.error('Action failed:', err.message)
    } finally {
      setActionLoading('')
    }
  }

  const pendingCount = appointments.filter((a) => a.status === 'pending').length
  const scheduledCount = appointments.filter((a) => a.status === 'approved').length

  const openPatient = (patientId, patientName) => {
    window.sessionStorage.setItem('medimate-doctor-patient', patientName || patientId)
    navigate('/doctor-patient-profile')
  }

  return <div className="doctor-patients-page">
    <header className="doctor-patients-topbar">
      <Link className="brand" to="/">MediMate</Link>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span>▣ Secure Clinical Session</span>
        <Link to="/doctor-dashboard" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700, textDecoration: 'none', background: '#eaf3ee', color: '#29574b', padding: '7px 16px', borderRadius: '999px' }}>
          👤 My Profile
        </Link>
        <button onClick={logout} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>Logout</button>
      </div>
    </header>
    <main className="doctor-patients-main">
      <div className="doctor-patients-heading"><div><span className="doctors-kicker">PATIENT INTAKE</span><h1>Patients</h1><p>Review appointment requests and continue care for patients connected to your practice.</p></div><div className="patient-request-count"><strong>{loading ? '…' : String(appointments.length).padStart(2, '0')}</strong><span>active patient<br />requests</span></div></div>
      <div className="patient-request-toolbar"><div className="patient-tabs"><button className="active">All patients <b>{appointments.length}</b></button><button>New requests <b>{pendingCount}</b></button><button>Scheduled <b>{scheduledCount}</b></button></div><label>⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patients, conditions, or area" /></label></div>
      <section className="patient-request-list">
        {loading ? <p style={{ padding: '2rem', opacity: 0.6, fontSize: '1.1rem' }}>Loading patients…</p>
          : filtered.length === 0 ? <p style={{ padding: '2rem', opacity: 0.6, fontSize: '1.1rem' }}>No patients found.</p>
          : filtered.map((appt, index) => {
            const patientName = appt.patient?.name || 'Unknown Patient'
            const tone = toneMap[index % toneMap.length]
            const isNew = appt.status === 'pending'
            const isApproved = appt.status === 'approved'
            return <div className="patient-request-card" key={appt.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'default' }}>
              <button type="button" style={{ display: 'contents' }} onClick={() => openPatient(appt.patient_id, patientName)}>
                <span className={`patient-request-avatar ${tone}`}>{getInitials(patientName)}</span>
                <span className="patient-request-details"><strong>{patientName}</strong><small>{appt.patient?.phone ? `+91 ${appt.patient.phone}` : ''}</small><em>{appt.reason || 'No reason specified'}</em></span>
                <span className="patient-request-meta"><b className={isNew ? 'new' : ''}>{statusLabel(appt.status)}</b><small>Scheduled {(appt.slot || appt.scheduled_at) ? new Date(appt.slot || appt.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</small></span>
              </button>
              <span className="patient-request-arrow" style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginLeft: 'auto' }}>
                {isNew && <>
                  <button onClick={() => handleAction(appt.id, 'approve')} disabled={actionLoading === appt.id + 'approve'} style={{ padding: '0.4rem 0.8rem', background: '#27ae60', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>{actionLoading === appt.id + 'approve' ? '…' : '✓ Approve'}</button>
                  <button onClick={() => handleAction(appt.id, 'reject')} disabled={actionLoading === appt.id + 'reject'} style={{ padding: '0.4rem 0.8rem', background: '#e74c3c', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700 }}>{actionLoading === appt.id + 'reject' ? '…' : '✕ Reject'}</button>
                </>}
                {isApproved && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveChatAppt(appt) }}
                        style={{ padding: '0.35rem 0.65rem', background: '#eaf3ee', color: '#29574b', border: '1.5px solid #29574b', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
                      >
                        💬 Chat
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setActiveVideoAppt({ ...appt, isInitiator: true, autoAccept: false }) }}
                        style={{ padding: '0.35rem 0.65rem', background: '#29574b', color: '#00ff88', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 800 }}
                      >
                        📹 Video
                      </button>
                    </div>
                    <button
                      onClick={() => handleAction(appt.id, 'complete')}
                      disabled={actionLoading === appt.id + 'complete'}
                      style={{ padding: '0.35rem 0.65rem', background: '#2c3e50', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 700 }}
                    >
                      {actionLoading === appt.id + 'complete' ? '…' : '● Complete'}
                    </button>
                  </div>
                )}
                {!isNew && !isApproved && <span>→</span>}
              </span>
            </div>
          })}
      </section>
      <p className="patient-request-note">Select a patient to view their complete clinical profile, vitals, reports, and appointment history.</p>
    </main>

    {/* Incoming Call Ringing Alert Dialog */}
    {incomingCall && !activeVideoAppt && (
      <IncomingCallModal
        incomingCall={incomingCall}
        onAccept={handleAcceptIncomingCall}
        onDecline={declineIncomingCall}
      />
    )}

    {/* Real-time Consultation Chat Modal */}
    {activeChatAppt && (
      <ChatModal
        appointment={activeChatAppt}
        currentUser={user}
        onClose={() => setActiveChatAppt(null)}
      />
    )}

    {/* Real-time WebRTC Video Call Modal */}
    {activeVideoAppt && (
      <VideoCallModal
        appointment={activeVideoAppt}
        currentUser={user}
        isInitiator={activeVideoAppt.autoAccept ? false : true}
        autoAccept={!!activeVideoAppt.autoAccept}
        initialOffer={activeVideoAppt.initialOffer || null}
        onClose={() => {
          setActiveVideoAppt(null)
          setIncomingCall(null)
        }}
      />
    )}
  </div>
}
