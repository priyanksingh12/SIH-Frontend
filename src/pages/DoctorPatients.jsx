import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getStoredUser, logout } from '../api/apiClient.js'
import { getAppointments, approveAppointment, rejectAppointment, completeAppointment } from '../api/appointmentApi.js'
import ChatModal from '../components/ChatModal.jsx'
import VideoCallModal from '../components/VideoCallModal.jsx'
import IncomingCallModal from '../components/IncomingCallModal.jsx'
import { useDoctorCallListener } from '../hooks/useDoctorCallListener.js'

const toneMap = ['sage', 'rose', 'blue', 'sand', 'mint', 'lilac']
const avatarColors = {
  sage: 'bg-[#dcece5] text-[#29574b]',
  rose: 'bg-[#f1e1e3] text-[#87565a]',
  blue: 'bg-[#dce9ed] text-[#3d6270]',
  sand: 'bg-[#f1e8d9] text-[#806346]',
  mint: 'bg-[#e0f2eb] text-[#206a4f]',
  lilac: 'bg-[#e7e3f0] text-[#655e7d]',
}

function getInitials(name) {
  if (!name) return 'DR'
  return name.replace(/^Dr\.\s*/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'DR'
}

function statusLabel(status) {
  if (status === 'pending') return 'New request'
  if (status === 'approved') return 'Scheduled'
  if (status === 'rejected') return 'Rejected'
  if (status === 'completed') return 'Completed'
  return status
}

const SIDEBAR_ITEMS = [
  { label: 'Dashboard', icon: '⌂', path: '/doctor-dashboard' },
  { label: 'Patients', icon: '♧', path: '/doctor-patients' },
  { label: 'Appointments', icon: '▣', path: '/doctor-dashboard' },
  { label: 'My Profile', icon: '◎', path: '/doctor-dashboard' },
]

function DoctorSidebar({ doctorName, facilityName }) {
  const navigate = useNavigate()
  return (
    <aside className="w-[260px] shrink-0 hidden md:flex flex-col p-6 bg-transparent border-r border-[rgba(41,87,75,0.12)] min-h-screen">
      <div className="flex items-center gap-3 pb-6">
        <span className="text-[1.2rem]">✚</span>
        <div><strong className="block">MediMate</strong><small className="text-xs">CLINICAL SUITE</small></div>
      </div>
      <div className="flex items-center gap-2 p-3 border border-[#e2eae5] rounded-2xl bg-white/50 backdrop-blur-sm">
        <div className="w-[46px] h-[46px] rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-bold text-[1.05rem] shrink-0">
          {getInitials(doctorName)}
        </div>
        <div><b className="block text-sm">{doctorName}</b><small className="text-xs text-[#59756e]">Attending Physician</small></div>
        <i />
      </div>
      <button className="my-5 p-3 w-full rounded-xl text-white bg-[#29574b] text-sm font-bold cursor-pointer border-0" onClick={() => navigate('/doctor-patients')}>+ New Consultation</button>
      <nav className="grid gap-1">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = item.label === 'Patients'
          return (
            <Link key={item.label} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold no-underline ${isActive ? 'text-white bg-[#29574b]' : 'text-[#404845]'}`}>
              <span className="w-[18px] text-center text-base">{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>
      <div className="relative mt-auto p-3 border border-[#dfe8e3] rounded-xl text-[#426f63] bg-[rgba(230,240,235,0.5)] text-sm flex flex-col">
        <small className="font-bold">CLINICAL OUTLET</small>
        <b>{facilityName}</b>
        <span className="absolute right-3 top-3">⚙</span>
      </div>
    </aside>
  )
}

export default function DoctorPatients() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const rawName = user?.name || 'Doctor'
  const doctorName = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`
  const facilityName = window.localStorage.getItem('medimate-doctor-facility') || 'Your Practice Facility'

  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [activeTab, setActiveTab] = useState('all')
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

  const pendingCount = appointments.filter((a) => a.status === 'pending').length
  const scheduledCount = appointments.filter((a) => a.status === 'approved').length

  const filtered = appointments.filter((appt) => {
    if (activeTab === 'pending' && appt.status !== 'pending') return false
    if (activeTab === 'approved' && appt.status !== 'approved') return false
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

  const openPatient = (patientId, patientName) => {
    window.sessionStorage.setItem('medimate-doctor-patient', patientName || patientId)
    navigate('/doctor-patient-profile')
  }

  return (
    <div className="min-h-screen flex bg-transparent text-[#171d1b]">
      <DoctorSidebar doctorName={doctorName} facilityName={facilityName} />
      <main className="flex-1 min-w-0 w-full">
        <header className="h-[68px] flex items-center justify-between px-4 md:px-8 border-b border-[rgba(41,87,75,0.12)] bg-transparent">
          <div className="flex flex-col">
            <span className="text-sm font-bold">▣ &nbsp; Secure Clinical Session</span>
            <small className="text-xs text-[#59756e]">Verified · State Medical Registry</small>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <Link to="/doctor-dashboard" className="hidden md:flex items-center gap-2 border-0 bg-[#eaf3ee] text-[#29574b] px-4 py-2 rounded-full font-bold text-[0.92rem] no-underline">
              👤 My Profile
            </Link>
            <div className="w-[38px] h-[38px] rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-bold text-[0.95rem] shrink-0">
              {getInitials(doctorName)}
            </div>
            <b className="hidden md:flex flex-col text-sm">{doctorName}<small className="font-normal text-xs text-[#59756e]">Attending Physician</small></b>
            <button onClick={logout} className="bg-[#c0392b] text-white border-0 py-1.5 px-3 md:py-[0.45rem] md:px-4 rounded-lg cursor-pointer font-bold text-xs md:text-[0.88rem] ml-1 md:ml-2">
              Logout
            </button>
          </div>
        </header>

        <div className="w-full max-w-[1060px] px-4 md:px-12 py-6 md:py-9 pb-16 mx-auto">
          <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 gap-4">
            <div>
              <span className="text-[#29574b] text-xs font-bold uppercase tracking-widest block mb-2">PATIENT INTAKE</span>
              <h1 className="text-4xl font-['Playfair_Display',serif] text-[#171d1b] font-bold m-0 leading-tight">Patients</h1>
              <p className="text-[#59756e] mt-2 text-base">Review appointment requests and continue care for patients connected to your practice.</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <strong className="text-4xl font-['Playfair_Display',serif] text-[#29574b]">{loading ? '…' : String(appointments.length).padStart(2, '0')}</strong>
              <span className="text-[#59756e] text-xs font-bold uppercase tracking-wider leading-tight">active patient<br />requests</span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white/70 p-2 md:p-1.5 rounded-full border border-[#e2eae5] mb-6">
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              <button className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap cursor-pointer border-0 ${activeTab === 'all' ? 'bg-[#29574b] text-white' : 'bg-transparent text-[#59756e]'}`} onClick={() => setActiveTab('all')}>
                All patients <b className="ml-1 opacity-80">{appointments.length}</b>
              </button>
              <button className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap cursor-pointer border-0 ${activeTab === 'pending' ? 'bg-[#29574b] text-white' : 'bg-transparent text-[#59756e]'}`} onClick={() => setActiveTab('pending')}>
                New requests <b className="ml-1 opacity-80">{pendingCount}</b>
              </button>
              <button className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap cursor-pointer border-0 ${activeTab === 'approved' ? 'bg-[#29574b] text-white' : 'bg-transparent text-[#59756e]'}`} onClick={() => setActiveTab('approved')}>
                Scheduled <b className="ml-1 opacity-80">{scheduledCount}</b>
              </button>
            </div>
            <label className="flex items-center gap-2 px-4 py-2 w-full md:w-auto md:min-w-[280px]">
              <span className="text-[#59756e] text-lg">⌕</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search patients, conditions, or area" className="w-full bg-transparent border-0 outline-none text-[#171d1b] text-sm" />
            </label>
          </div>

          <section className="flex flex-col gap-3">
            {loading ? (
              <p className="p-8 opacity-60 text-[1.1rem]">Loading patients…</p>
            ) : filtered.length === 0 ? (
              <p className="p-8 opacity-60 text-[1.1rem]">No patients found.</p>
            ) : (
              filtered.map((appt, index) => {
                const patientName = appt.patient?.name || 'Unknown Patient'
                const toneClass = avatarColors[toneMap[index % toneMap.length]]
                const isNew = appt.status === 'pending'
                const isApproved = appt.status === 'approved'
                return (
                  <div className="flex flex-col md:flex-row md:items-center gap-4 p-4 border border-[#e2eae5] rounded-2xl bg-white hover:shadow-md transition-all duration-200" key={appt.id}>
                    <button type="button" className="flex items-center gap-4 text-left border-0 bg-transparent flex-1 cursor-pointer" onClick={() => openPatient(appt.patient_id, patientName)}>
                      <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${toneClass}`}>{getInitials(patientName)}</span>
                      <span className="flex flex-col">
                        <strong className="text-base text-[#171d1b]">{patientName}</strong>
                        <small className="text-[#59756e]">{appt.patient?.phone ? `+91 ${appt.patient.phone}` : ''}</small>
                        <em className="text-[#404845] not-italic text-sm mt-0.5">{appt.reason || 'No reason specified'}</em>
                      </span>
                      <span className="flex flex-col items-end ml-auto pr-4 border-r border-[#e2eae5] md:w-[150px]">
                        <b className={`text-sm ${isNew ? 'text-[#e67e22]' : 'text-[#29574b]'}`}>{statusLabel(appt.status)}</b>
                        <small className="text-[#59756e] text-xs">Scheduled {(appt.slot || appt.scheduled_at) ? new Date(appt.slot || appt.scheduled_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : ''}</small>
                      </span>
                    </button>
                    <span className="flex flex-row md:flex-col gap-2 md:gap-1.5 md:ml-auto md:w-[120px] justify-end md:justify-center">
                      {isNew && (
                        <>
                          <button onClick={() => handleAction(appt.id, 'approve')} disabled={actionLoading === appt.id + 'approve'} className="px-3 py-1.5 bg-[#27ae60] text-white border-0 rounded-lg cursor-pointer text-sm font-bold flex-1 md:flex-none">
                            {actionLoading === appt.id + 'approve' ? '…' : '✓ Approve'}
                          </button>
                          <button onClick={() => handleAction(appt.id, 'reject')} disabled={actionLoading === appt.id + 'reject'} className="px-3 py-1.5 bg-[#e74c3c] text-white border-0 rounded-lg cursor-pointer text-sm font-bold flex-1 md:flex-none">
                            {actionLoading === appt.id + 'reject' ? '…' : '✕ Reject'}
                          </button>
                        </>
                      )}
                      {isApproved && (
                        <div className="flex flex-col gap-1.5 w-full">
                          <div className="flex gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveChatAppt(appt) }}
                              className="px-2.5 py-1.5 bg-[#eaf3ee] text-[#29574b] border-[1.5px] border-[#29574b] rounded-lg cursor-pointer text-xs font-bold flex-1"
                            >
                              💬 Chat
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setActiveVideoAppt({ ...appt, isInitiator: true, autoAccept: false }) }}
                              className="px-2.5 py-1.5 bg-[#29574b] text-[#00ff88] border-0 rounded-lg cursor-pointer text-xs font-extrabold flex-1"
                            >
                              📹 Video
                            </button>
                          </div>
                          <button
                            onClick={() => handleAction(appt.id, 'complete')}
                            disabled={actionLoading === appt.id + 'complete'}
                            className="px-2.5 py-1.5 bg-[#2c3e50] text-white border-0 rounded-lg cursor-pointer text-xs font-bold w-full"
                          >
                            {actionLoading === appt.id + 'complete' ? '…' : '● Complete'}
                          </button>
                        </div>
                      )}
                      {!isNew && !isApproved && <span className="text-[#8a9b95] text-xl font-bold ml-auto md:ml-0 md:text-center block">→</span>}
                    </span>
                  </div>
                )
              })
            )}
          </section>
          <p className="mt-6 text-sm text-[#59756e] font-semibold text-center italic">Select a patient to view their complete clinical profile, vitals, reports, and appointment history.</p>
        </div>
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
  )
}
