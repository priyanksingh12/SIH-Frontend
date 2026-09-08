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
    pending: { label: 'Pending', bg: 'bg-[#fef3c7]', color: 'text-[#92400e]' },
    approved: { label: 'Approved', bg: 'bg-[#dcece5]', color: 'text-[#29574b]' },
    completed: { label: 'Completed', bg: 'bg-[#e0e7ff]', color: 'text-[#3730a3]' },
    rejected: { label: 'Rejected', bg: 'bg-[#fee2e2]', color: 'text-[#991b1b]' },
  }
  return map[status] || { label: status, bg: 'bg-[#e9efec]', color: 'text-[#404845]' }
}

const AVATAR_COLORS = ['bg-[#dcece5]', 'bg-[#dce9ed]', 'bg-[#f1e1e3]', 'bg-[#f1e8d9]', 'bg-[#e7e3f0]']
const AVATAR_TEXT_COLORS = ['text-[#29574b]', 'text-[#3d6270]', 'text-[#87565a]', 'text-[#806346]', 'text-[#655e7d]']

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
    <aside className="w-[260px] shrink-0 hidden md:flex flex-col p-6 bg-transparent border-r border-[rgba(41,87,75,0.12)] min-h-screen">
      <div className="flex items-center gap-3 pb-6">
        <span className="text-[1.2rem]">✚</span>
        <div><strong>SwasthyaSahay</strong><small className="block">CLINICAL SUITE</small></div>
      </div>
      <div className="flex items-center gap-2 p-3 border border-[#e2eae5] rounded-2xl bg-white/50 backdrop-blur-sm">
        <div className="w-[46px] h-[46px] rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-bold text-[1.05rem] shrink-0">
          {getInitials(doctorName)}
        </div>
        <div><b>{doctorName}</b><small className="block">{specialization || 'Doctor'} · Attending</small></div>
        <i />
      </div>
      <button className="my-5 p-3 w-full rounded-xl text-white bg-[#29574b] text-sm font-bold cursor-pointer border-0" onClick={() => navigate('/doctor-patients')}>+ New Consultation</button>
      <nav className="grid gap-1">
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = (item.label === 'Appointments' && activeTab === 'appointments') || (item.label !== 'Appointments' && item.label !== 'Patients' && activeTab === 'dashboard')
          return item.path.startsWith('#') ? (
            <button key={item.label} onClick={() => setActiveTab('appointments')} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm border-0 cursor-pointer w-full text-left font-semibold ${isActive ? 'text-white bg-[#29574b]' : 'text-[#404845] bg-transparent'}`}>
              <span className="w-[18px] text-center text-[16px]">{item.icon}</span>{item.label}
            </button>
          ) : (
            <Link key={item.label} to={item.path} className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold no-underline ${isActive && item.label !== 'Patients' ? 'text-white bg-[#29574b]' : 'text-[#404845]'}`} onClick={() => item.label === 'Patients' ? null : setActiveTab('dashboard')}>
              <span className="w-[18px] text-center text-[16px]">{item.icon}</span>{item.label}
            </Link>
          )
        })}
      </nav>
      <div className="relative mt-auto p-3 border border-[#dfe8e3] rounded-xl text-[#426f63] bg-[rgba(230,240,235,0.5)] text-sm flex flex-col">
        <small>CLINICAL OUTLET</small>
        <b>{facilityName}</b>
        <span className="absolute right-3 top-3">⚙</span>
      </div>
    </aside>
  )
}

