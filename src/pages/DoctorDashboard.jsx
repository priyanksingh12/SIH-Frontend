import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getStoredUser, logout } from '../api/apiClient.js'
import { getDoctorProfile, toggleAvailability } from '../api/doctorApi.js'
import { getAppointments, approveAppointment, rejectAppointment, completeAppointment } from '../api/appointmentApi.js'
import ChatModal from '../components/ChatModal.jsx'
import VideoCallModal from '../components/VideoCallModal.jsx'
import IncomingCallModal from '../components/IncomingCallModal.jsx'
import { useDoctorCallListener } from '../hooks/useDoctorCallListener.js'

// Helpers
function getInitials(name) {
  return (name || '').replace(/^Dr\.\s*/i, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'DR'
}

function formatSlot(slot) {
  if (!slot) return 'TBD'
  const d = new Date(slot)
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function statusBadge(status) {
  const map = {
    pending: { label: 'Pending', bg: '#fef3c7', color: '#92400e' },
    approved: { label: 'Approved', bg: '#dcece5', color: '#29574b' },
    completed: { label: 'Completed', bg: '#e0e7ff', color: '#3730a3' },
    rejected: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b' },
  }
  return map[status] || { label: status, bg: '#e9efec', color: '#404845' }
}

const AVATAR_COLORS = ['#dcece5', '#dce9ed', '#f1e1e3', '#f1e8d9', '#e7e3f0']
const AVATAR_TEXT_COLORS = ['#29574b', '#3d6270', '#87565a', '#806346', '#655e7d']

// Sidebar
const SIDEBAR_ITEMS = [
  { label: 'Dashboard', icon: '⌂', path: '/doctor-dashboard' },
  { label: 'Patients', icon: '♧', path: '/doctor-patients' },
  { label: 'Appointments', icon: '▣', path: '#appointments' },
  { label: 'My Profile', icon: '◎', path: '/doctor-dashboard' },
]

function DoctorSidebar({ doctorName, specialization, facilityName, activeTab, setActiveTab }) {
  const navigate = useNavigate()
  return (
    <aside className="profile-sidebar">
      <div className="profile-suite-brand">
        <span style={{ fontSize: '1.2rem' }}>✚</span>
        <div><strong>MediMate</strong><small>CLINICAL SUITE</small></div>
      </div>
      <div className="profile-doctor-mini">
        <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '1.05rem', flexShrink: 0 }}>
          {getInitials(doctorName)}
        </div>
        <div><b>{doctorName}</b><small>{specialization || 'Doctor'} · Attending</small></div>
        <i />
      </div>
      <button className="profile-consult" onClick={() => navigate('/doctor-patients')}>+ New Consultation</button>
      <nav>
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = (item.label === 'Appointments' && activeTab === 'appointments') || (item.label !== 'Appointments' && item.label !== 'Patients' && activeTab === 'dashboard')
          return item.path.startsWith('#') ? (
            <button key={item.label} onClick={() => setActiveTab('appointments')} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '12px', color: isActive ? 'white' : '#404845', background: isActive ? '#29574b' : 'transparent', fontSize: '14px', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left', fontWeight: 600 }}>
              <span style={{ width: '18px', textAlign: 'center', fontSize: '16px' }}>{item.icon}</span>{item.label}
            </button>
          ) : (
            <Link key={item.label} to={item.path} className={isActive && item.label !== 'Patients' ? 'active' : ''} onClick={() => item.label === 'Patients' ? null : setActiveTab('dashboard')}>
              <span>{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>
      <div className="profile-sidebar-footer">
        <small>CLINICAL OUTLET</small>
        <b>{facilityName}</b>
        <span>⚙</span>
      </div>
    </aside>
  )
}

// Appointment Card
function AppointmentCard({ appt, onApprove, onReject, onComplete, loading, onOpenChat, onOpenVideo }) {
  const idx = (appt.patient?.name || '').charCodeAt(0) % AVATAR_COLORS.length
  const badge = statusBadge(appt.status)
  return (
    <article style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', padding: '20px 22px', borderRadius: '16px', background: 'rgba(255,255,255,0.85)', border: '1px solid #e2eae5', boxShadow: '0 4px 14px -6px rgba(41,87,75,0.12)' }}>
      <div style={{ flexShrink: 0, width: '50px', height: '50px', borderRadius: '14px', display: 'grid', placeItems: 'center', fontFamily: "'Playfair Display',serif", fontWeight: 700, fontSize: '1.2rem', background: AVATAR_COLORS[idx], color: AVATAR_TEXT_COLORS[idx] }}>
        {getInitials(appt.patient?.name || 'P')}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
          <strong style={{ fontSize: '1.2rem', color: '#1d302a', fontFamily: "'Playfair Display',serif", fontWeight: 700 }}>{appt.patient?.name || 'Patient'}</strong>
          <span style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 700, background: badge.bg, color: badge.color }}>{badge.label}</span>
        </div>
        <small style={{ display: 'block', marginTop: '4px', color: '#59756e', fontSize: '0.92rem' }}>📞 {appt.patient?.phone || 'N/A'}</small>
        <small style={{ display: 'block', marginTop: '4px', color: '#29574b', fontSize: '0.95rem', fontWeight: 700 }}>🗓 {formatSlot(appt.slot)}{appt.facility?.name && <> · {appt.facility.name}</>}</small>
        {appt.share_records && <small style={{ display: 'block', marginTop: '4px', color: '#426f63', fontSize: '0.88rem', fontWeight: 600 }}>✓ Patient shared medical records</small>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexShrink: 0 }}>
        {appt.status === 'pending' && <>
          <button disabled={loading} onClick={() => onApprove(appt.id)} style={{ padding: '8px 16px', borderRadius: '999px', border: 'none', background: '#29574b', color: '#00ff88', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>✓ Approve</button>
          <button disabled={loading} onClick={() => onReject(appt.id)} style={{ padding: '8px 16px', borderRadius: '999px', border: '1px solid #fecaca', background: '#fee2e2', color: '#991b1b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>✕ Reject</button>
        </>}
        {appt.status === 'approved' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={() => onOpenChat && onOpenChat(appt)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '999px',
                  border: '1.5px solid #29574b',
                  background: '#eaf3ee',
                  color: '#29574b',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                💬 Chat
              </button>
              <button
                onClick={() => onOpenVideo && onOpenVideo(appt)}
                style={{
                  padding: '7px 14px',
                  borderRadius: '999px',
                  border: 'none',
                  background: '#29574b',
                  color: '#00ff88',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                📹 Video
              </button>
            </div>
            <button
              disabled={loading}
              onClick={() => onComplete(appt.id)}
              style={{
                padding: '7px 14px',
                borderRadius: '999px',
                border: 'none',
                background: '#404845',
                color: '#fff',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer',
              }}
            >
              ✓ Complete
            </button>
          </div>
        )}
        {(appt.status === 'completed' || appt.status === 'rejected') && <span style={{ fontSize: '0.85rem', color: '#8a9b95', fontStyle: 'italic', fontWeight: 600 }}>{appt.status === 'completed' ? 'Session ended' : 'Declined'}</span>}
      </div>
    </article>
  )
}

// Appointments Panel
function AppointmentsPanel({ appointments, loadingAppts, apptError, onRefresh, onOpenChat, onOpenVideo }) {
  const [actionLoading, setActionLoading] = useState(false)
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState('')

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 3500) }

  const handleApprove = async (id) => {
    setActionLoading(true)
    try { await approveAppointment(id); showToast('Appointment approved! Patient has been notified.'); onRefresh() }
    catch (e) { showToast('Error: ' + (e.message || 'Failed to approve')) }
    finally { setActionLoading(false) }
  }

  const handleReject = async (id) => {
    setActionLoading(true)
    try { await rejectAppointment(id); showToast('Appointment rejected.'); onRefresh() }
    catch (e) { showToast('Error: ' + (e.message || 'Failed to reject')) }
    finally { setActionLoading(false) }
  }

  const handleComplete = async (id) => {
    setActionLoading(true)
    try { await completeAppointment(id); showToast('Appointment marked as complete.'); onRefresh() }
    catch (e) { showToast('Error: ' + (e.message || 'Failed to complete')) }
    finally { setActionLoading(false) }
  }

  const FILTERS = ['all', 'pending', 'approved', 'completed', 'rejected']
  const filtered = filter === 'all' ? appointments : appointments.filter((a) => a.status === filter)
  const counts = FILTERS.slice(1).reduce((acc, s) => { acc[s] = appointments.filter((a) => a.status === s).length; return acc }, {})

  return (
    <div>
      {toast && <div style={{ padding: '14px 20px', borderRadius: '12px', background: '#dcece5', color: '#29574b', fontWeight: 700, fontSize: '1rem', marginBottom: '20px', border: '1px solid #c4dcd3' }}>{toast}</div>}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '22px', flexWrap: 'wrap', gap: '14px' }}>
        <div>
          <h2 style={{ margin: 0, font: "600 2.4rem/1.1 'Playfair Display',serif", color: '#171d1b' }}>Appointments</h2>
          <p style={{ margin: '6px 0 0', color: '#59756e', fontSize: '1.05rem', fontWeight: 500 }}>Manage consultation requests and approvals</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <span style={{ padding: '7px 16px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontWeight: 700, fontSize: '0.9rem' }}>{appointments.length} Total</span>
          <button onClick={onRefresh} style={{ padding: '8px 18px', borderRadius: '999px', border: '1px solid #d5dbd8', background: 'white', color: '#29574b', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>↺ Refresh</button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '22px' }}>
        {[{ label: 'Pending', count: counts.pending || 0, bg: '#fef3c7', color: '#92400e' }, { label: 'Approved', count: counts.approved || 0, bg: '#dcece5', color: '#29574b' }, { label: 'Completed', count: counts.completed || 0, bg: '#e0e7ff', color: '#3730a3' }, { label: 'Rejected', count: counts.rejected || 0, bg: '#fee2e2', color: '#991b1b' }].map(({ label, count, bg, color }) => (
          <div key={label} style={{ padding: '16px 18px', borderRadius: '16px', background: bg, textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: '1.9rem', fontFamily: "'Playfair Display',serif", color }}>{count}</strong>
            <small style={{ color, fontSize: '0.88rem', fontWeight: 700 }}>{label}</small>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '8px 18px', borderRadius: '999px', border: '1px solid #d5dfda', background: filter === f ? '#29574b' : 'transparent', color: filter === f ? 'white' : '#59756e', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', textTransform: 'capitalize' }}>
            {f === 'all' ? 'All' : f}{f !== 'all' && counts[f] !== undefined ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>
      {loadingAppts ? (
        <div style={{ padding: '40px', textAlign: 'center', color: '#59756e', fontSize: '1.1rem' }}>Loading appointments…</div>
      ) : apptError ? (
        <div style={{ padding: '20px', borderRadius: '14px', background: '#fee2e2', color: '#991b1b', fontWeight: 600, fontSize: '1rem' }}>{apptError}</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', borderRadius: '16px', background: 'rgba(255,255,255,0.7)', border: '1px solid #e2eae5' }}>
          <p style={{ margin: 0, color: '#59756e', fontSize: '1.1rem', fontWeight: 600 }}>{filter === 'all' ? 'No appointments yet.' : `No ${filter} appointments.`}</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {filtered.map((appt) => (
            <AppointmentCard
              key={appt.id}
              appt={appt}
              loading={actionLoading}
              onApprove={handleApprove}
              onReject={handleReject}
              onComplete={handleComplete}
              onOpenChat={onOpenChat}
              onOpenVideo={onOpenVideo}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Profile/Dashboard Tab
function ProfileTab({ doctor, user, appointments, onToggleAvailability, availabilityLoading }) {
  const name = user?.name || 'Doctor'
  const displayName = name.startsWith('Dr.') ? name : `Dr. ${name}`
  const facilityName = doctor?.facility?.name || window.localStorage.getItem('medimate-doctor-facility') || 'Your Facility'
  const licenseNumber = doctor?.license_number || window.localStorage.getItem('medimate-doctor-medical-id') || '—'
  const specialization = doctor?.specialization || 'General Medicine'
  const qualification = doctor?.qualification || '—'
  const experienceYears = doctor?.experience_years
  const bio = doctor?.bio || 'Dedicated medical professional providing quality healthcare through the MediMate Rural Health Network.'
  const isAvailable = doctor?.is_available ?? false
  const verified = doctor?.verified ?? false
  const pendingCount = appointments.filter((a) => a.status === 'pending').length
  const approvedCount = appointments.filter((a) => a.status === 'approved').length
  const completedCount = appointments.filter((a) => a.status === 'completed').length

  return (
    <>
      <div className="profile-breadcrumb">PORTAL &nbsp;/&nbsp; PHYSICIAN WORKSPACE &nbsp;/&nbsp; DOCTOR PROFILE</div>
      <div className="profile-title-row">
        <div>
          <h1>Doctor Profile &amp;<br />Practice</h1>
          <p>Manage your verified clinical credentials, facility affiliations, and consultation availability.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={onToggleAvailability} disabled={availabilityLoading} style={{ padding: '10px 18px', borderRadius: '999px', border: 'none', background: isAvailable ? '#29574b' : '#e9efec', color: isAvailable ? '#00ff88' : '#59756e', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {availabilityLoading ? '…' : isAvailable ? '● Available for Consults' : '○ Set as Available'}
          </button>
          <button onClick={logout} style={{ padding: '10px 18px', borderRadius: '999px', border: 'none', background: '#fee2e2', color: '#991b1b', fontSize: '0.92rem', fontWeight: 700, cursor: 'pointer' }}>⎋ Logout</button>
        </div>
      </div>

      <section className="profile-hero-card">
        <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '2.2rem', flexShrink: 0 }}>{getInitials(displayName)}</div>
        <div>
          <h2>{displayName}</h2>
          <span>Attending Physician · {specialization}</span>
          <p>Medical Professional · MediMate Rural Health Network</p>
          <small>⌖ {facilityName} &nbsp; ◉ Registry: {licenseNumber}</small>
        </div>
        <div className="hero-status">
          {verified && <b>✓ VERIFIED CLINICIAN</b>}
          <strong>{isAvailable ? '↗ AVAILABLE' : '✕ UNAVAILABLE'}</strong>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginTop: '18px' }}>
        {[{ label: 'Pending Requests', value: pendingCount, bg: '#fef3c7', color: '#92400e' }, { label: 'Active / Approved', value: approvedCount, bg: '#dcece5', color: '#29574b' }, { label: 'Completed Sessions', value: completedCount, bg: '#e0e7ff', color: '#3730a3' }].map(({ label, value, bg, color }) => (
          <div key={label} style={{ padding: '20px', borderRadius: '16px', background: bg, textAlign: 'center' }}>
            <strong style={{ display: 'block', fontSize: '2.2rem', fontFamily: "'Playfair Display',serif", color }}>{value}</strong>
            <small style={{ color, fontSize: '0.88rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</small>
          </div>
        ))}
      </div>

      <section className="affiliation-card" style={{ marginTop: '16px' }}>
        <span>▣</span>
        <div>
          <small>PRIMARY AFFILIATION &nbsp;•&nbsp; Public Health Network</small>
          <h2>{facilityName}</h2>
          <p>{specialization} Department · MediMate Network</p>
        </div>
      </section>

      <div className="profile-grid">
        <article className="profile-card credentials-card">
          <header><span>♧</span><h2>Professional<br />Credentials &amp; License</h2><b>▢</b></header>
          <div className="credential-panel">
            <div className="credential-columns">
              <div><small>MEDICAL COUNCIL LICENSE</small><strong>{licenseNumber}</strong>{verified && <em>✓ Verified</em>}</div>
              <div><small>CLINICAL EXPERIENCE</small><strong>{experienceYears ? `${experienceYears}+ Years` : '—'}</strong></div>
            </div>
            <div className="credential-columns" style={{ marginTop: '14px' }}>
              <div><small>QUALIFICATION</small><strong>{qualification}</strong></div>
              <div><small>SPECIALIZATION</small><strong>{specialization}</strong></div>
            </div>
          </div>
        </article>

        <article className="profile-card account-card">
          <header><span>♙</span><h2>Account<br />Settings</h2><b>⚙</b></header>
          <div className="setting-list">
            <div><small>FULL LEGAL NAME</small><strong>{displayName}</strong></div>
            {user?.email && <div><small>CONTACT EMAIL</small><strong>{user.email}</strong></div>}
            {user?.phone && <div><small>CONTACT PHONE</small><strong>{user.phone}</strong></div>}
            <div><small>FACILITY</small><strong>{facilityName}</strong></div>
          </div>
        </article>

        <article className="profile-card specialization-card">
          <header><span>♧</span><h2>Specialization &amp;<br />Clinical Focus</h2></header>
          <div className="specialty-tags">
            <span>{specialization}</span>
            {qualification && qualification !== '—' && <span>{qualification}</span>}
          </div>
          <h4>CLINICAL BIOGRAPHY</h4>
          <p>{bio}</p>
        </article>

        <article className="profile-card schedule-card">
          <header><span>▣</span><h2>Consultation<br />Schedule</h2><b>·</b></header>
          <div className="schedule-list">
            <div><span>▣</span><p>IN-PERSON OPD TIMINGS<strong>Mon – Fri: 09:00 AM – 02:00 PM</strong><small>{facilityName}</small></p></div>
            <div><span>⌁</span><p>TELE-TRIAGE WINDOW<strong>Mon – Sat: 04:00 PM – 06:00 PM</strong><small>Prioritized rural referral queue</small></p></div>
          </div>
        </article>
      </div>

      {appointments.length > 0 && (
        <div style={{ marginTop: '26px', padding: '24px', borderRadius: '18px', background: 'rgba(255,255,255,0.85)', border: '1px solid #e2eae5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, font: "600 1.5rem 'Playfair Display',serif", color: '#171d1b' }}>Recent Appointments</h3>
            <span style={{ padding: '6px 14px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontSize: '0.9rem', fontWeight: 700 }}>{pendingCount} pending</span>
          </div>
          <div style={{ display: 'grid', gap: '10px' }}>
            {appointments.slice(0, 5).map((a) => {
              const badge = statusBadge(a.status)
              return (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: '0.95rem', flexShrink: 0 }}>{getInitials(a.patient?.name || 'P')}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', fontSize: '1.05rem', color: '#171d1b', fontWeight: 700 }}>{a.patient?.name || 'Patient'}</strong>
                    <small style={{ color: '#59756e', fontSize: '0.88rem' }}>{formatSlot(a.slot)}</small>
                  </div>
                  <span style={{ padding: '4px 10px', borderRadius: '999px', background: badge.bg, color: badge.color, fontSize: '0.82rem', fontWeight: 700, whiteSpace: 'nowrap' }}>{badge.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <blockquote className="profile-quote">
        "Precision diagnostics paired<br />with rural accessibility defines<br />modern medicine."
        <small>MEDIMATE CLINICIAN NETWORK • 2026</small>
      </blockquote>
    </>
  )
}

// Main
export default function DoctorDashboard() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const [doctor, setDoctor] = useState(null)
  const [doctorLoading, setDoctorLoading] = useState(true)
  const [appointments, setAppointments] = useState([])
  const [loadingAppts, setLoadingAppts] = useState(true)
  const [apptError, setApptError] = useState('')
  const [availabilityLoading, setAvailabilityLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('dashboard')
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

  const rawName = user?.name || window.localStorage.getItem('medimate-account-name') || 'Doctor'
  const displayName = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`
  const facilityName = doctor?.facility?.name || window.localStorage.getItem('medimate-doctor-facility') || 'Your Facility'
  const specialization = doctor?.specialization || 'General Medicine'

  const fetchProfile = async () => {
    try {
      const res = await getDoctorProfile()
      if (res?.doctor) setDoctor(res.doctor)
    } catch { /* non-critical */ } finally { setDoctorLoading(false) }
  }

  const fetchAppointments = async () => {
    setLoadingAppts(true)
    setApptError('')
    try {
      const list = await getAppointments()
      list.sort((a, b) => {
        const order = { pending: 0, approved: 1, completed: 2, rejected: 3 }
        const d = (order[a.status] ?? 99) - (order[b.status] ?? 99)
        return d !== 0 ? d : new Date(a.slot || 0) - new Date(b.slot || 0)
      })
      setAppointments(list)
    } catch (e) { setApptError(e.message || 'Failed to load appointments.') }
    finally { setLoadingAppts(false) }
  }

  useEffect(() => { fetchProfile(); fetchAppointments() }, [])

  const handleToggleAvailability = async () => {
    if (!doctor?.id) return
    setAvailabilityLoading(true)
    try {
      const newVal = !doctor.is_available
      await toggleAvailability(doctor.id, newVal)
      setDoctor((prev) => ({ ...prev, is_available: newVal }))
    } catch { /* ignore */ } finally { setAvailabilityLoading(false) }
  }

  return (
    <div className="doctor-profile-page">
      <DoctorSidebar doctorName={displayName} specialization={specialization} facilityName={facilityName} activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="profile-workspace">
        <header className="profile-topbar">
          <div>
            <span>▣ &nbsp; Secure Session</span>
            <small>{doctorLoading ? 'Loading profile…' : doctor?.verified ? 'Verified · State Medical Registry' : 'Pending Verification'}</small>
          </div>
          <div>
            <button onClick={() => navigate('/doctor-patients')} style={{ border: 'none', background: '#eaf3ee', color: '#29574b', padding: '8px 16px', borderRadius: '999px', fontWeight: 700, fontSize: '0.92rem', cursor: 'pointer' }}>♧ Patients</button>
            <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '0.95rem', flexShrink: 0 }}>{getInitials(displayName)}</div>
            <b>{displayName}<small>Attending Physician</small></b>
          </div>
        </header>
        <div className="profile-content">
          {activeTab === 'appointments' ? (
            <AppointmentsPanel
              appointments={appointments}
              loadingAppts={loadingAppts}
              apptError={apptError}
              onRefresh={fetchAppointments}
              onOpenChat={setActiveChatAppt}
              onOpenVideo={(appt) => setActiveVideoAppt({ ...appt, isInitiator: true, autoAccept: false })}
            />
          ) : (
            <ProfileTab doctor={doctor} user={user} appointments={appointments} onToggleAvailability={handleToggleAvailability} availabilityLoading={availabilityLoading} />
          )}
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