// Appointment Card
function AppointmentCard({ appt, onApprove, onReject, onComplete, loading, onOpenChat, onOpenVideo }) {
  const idx = (appt.patient?.name || '').charCodeAt(0) % AVATAR_COLORS.length
  const badge = statusBadge(appt.status)
  return (
    <article className="flex items-start gap-4 p-5 rounded-2xl bg-white/85 border border-[#e2eae5] shadow-[0_4px_14px_-6px_rgba(41,87,75,0.12)]">
      <div className={`shrink-0 w-[50px] h-[50px] rounded-2xl grid place-items-center font-['Playfair_Display',serif] font-bold text-lg ${AVATAR_COLORS[idx]} ${AVATAR_TEXT_COLORS[idx]}`}>
        {getInitials(appt.patient?.name || 'P')}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <strong className="text-lg text-[#1d302a] font-['Playfair_Display',serif] font-bold">{appt.patient?.name || 'Patient'}</strong>
          <span className={`px-2.5 py-1 rounded-full text-[0.85rem] font-bold ${badge.bg} ${badge.color}`}>{badge.label}</span>
        </div>
        <small className="block mt-1 text-[#59756e] text-[0.92rem]">📞 {appt.patient?.phone || 'N/A'}</small>
        <small className="block mt-1 text-[#29574b] text-[0.95rem] font-bold">🗓 {formatSlot(appt.slot)}{appt.facility?.name && <> · {appt.facility.name}</>}</small>
        {appt.share_records && <small className="block mt-1 text-[#426f63] text-[0.88rem] font-semibold">✓ Patient shared medical records</small>}
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        {appt.status === 'pending' && <>
          <button disabled={loading} onClick={() => onApprove(appt.id)} className="px-4 py-2 rounded-full border-0 bg-[#29574b] text-[#00ff88] font-bold text-[0.9rem] cursor-pointer">✓ Approve</button>
          <button disabled={loading} onClick={() => onReject(appt.id)} className="px-4 py-2 rounded-full border border-[#fecaca] bg-[#fee2e2] text-[#991b1b] font-bold text-[0.9rem] cursor-pointer">✕ Reject</button>
        </>}
        {appt.status === 'approved' && (
          <div className="flex flex-col gap-1.5">
            <div className="flex gap-1.5">
              <button
                onClick={() => onOpenChat && onOpenChat(appt)}
                className="px-3.5 py-1.5 rounded-full border-[1.5px] border-[#29574b] bg-[#eaf3ee] text-[#29574b] font-bold text-[0.85rem] cursor-pointer"
              >
                💬 Chat
              </button>
              <button
                onClick={() => onOpenVideo && onOpenVideo(appt)}
                className="px-3.5 py-1.5 rounded-full border-0 bg-[#29574b] text-[#00ff88] font-extrabold text-[0.85rem] cursor-pointer"
              >
                📹 Video
              </button>
            </div>
            <button
              disabled={loading}
              onClick={() => onComplete(appt.id)}
              className="px-3.5 py-1.5 rounded-full border-0 bg-[#404845] text-white font-bold text-[0.85rem] cursor-pointer"
            >
              ✓ Complete
            </button>
          </div>
        )}
        {(appt.status === 'completed' || appt.status === 'rejected') && <span className="text-[0.85rem] text-[#8a9b95] italic font-semibold">{appt.status === 'completed' ? 'Session ended' : 'Declined'}</span>}
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
      {toast && <div className="px-5 py-3.5 rounded-xl bg-[#dcece5] text-[#29574b] font-bold text-base mb-5 border border-[#c4dcd3]">{toast}</div>}
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3.5">
        <div>
          <h2 className="m-0 font-['Playfair_Display',serif] font-semibold text-[2.4rem] leading-[1.1] text-[#171d1b]">Appointments</h2>
          <p className="m-0 mt-1.5 text-[#59756e] text-[1.05rem] font-medium">Manage consultation requests and approvals</p>
        </div>
        <div className="flex gap-3">
          <span className="px-4 py-1.5 rounded-full bg-[#eaf3ee] text-[#29574b] font-bold text-[0.9rem]">{appointments.length} Total</span>
          <button onClick={onRefresh} className="px-4.5 py-2 rounded-full border border-[#d5dbd8] bg-white text-[#29574b] font-bold text-[0.9rem] cursor-pointer">↺ Refresh</button>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
        {[{ label: 'Pending', count: counts.pending || 0, bg: 'bg-[#fef3c7]', color: 'text-[#92400e]' }, { label: 'Approved', count: counts.approved || 0, bg: 'bg-[#dcece5]', color: 'text-[#29574b]' }, { label: 'Completed', count: counts.completed || 0, bg: 'bg-[#e0e7ff]', color: 'text-[#3730a3]' }, { label: 'Rejected', count: counts.rejected || 0, bg: 'bg-[#fee2e2]', color: 'text-[#991b1b]' }].map(({ label, count, bg, color }) => (
          <div key={label} className={`px-4.5 py-4 rounded-2xl text-center ${bg}`}>
            <strong className={`block text-[1.9rem] font-['Playfair_Display',serif] ${color}`}>{count}</strong>
            <small className={`${color} text-[0.88rem] font-bold`}>{label}</small>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mb-5 flex-wrap">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`px-4.5 py-2 rounded-full border border-[#d5dfda] font-bold text-[0.9rem] cursor-pointer capitalize ${filter === f ? 'bg-[#29574b] text-white' : 'bg-transparent text-[#59756e]'}`}>
            {f === 'all' ? 'All' : f}{f !== 'all' && counts[f] !== undefined ? ` (${counts[f]})` : ''}
          </button>
        ))}
      </div>
      {loadingAppts ? (
        <div className="p-10 text-center text-[#59756e] text-[1.1rem]">Loading appointments…</div>
      ) : apptError ? (
        <div className="p-5 rounded-2xl bg-[#fee2e2] text-[#991b1b] font-semibold text-base">{apptError}</div>
      ) : filtered.length === 0 ? (
        <div className="p-10 text-center rounded-2xl bg-white/70 border border-[#e2eae5]">
          <p className="m-0 text-[#59756e] text-[1.1rem] font-semibold">{filter === 'all' ? 'No appointments yet.' : `No ${filter} appointments.`}</p>
        </div>
      ) : (
        <div className="grid gap-3">
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
  const facilityName = doctor?.facility?.name || window.localStorage.getItem('SwasthyaSahay-doctor-facility') || 'Your Facility'
  const licenseNumber = doctor?.license_number || window.localStorage.getItem('SwasthyaSahay-doctor-medical-id') || '—'
  const specialization = doctor?.specialization || 'General Medicine'
  const qualification = doctor?.qualification || '—'
  const experienceYears = doctor?.experience_years
  const bio = doctor?.bio || 'Dedicated medical professional providing quality healthcare through the SwasthyaSahay Rural Health Network.'
  const isAvailable = doctor?.is_available ?? false
  const verified = doctor?.verified ?? false
  const pendingCount = appointments.filter((a) => a.status === 'pending').length
  const approvedCount = appointments.filter((a) => a.status === 'approved').length
  const completedCount = appointments.filter((a) => a.status === 'completed').length

  return (
    <>
      <div className="text-[#29574b] text-xs font-bold tracking-widest uppercase mb-4">PORTAL &nbsp;/&nbsp; PHYSICIAN WORKSPACE &nbsp;/&nbsp; DOCTOR PROFILE</div>
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-4xl font-['Playfair_Display',serif] text-[#171d1b] font-bold m-0 leading-tight">Doctor Profile &amp;<br />Practice</h1>
          <p className="text-[#59756e] mt-2 text-base">Manage your verified clinical credentials, facility affiliations, and consultation availability.</p>
        </div>
        <div className="flex gap-2.5 flex-wrap">
          <button onClick={onToggleAvailability} disabled={availabilityLoading} className={`px-4.5 py-2.5 rounded-full border-0 text-[0.92rem] font-bold cursor-pointer whitespace-nowrap ${isAvailable ? 'bg-[#29574b] text-[#00ff88]' : 'bg-[#e9efec] text-[#59756e]'}`}>
            {availabilityLoading ? '…' : isAvailable ? '● Available for Consults' : '○ Set as Available'}
          </button>
          <button onClick={logout} className="px-4.5 py-2.5 rounded-full border-0 bg-[#fee2e2] text-[#991b1b] text-[0.92rem] font-bold cursor-pointer">⎋ Logout</button>
        </div>
      </div>

      <section className="flex flex-col md:flex-row items-start md:items-center gap-4 p-6 rounded-2xl bg-white/85 backdrop-blur-sm">
        <div className="w-[88px] h-[88px] rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-bold text-[2.2rem] shrink-0">{getInitials(displayName)}</div>
        <div>
          <h2 className="text-2xl font-bold font-['Playfair_Display',serif] text-[#171d1b] m-0">{displayName}</h2>
          <span className="text-[#59756e] font-semibold text-sm">Attending Physician · {specialization}</span>
          <p className="text-[#404845] mt-1 text-sm">Medical Professional · SwasthyaSahay Rural Health Network</p>
          <small className="text-[#59756e] text-xs block mt-1">⌖ {facilityName} &nbsp; ◉ Registry: {licenseNumber}</small>
        </div>
        <div className="mt-4 md:mt-0 md:ml-auto flex flex-col items-end gap-1 text-sm">
          {verified && <b className="text-[#29574b]">✓ VERIFIED CLINICIAN</b>}
          <strong className={isAvailable ? 'text-[#29574b]' : 'text-[#8a9b95]'}>{isAvailable ? '↗ AVAILABLE' : '✕ UNAVAILABLE'}</strong>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mt-4.5">
        {[{ label: 'Pending Requests', value: pendingCount, bg: 'bg-[#fef3c7]', color: 'text-[#92400e]' }, { label: 'Active / Approved', value: approvedCount, bg: 'bg-[#dcece5]', color: 'text-[#29574b]' }, { label: 'Completed Sessions', value: completedCount, bg: 'bg-[#e0e7ff]', color: 'text-[#3730a3]' }].map(({ label, value, bg, color }) => (
          <div key={label} className={`p-5 rounded-2xl text-center ${bg}`}>
            <strong className={`block text-[2.2rem] font-['Playfair_Display',serif] ${color}`}>{value}</strong>
            <small className={`${color} text-[0.88rem] font-bold uppercase tracking-wide`}>{label}</small>
          </div>
        ))}
      </div>

      <section className="flex flex-col md:flex-row md:items-center gap-4 mt-4 p-5 rounded-2xl bg-[rgba(234,243,238,0.85)] backdrop-blur-sm">
        <span className="text-2xl text-[#29574b]">▣</span>
        <div>
          <small className="text-xs text-[#59756e] font-bold uppercase tracking-wide">PRIMARY AFFILIATION &nbsp;•&nbsp; Public Health Network</small>
          <h2 className="text-xl font-bold font-['Playfair_Display',serif] text-[#171d1b] m-0 mt-1">{facilityName}</h2>
          <p className="text-sm text-[#404845] mt-1">{specialization} Department · SwasthyaSahay Network</p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-5 mt-5">
        <article className="p-5 rounded-2xl bg-white/85 backdrop-blur-sm">
          <header className="flex items-start justify-between mb-4">
            <div className="flex gap-2">
              <span className="text-xl text-[#29574b]">♧</span>
              <h2 className="text-lg font-bold font-['Playfair_Display',serif] text-[#171d1b] m-0 leading-tight">Professional<br />Credentials &amp; License</h2>
            </div>
            <b className="text-xl text-[#29574b]">▢</b>
          </header>
          <div className="flex flex-col gap-3.5">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col"><small className="text-xs text-[#59756e] font-bold uppercase">MEDICAL COUNCIL LICENSE</small><strong className="text-[#171d1b]">{licenseNumber}</strong>{verified && <em className="text-[#29574b] text-xs font-bold not-italic mt-0.5">✓ Verified</em>}</div>
              <div className="flex flex-col"><small className="text-xs text-[#59756e] font-bold uppercase">CLINICAL EXPERIENCE</small><strong className="text-[#171d1b]">{experienceYears ? `${experienceYears}+ Years` : '—'}</strong></div>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3.5">
              <div className="flex flex-col"><small className="text-xs text-[#59756e] font-bold uppercase">QUALIFICATION</small><strong className="text-[#171d1b]">{qualification}</strong></div>
              <div className="flex flex-col"><small className="text-xs text-[#59756e] font-bold uppercase">SPECIALIZATION</small><strong className="text-[#171d1b]">{specialization}</strong></div>
            </div>
          </div>
        </article>

        <article className="p-5 rounded-2xl bg-white/85 backdrop-blur-sm">
          <header className="flex items-start justify-between mb-4">
             <div className="flex gap-2">
               <span className="text-xl text-[#29574b]">♙</span>
               <h2 className="text-lg font-bold font-['Playfair_Display',serif] text-[#171d1b] m-0 leading-tight">Account<br />Settings</h2>
             </div>
             <b className="text-xl text-[#29574b]">⚙</b>
          </header>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col"><small className="text-xs text-[#59756e] font-bold uppercase">FULL LEGAL NAME</small><strong className="text-[#171d1b]">{displayName}</strong></div>
            {user?.email && <div className="flex flex-col"><small className="text-xs text-[#59756e] font-bold uppercase">CONTACT EMAIL</small><strong className="text-[#171d1b]">{user.email}</strong></div>}
            {user?.phone && <div className="flex flex-col"><small className="text-xs text-[#59756e] font-bold uppercase">CONTACT PHONE</small><strong className="text-[#171d1b]">{user.phone}</strong></div>}
            <div className="flex flex-col"><small className="text-xs text-[#59756e] font-bold uppercase">FACILITY</small><strong className="text-[#171d1b]">{facilityName}</strong></div>
          </div>
        </article>

        <article className="p-5 rounded-2xl bg-white/85 backdrop-blur-sm">
          <header className="flex items-start justify-between mb-4">
             <div className="flex gap-2">
               <span className="text-xl text-[#29574b]">♧</span>
               <h2 className="text-lg font-bold font-['Playfair_Display',serif] text-[#171d1b] m-0 leading-tight">Specialization &amp;<br />Clinical Focus</h2>
             </div>
          </header>
          <div className="flex gap-2 flex-wrap mb-4">
            <span className="px-3 py-1 rounded-full bg-[#eaf3ee] text-[#29574b] text-xs font-bold">{specialization}</span>
            {qualification && qualification !== '—' && <span className="px-3 py-1 rounded-full bg-[#eaf3ee] text-[#29574b] text-xs font-bold">{qualification}</span>}
          </div>
          <h4 className="text-xs text-[#59756e] font-bold uppercase mb-1">CLINICAL BIOGRAPHY</h4>
          <p className="text-sm text-[#404845] leading-relaxed m-0">{bio}</p>
        </article>

        <article className="p-5 rounded-2xl bg-white/85 backdrop-blur-sm">
          <header className="flex items-start justify-between mb-4">
             <div className="flex gap-2">
               <span className="text-xl text-[#29574b]">▣</span>
               <h2 className="text-lg font-bold font-['Playfair_Display',serif] text-[#171d1b] m-0 leading-tight">Consultation<br />Schedule</h2>
             </div>
             <b className="text-xl text-[#29574b]">·</b>
          </header>
          <div className="flex flex-col gap-4">
            <div className="flex gap-3">
              <span className="text-lg text-[#29574b] mt-1">▣</span>
              <p className="m-0 flex flex-col"><span className="text-xs text-[#59756e] font-bold uppercase">IN-PERSON OPD TIMINGS</span><strong className="text-[#171d1b]">Mon – Fri: 09:00 AM – 02:00 PM</strong><small className="text-xs text-[#404845]">{facilityName}</small></p>
            </div>
            <div className="flex gap-3">
              <span className="text-lg text-[#29574b] mt-1">⌁</span>
              <p className="m-0 flex flex-col"><span className="text-xs text-[#59756e] font-bold uppercase">TELE-TRIAGE WINDOW</span><strong className="text-[#171d1b]">Mon – Sat: 04:00 PM – 06:00 PM</strong><small className="text-xs text-[#404845]">Prioritized rural referral queue</small></p>
            </div>
          </div>
        </article>
      </div>

      {appointments.length > 0 && (
        <div className="mt-6 p-6 rounded-[18px] bg-white/85 border border-[#e2eae5]">
          <div className="flex justify-between items-center mb-4">
            <h3 className="m-0 font-['Playfair_Display',serif] font-semibold text-2xl text-[#171d1b]">Recent Appointments</h3>
            <span className="px-3.5 py-1.5 rounded-full bg-[#eaf3ee] text-[#29574b] text-[0.9rem] font-bold">{pendingCount} pending</span>
          </div>
          <div className="grid gap-2.5">
            {appointments.slice(0, 5).map((a) => {
              const badge = statusBadge(a.status)
              return (
                <div key={a.id} className="flex items-center gap-3.5 p-3 px-4 rounded-xl bg-[#f5fbf7] border border-[#e2eae5]">
                  <div className="w-[42px] h-[42px] rounded-xl bg-[#29574b] text-[#00ff88] grid place-items-center font-bold text-[0.95rem] shrink-0">{getInitials(a.patient?.name || 'P')}</div>
                  <div className="flex-1 min-w-0">
                    <strong className="block text-[1.05rem] text-[#171d1b] font-bold truncate">{a.patient?.name || 'Patient'}</strong>
                    <small className="text-[#59756e] text-[0.88rem]">{formatSlot(a.slot)}</small>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[0.82rem] font-bold whitespace-nowrap ${badge.bg} ${badge.color}`}>{badge.label}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <blockquote className="mt-8 mb-4 border-l-4 border-[#29574b] pl-4 italic text-[#404845] text-lg font-['Playfair_Display',serif]">
        "Precision diagnostics paired<br />with rural accessibility defines<br />modern medicine."
        <small className="block mt-2 text-xs font-sans text-[#59756e] not-italic font-bold tracking-wide">SwasthyaSahay CLINICIAN NETWORK • 2026</small>
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

  const rawName = user?.name || window.localStorage.getItem('SwasthyaSahay-account-name') || 'Doctor'
  const displayName = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`
  const facilityName = doctor?.facility?.name || window.localStorage.getItem('SwasthyaSahay-doctor-facility') || 'Your Facility'
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
    <div className="min-h-screen flex bg-transparent text-[#171d1b]">
      <DoctorSidebar doctorName={displayName} specialization={specialization} facilityName={facilityName} activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="flex-1 min-w-0 w-full">
        <header className="h-[68px] flex items-center justify-between px-4 md:px-8 border-b border-[rgba(41,87,75,0.12)] bg-[#f5fbf7]">
          <div className="flex flex-col">
            <span className="text-sm font-bold text-[#171d1b]">▣ &nbsp; Secure Session</span>
            <small className="text-xs text-[#59756e]">{doctorLoading ? 'Loading profile…' : doctor?.verified ? 'Verified · State Medical Registry' : 'Pending Verification'}</small>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/doctor-patients')} className="border-0 bg-[#eaf3ee] text-[#29574b] px-4 py-2 rounded-full font-bold text-[0.92rem] cursor-pointer">♧ Patients</button>
            <div className="w-[38px] h-[38px] rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-bold text-[0.95rem] shrink-0 hidden md:grid">{getInitials(displayName)}</div>
            <b className="hidden md:flex flex-col text-sm">{displayName}<small className="text-xs font-normal">Attending Physician</small></b>
          </div>
        </header>
        <div className="w-full max-w-[1060px] px-4 md:px-12 py-6 md:py-9 pb-16 mx-auto">
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
