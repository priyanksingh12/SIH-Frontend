import { useState, useEffect } from 'react'
import { getStoredUser } from '../api/apiClient.js'
import { getPatientProfile, updatePatientProfile, getVitals, getReports, getMedicalHistory } from '../api/patientApi.js'
import { getAppointments } from '../api/appointmentApi.js'
import { Sidebar, TopBar } from './PatientDashboard.jsx'
import { convertBase64ToPdfBlobUrl, downloadPdfFile } from '../utils/pdfHelper.js'
import ChatModal from '../components/ChatModal.jsx'
import VideoCallModal from '../components/VideoCallModal.jsx'
import IncomingCallModal from '../components/IncomingCallModal.jsx'
import { useCallListener } from '../hooks/useDoctorCallListener.js'

function getInitials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'PT'
}

function getMergedVitalsList(backendList) {
  const localList = JSON.parse(window.localStorage.getItem('medimate-vitals-history') || '[]')
  const combined = [...localList, ...(backendList || [])]
  const seen = new Set()
  const unique = []

  for (const item of combined) {
    if (!item) continue
    const timestampKey = item.created_at ? new Date(item.created_at).getTime() : 0
    const valKey = `${timestampKey}_${item.bp}_${item.sugar}_${item.spo2}_${item.hr}`
    if (!seen.has(valKey)) {
      seen.add(valKey)
      unique.push(item)
    }
  }

  unique.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
    return timeB - timeA
  })

  return unique
}

function getMergedMedicalHistory(backendData) {
  const localList = JSON.parse(window.localStorage.getItem('medimate-medical-history') || '[]')
  const backendList = Array.isArray(backendData) ? backendData : (backendData ? [backendData] : [])
  const combined = [...localList, ...backendList]

  const getTime = (rec) => {
    const raw = rec?.updated_at || rec?.created_at || rec?.date
    const t = raw ? new Date(raw).getTime() : 0
    return isNaN(t) ? 0 : t
  }

  // Local entries are unshifted first, so on a tie (e.g. backend gives no
  // usable timestamp) the just-saved local record still wins.
  combined.sort((a, b) => getTime(b) - getTime(a))
  return combined
}

function ProfileHeader({ onEditClick }) {
  return (
    <div className="flex items-center justify-between gap-5 mb-6">
      <div className="flex-1">
        <div className="text-[#29574b] text-sm font-extrabold tracking-widest uppercase">
          <span>PORTAL</span><i> / </i><span>PATIENT WORKSPACE</span><i> / </i><b>MY PROFILE</b>
        </div>
        <h1 className="mt-1.5 font-bold text-4xl leading-tight font-serif text-[#171d1b]">Patient Profile &amp; Health Identity</h1>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onEditClick} className="px-5 py-2.5 rounded-full bg-[#29574b] text-[#00ff88] font-bold text-sm border-0 cursor-pointer">
          ↗ <span>Edit Profile</span>
        </button>
      </div>
    </div>
  )
}

function IdentityCard({ userName, profile, user, latestVitals }) {
  let ageText = 'Age not set'
  if (profile?.dob || user?.dob) {
    const dobDate = new Date(profile?.dob || user?.dob)
    if (!isNaN(dobDate.getTime())) {
      const age = new Date().getFullYear() - dobDate.getFullYear()
      ageText = `${age} Yrs`
    }
  }

  const genderText = profile?.gender || 'Patient'
  const patientIdText = profile?.id?.slice(0, 8).toUpperCase() || user?.id?.slice(0, 8).toUpperCase() || 'N/A'
  const phoneText = profile?.phone || user?.phone ? `+91 ${profile?.phone || user?.phone}` : 'No phone listed'
  const emailText = profile?.email || user?.email || 'No email listed'
  const addressText = profile?.address || 'Location not set'
  const doctorText = latestVitals?.doctor_name || 'Dr. Ananya Sharma (Attending OPD)'

  return (
    <section className="p-6 rounded-[20px] bg-white border border-[#e2eae5] shadow-[0_8px_24px_rgba(41,87,75,0.06)] mb-6 flex items-center gap-5">
      <div className="w-[76px] h-[76px] rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-extrabold text-3xl shrink-0 shadow-[0_4px_14px_rgba(41,87,75,0.25)] border-4 border-[#dcece5]">
        {getInitials(userName)}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-3.5 flex-wrap">
          <h2 className="m-0 font-bold text-2xl font-serif text-[#171d1b]">{userName}</h2>
          <span className="text-sm text-[#59756e] font-semibold">Patient ID: #{patientIdText}</span>
          <b className="px-3 py-1 rounded-full bg-[#dcece5] text-[#29574b] text-xs font-bold">
            {ageText} • {genderText}
          </b>
        </div>
        <div className="flex flex-wrap gap-4 mt-3.5 text-[#404845] text-sm font-semibold">
          <span>📱 {phoneText}</span>
          <span>📧 {emailText}</span>
          <span>📍 {addressText}</span>
          <span>🩺 {doctorText}</span>
        </div>
      </div>
    </section>
  )
}


function VitalsBaseline({ latestVitals, loading }) {
  const bp = latestVitals?.bp || 'Not recorded'
  const hr = latestVitals?.hr != null ? `${latestVitals.hr} bpm` : 'Not recorded'
  const sugar = latestVitals?.sugar != null ? `${latestVitals.sugar} mg/dL` : 'Not recorded'
  const height = latestVitals?.height != null ? `${latestVitals.height} cm` : (latestVitals ? '168 cm' : 'Not set')
  const weight = latestVitals?.weight != null ? `${latestVitals.weight} kg` : (latestVitals ? '65 kg' : 'Not set')

  let bmiText = 'Not calculated'
  if (latestVitals?.weight && latestVitals?.height) {
    const hMeters = latestVitals.height / 100
    const bmiVal = (latestVitals.weight / (hMeters * hMeters)).toFixed(1)
    bmiText = `${bmiVal} (${bmiVal < 18.5 ? 'Underweight' : bmiVal > 25 ? 'Overweight' : 'Healthy'})`
  }

  const riskLevel = (latestVitals?.risk_level || 'low').toLowerCase()
  const pillLabel = riskLevel === 'high' ? 'High Risk Alert' : riskLevel === 'moderate' ? 'Moderate' : 'Normal Baseline'
  const pillClass = riskLevel === 'high' ? 'bg-[#ffe4e6] text-[#991b1b]' : riskLevel === 'moderate' ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#dcece5] text-[#29574b]'

  return (
    <section className="p-6 rounded-[20px] bg-white border border-[#e2eae5] shadow-[0_8px_24px_rgba(41,87,75,0.06)]">
      <header className="flex justify-between items-center mb-5">
        <div>
          <h2 className="m-0 font-bold text-xl font-serif text-[#171d1b]">Vitals Baseline &amp; Telemetry</h2>
          <p className="m-0 mt-1 text-[#59756e] text-xs">Clinician verified health summary from recent intake</p>
        </div>
        <b className={`px-3.5 py-1.5 rounded-full text-xs font-extrabold ${pillClass}`}>
          {pillLabel}
        </b>
      </header>

      {loading ? (
        <p className="p-4 opacity-60">Loading vitals baseline…</p>
      ) : (
        <div className="grid gap-4">
          <div className="flex justify-between p-3.5 rounded-xl bg-[#f5fbf7] border border-[#e2eae5]">
            <span className="font-semibold text-[#404845]">Resting Blood Pressure</span>
            <strong className="text-xl font-bold font-serif text-[#171d1b]">{bp}</strong>
          </div>
          <div className="flex justify-between p-3.5 rounded-xl bg-[#f5fbf7] border border-[#e2eae5]">
            <span className="font-semibold text-[#404845]">Heart Rate</span>
            <strong className="text-xl font-bold font-serif text-[#171d1b]">{hr}</strong>
          </div>
          <div className="flex justify-between p-3.5 rounded-xl bg-[#f5fbf7] border border-[#e2eae5]">
            <span className="font-semibold text-[#404845]">Fasting Blood Sugar</span>
            <strong className="text-xl font-bold font-serif text-[#171d1b]">{sugar}</strong>
          </div>
          <div className="flex justify-around items-center p-4 rounded-xl bg-[#effaf6] border border-[#b8dfd1] mt-1.5">
            <span className="text-center"><small className="block text-[#59756e] text-xs">Height</small><b className="text-base text-[#29574b]">{height}</b></span>
            <i className="w-[1px] h-6 bg-[#c4dcd3]" />
            <span className="text-center"><small className="block text-[#59756e] text-xs">Weight</small><b className="text-base text-[#29574b]">{weight}</b></span>
            <i className="w-[1px] h-6 bg-[#c4dcd3]" />
            <span className="text-center"><small className="block text-[#59756e] text-xs">BMI</small><b className="text-base text-[#29574b]">{bmiText}</b></span>
          </div>
        </div>
      )}
    </section>
  )
}

function CareNetwork({ latestVitals }) {
  const primaryDoctor = latestVitals?.doctor_name || 'Dr. Rajesh Verma'
  const secondaryDoctor = 'Dr. Ananya Sharma'

  return (
    <section className="p-6 rounded-[20px] bg-white border border-[#e2eae5] shadow-[0_8px_24px_rgba(41,87,75,0.06)]">
      <header className="flex justify-between items-center mb-5">
        <div>
          <h2 className="m-0 font-bold text-xl font-serif text-[#171d1b]">Care &amp; Facility Network</h2>
          <p className="m-0 mt-1 text-[#59756e] text-xs">Connected health centers</p>
        </div>
        <b className="px-3.5 py-1.5 rounded-full bg-[#eaf3ee] text-[#29574b] text-xs font-bold">
          2 Facilities
        </b>
      </header>

      <div className="grid gap-3.5">
        <article className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#f5fbf7] border border-[#e2eae5]">
          <div className="w-10 h-10 rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-bold">✚</div>
          <div className="flex-1">
            <b className="block text-base text-[#171d1b]">PHC Badshahpur <em className="text-xs not-italic text-[#29574b] bg-[#dcece5] px-2 py-0.5 rounded-full ml-1">Primary Center</em></b>
            <small className="text-[#59756e] text-sm">Attending: {primaryDoctor}</small>
          </div>
          <span className="font-bold text-[#29574b] text-sm">2.4 km</span>
        </article>

        <article className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-[#f5fbf7] border border-[#e2eae5]">
          <div className="w-10 h-10 rounded-full bg-[#426f63] text-white grid place-items-center font-bold">🏥</div>
          <div className="flex-1">
            <b className="block text-base text-[#171d1b]">CHC Manesar <em className="text-xs not-italic text-[#426f63] bg-[#eaf3ee] px-2 py-0.5 rounded-full ml-1">Secondary Referral</em></b>
            <small className="text-[#59756e] text-sm">Attending Specialist: {secondaryDoctor}</small>
          </div>
          <span className="font-bold text-[#426f63] text-sm">9.8 km</span>
        </article>
      </div>
    </section>
  )
}

function ClinicalReportsCard({ reports, loading, onViewPdf }) {
  return (
    <section className="p-6 rounded-[20px] bg-white border border-[#e2eae5] shadow-[0_8px_24px_rgba(41,87,75,0.06)] mt-6">
      <header className="flex justify-between items-center mb-5">
        <div>
          <h2 className="m-0 font-bold text-xl font-serif text-[#171d1b]">📄 Saved Clinical Reports &amp; AI Summaries</h2>
          <p className="m-0 mt-1 text-[#59756e] text-xs">Generated from AI Health Assistant triage sessions &amp; clinical intakes</p>
        </div>
        <b className="px-3.5 py-1.5 rounded-full bg-[#eaf3ee] text-[#29574b] text-xs font-bold">
          {reports.length} File{reports.length !== 1 ? 's' : ''}
        </b>
      </header>

      {loading ? (
        <p className="p-4 opacity-60">Loading clinical reports…</p>
      ) : reports.length === 0 ? (
        <div className="p-6 text-center bg-[#f5fbf7] rounded-2xl border border-[#e2eae5]">
          <p className="m-0 text-[#59756e] text-sm font-semibold">
            No clinical PDF reports generated yet. Use the <strong>AI Health Assistant</strong> to evaluate symptoms and generate downloadable PDF reports.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {reports.map((rep, idx) => {
            const pdfSource = rep.pdf_url || rep.report_url || rep.pdf_base64 || rep.report_base64 || rep.base64 || rep.pdf || rep.file_url
            const dateLabel = rep.generated_at ? new Date(rep.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'
            const title = rep.title || rep.file_name || 'AI Triage Clinical Summary PDF'

            return (
              <article key={rep.id || idx} className="flex items-center justify-between gap-4 px-4 py-3.5 rounded-2xl bg-[#f5fbf7] border border-[#e2eae5]">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-[#29574b] text-[#00ff88] grid place-items-center font-bold text-lg">
                    📄
                  </div>
                  <div>
                    <strong className="block text-base text-[#171d1b]">{title}</strong>
                    <small className="text-[#59756e] text-xs">Generated on {dateLabel} • ABHA Encrypted PDF</small>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => onViewPdf(pdfSource, title)}
                    className="px-3.5 py-2 rounded-full bg-[#eaf3ee] text-[#29574b] font-bold text-xs border border-[#c4dcd3] cursor-pointer"
                  >
                    👁 View PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPdfFile(pdfSource, `${title}.pdf`)}
                    className="px-3.5 py-2 rounded-full bg-[#29574b] text-[#00ff88] font-extrabold text-xs border-0 cursor-pointer"
                  >
                    ⬇ Download
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function PatientProfile() {
  const user = getStoredUser()
  const userName = user?.name || window.localStorage.getItem('medimate-account-name') || 'Patient'
  const patientId = user?.id

  const [profile, setProfile] = useState(user || {})
  const [vitals, setVitals] = useState([])
  const [vitalsLoading, setVitalsLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)
  const [medicalHistory, setMedicalHistory] = useState(null)
  const [medHistoryLoading, setMedHistoryLoading] = useState(true)
  const [appointments, setAppointments] = useState([])
  const [activeChatAppt, setActiveChatAppt] = useState(null)
  const [activeVideoAppt, setActiveVideoAppt] = useState(null)

  // Background incoming call listener for patient
  const { incomingCall, setIncomingCall, declineIncomingCall } = useCallListener(appointments, !!activeVideoAppt)

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

  // Edit Modal State
  const [isEditingModalOpen, setIsEditingModalOpen] = useState(false)
  const [editFormData, setEditFormData] = useState({
    name: '',
    phone: '',
    email: '',
    preferred_language: 'en',
    dob: '',
    gender: 'Male',
    blood_group: 'A+',
    address: '',
    emergency_contact: '',
  })
  const [saving, setSaving] = useState(false)
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('')

  const [pdfModal, setPdfModal] = useState(null)

  useEffect(() => {
    getAppointments()
      .then(setAppointments)
      .catch(() => setAppointments([]))
  }, [])

  useEffect(() => {
    const localReports = JSON.parse(window.localStorage.getItem('medimate-clinical-reports') || '[]')
    if (patientId) {
      getPatientProfile(patientId)
        .then((p) => {
          if (p) setProfile(p)
        })
        .catch(() => {})

      getVitals(patientId)
        .then((backendVitals) => {
          const merged = getMergedVitalsList(backendVitals || [])
          setVitals(merged)
        })
        .catch(() => {
          const merged = getMergedVitalsList([])
          setVitals(merged)
        })
        .finally(() => setVitalsLoading(false))

      getReports(patientId)
        .then((backendReports) => {
          const combined = [...localReports, ...(backendReports || [])]
          const seen = new Set()
          const unique = combined.filter((r) => {
            if (!r) return false
            const pdfVal = r.pdf_url || r.report_url || r.pdf_base64 || r.report_base64 || r.base64 || r.pdf || r.file_url
            if (!pdfVal) return false
            if (seen.has(pdfVal)) return false
            seen.add(pdfVal)
            return true
          })
          setReports(unique)
        })
        .catch(() => {
          setReports(localReports)
        })
        .finally(() => setReportsLoading(false))

                 getMedicalHistory(patientId)
        .then((data) => {
          const merged = getMergedMedicalHistory(data)
          setMedicalHistory(merged[0] || null)
        })
        .catch(() => {
          const merged = getMergedMedicalHistory(null)
          setMedicalHistory(merged[0] || null)
        })
        .finally(() => setMedHistoryLoading(false))
    } else {
      const merged = getMergedVitalsList([])
      setVitals(merged)
      setVitalsLoading(false)
      setReports(localReports)
      setReportsLoading(false)
      const mergedHistory = getMergedMedicalHistory(null)
      setMedicalHistory(mergedHistory[0] || null)
      setMedHistoryLoading(false)
    }
  }, [patientId])

  const latestVitals = vitals[0] || null

  const handleViewPdf = (pdfSource, title) => {
    const blobUrl = convertBase64ToPdfBlobUrl(pdfSource)
    if (blobUrl) {
      setPdfModal({ url: blobUrl, title, raw: pdfSource })
    } else {
      alert('Unable to load PDF file preview.')
    }
  }

  const openEditModal = () => {
    setEditFormData({
      name: profile?.name || user?.name || userName || '',
      phone: profile?.phone || user?.phone || '',
      email: profile?.email || user?.email || '',
      preferred_language: profile?.preferred_language || 'en',
      dob: profile?.dob || '',
      gender: profile?.gender || 'Male',
      blood_group: profile?.blood_group || 'A+',
      address: profile?.address || '',
      emergency_contact: profile?.emergency_contact || '',
    })
    setIsEditingModalOpen(true)
  }

  const handleEditChange = (e) => {
    const { name, value } = e.target
    setEditFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const updates = { ...editFormData }

      // Convert dob date string YYYY-MM-DD to valid ISO datetime string
      if (updates.dob && updates.dob.trim()) {
        const dateObj = new Date(updates.dob)
        if (!isNaN(dateObj.getTime())) {
          updates.dob = dateObj.toISOString()
        } else {
          delete updates.dob
        }
      } else {
        delete updates.dob
      }

      // Remove empty strings so Zod/backend validation schemas do not reject
      Object.keys(updates).forEach((key) => {
        if (updates[key] === '' || updates[key] === null || updates[key] === undefined) {
          delete updates[key]
        }
      })

      if (patientId) {
        await updatePatientProfile(patientId, updates)
      }

      const updatedUser = { ...(user || {}), ...(profile || {}), ...editFormData }
      setProfile(updatedUser)
      window.localStorage.setItem('medimate-user', JSON.stringify(updatedUser))
      window.localStorage.setItem('medimate-account-name', editFormData.name)

      setSaveSuccessMsg('Profile updated successfully!')
      setTimeout(() => setSaveSuccessMsg(''), 4000)
      setIsEditingModalOpen(false)
    } catch (err) {
      alert(err.message || 'Failed to update profile. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleEmergencyClick = () => {
    alert(`EMERGENCY MEDICAL CARD\n\nPatient Name: ${profile?.name || userName}\nBlood Group: ${profile?.blood_group || 'Not set'}\nEmergency Contact: ${profile?.emergency_contact || 'None registered'}\nAllergies: ${profile?.allergies || 'None'}\nPatient ID: ${patientId || 'N/A'}`)
  }

  return (
    <div className="min-h-screen bg-transparent text-[#171d1b] font-[Manrope,sans-serif]">
      <TopBar userName={profile?.name || userName} />
      <div className="flex flex-col md:flex-row min-h-[calc(100vh-88px)]">
        <Sidebar userName={profile?.name || userName} activeLabel="My Profile" />
        <main className="flex-1 min-w-0 w-full max-w-6xl px-4 md:px-16 py-8 md:py-10 mx-auto" style={{ padding: '36px 48px 80px' }}>
          {saveSuccessMsg && (
            <div style={{ padding: '14px 20px', background: '#d4edda', color: '#155724', borderRadius: '12px', marginBottom: '20px', fontWeight: 700, fontSize: '1rem', border: '1px solid #c3e6cb' }}>
              ✓ {saveSuccessMsg}
            </div>
          )}

          <ProfileHeader onEditClick={openEditModal} />
          <IdentityCard userName={profile?.name || userName} profile={profile} user={user} latestVitals={latestVitals} />

          <div className="profile-info-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px' }}>
            <VitalsBaseline latestVitals={latestVitals} loading={vitalsLoading} />
            <CareNetwork latestVitals={latestVitals} />
          </div>

          <ClinicalReportsCard reports={reports} loading={reportsLoading} onViewPdf={handleViewPdf} />

          {/* Appointments & Teleconsultations Card */}
          <section className="p-6 rounded-[20px] bg-white border border-[#e2eae5] shadow-[0_8px_24px_rgba(41,87,75,0.06)] mt-6">
            <header className="flex justify-between items-center mb-5 flex-wrap gap-2.5">
              <div>
                <h2 className="m-0 font-bold text-xl font-serif text-[#171d1b]">🩺 Doctor Consultations &amp; Telehealth</h2>
                <p className="m-0 mt-1 text-[#59756e] text-xs">Direct consultation rooms and real-time video sessions</p>
              </div>
              <b className="px-3.5 py-1.5 rounded-full bg-[#eaf3ee] text-[#29574b] text-xs font-bold">
                {appointments.length} Scheduled
              </b>
            </header>

            {appointments.length === 0 ? (
              <div className="p-6 text-center bg-[#f5fbf7] rounded-2xl border border-[#e2eae5]">
                <p className="m-0 text-[#59756e] text-sm font-semibold">
                  No appointments scheduled. Visit the <strong>Doctors</strong> directory to schedule a consultation.
                </p>
              </div>
            ) : (
              <div className="grid gap-3">
                {appointments.map((appt) => {
                  const docName = appt.doctor?.user?.name
                    ? `Dr. ${appt.doctor.user.name}`
                    : appt.doctor?.name
                      ? `Dr. ${appt.doctor.name}`
                      : 'Doctor'
                  const isApproved = appt.status === 'approved'
                  const isPending = appt.status === 'pending'
                  const isCompleted = appt.status === 'completed'
                  const slotDate = appt.slot ? new Date(appt.slot).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Scheduled'

                  const borderClass = isApproved ? 'border-[1.5px] border-[#a7f3d0]' : 'border border-[#e2eae5]'
                  const statusBgClass = isApproved ? 'bg-[#d1fae5] text-[#065f46]' : isPending ? 'bg-[#fef3c7] text-[#92400e]' : 'bg-[#e0e7ff] text-[#3730a3]'
                  
                  return (
                    <article key={appt.id} className={`flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-[#f5fbf7] flex-wrap ${borderClass}`}>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <strong className="text-base text-[#171d1b]">{docName}</strong>
                          <span className={`px-2 py-0.5 rounded-full text-[0.8rem] font-bold ${statusBgClass}`}>
                            {isApproved ? '✓ Approved' : isPending ? '⏳ Awaiting Doctor' : 'Completed'}
                          </span>
                        </div>
                        <small className="block mt-1 text-[#59756e] text-xs">
                          🗓 {slotDate} {appt.reason ? `• ${appt.reason}` : ''}
                        </small>
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        {isApproved && (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveChatAppt(appt)}
                              className="px-4 py-2 rounded-full bg-[#eaf3ee] text-[#29574b] font-bold text-xs border-[1.5px] border-[#29574b] cursor-pointer"
                            >
                              💬 Chat
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveVideoAppt({ ...appt, isInitiator: true, autoAccept: false })}
                              className="px-4.5 py-2 rounded-full bg-[#29574b] text-[#00ff88] font-extrabold text-xs border-0 cursor-pointer"
                            >
                              📹 Video Call
                            </button>
                          </>
                        )}
                        {isPending && (
                          <span className="px-3 py-1.5 rounded-full bg-[#fef3c7] text-[#92400e] font-semibold text-xs">
                            ⏳ Unlocks on approval
                          </span>
                        )}
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() => setActiveChatAppt(appt)}
                            className="px-3.5 py-2 rounded-full bg-[#eaf3ee] text-[#29574b] font-bold text-xs border border-[#c4dcd3] cursor-pointer"
                          >
                            Chat History
                          </button>
                        )}
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Medical History Card */}
          <section style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #e2eae5', boxShadow: '0 8px 24px rgba(41,87,75,0.06)', marginTop: '24px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, font: "700 1.4rem 'Playfair Display', serif", color: '#171d1b' }}>🏥 Medical History</h2>
                <p style={{ margin: '4px 0 0', color: '#59756e', fontSize: '0.85rem' }}>Recorded conditions, surgeries, and disease history</p>
              </div>
            </header>

            {medHistoryLoading ? (
              <p style={{ padding: '1rem', opacity: 0.6 }}>Loading medical history…</p>
            ) : !medicalHistory ? (
              <div style={{ padding: '24px', textAlign: 'center', background: '#f5fbf7', borderRadius: '14px', border: '1px solid #e2eae5' }}>
                <p style={{ margin: 0, color: '#59756e', fontSize: '0.95rem', fontWeight: 600 }}>
                  No medical history recorded yet. Add it from the <strong>Vitals</strong> page.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '14px' }}>
                {medicalHistory.conditions && medicalHistory.conditions.length > 0 && (
                  <div style={{ padding: '14px 18px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
                    <small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Conditions</small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {medicalHistory.conditions.map((c, i) => (
                        <span key={i} style={{ padding: '4px 12px', borderRadius: '999px', background: '#dcece5', color: '#29574b', fontSize: '0.9rem', fontWeight: 600 }}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {medicalHistory.surgeries && medicalHistory.surgeries.length > 0 && (
                  <div style={{ padding: '14px 18px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
                    <small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Previous Surgeries</small>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {medicalHistory.surgeries.map((s, i) => (
                        <span key={i} style={{ padding: '4px 12px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontSize: '0.9rem', fontWeight: 600 }}>{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div style={{ padding: '14px 18px', borderRadius: '12px', background: medicalHistory.had_typhoid ? '#fff1f0' : '#f5fbf7', border: `1px solid ${medicalHistory.had_typhoid ? '#fecaca' : '#e2eae5'}` }}>
                    <small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Had Typhoid</small>
                    <strong style={{ fontSize: '1.1rem', color: medicalHistory.had_typhoid ? '#991b1b' : '#29574b', fontWeight: 800 }}>
                      {medicalHistory.had_typhoid ? '⚠ Yes' : '✓ No'}
                    </strong>
                  </div>
                  <div style={{ padding: '14px 18px', borderRadius: '12px', background: medicalHistory.had_malaria ? '#fff1f0' : '#f5fbf7', border: `1px solid ${medicalHistory.had_malaria ? '#fecaca' : '#e2eae5'}` }}>
                    <small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Had Malaria</small>
                    <strong style={{ fontSize: '1.1rem', color: medicalHistory.had_malaria ? '#991b1b' : '#29574b', fontWeight: 800 }}>
                      {medicalHistory.had_malaria ? '⚠ Yes' : '✓ No'}
                    </strong>
                  </div>
                </div>

                {medicalHistory.doctor_notes && (
                  <div style={{ padding: '14px 18px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
                    <small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '6px' }}>Doctor Notes</small>
                    <p style={{ margin: 0, color: '#171d1b', fontSize: '0.95rem', lineHeight: 1.6 }}>{medicalHistory.doctor_notes}</p>
                  </div>
                )}

                {medicalHistory.date && (
                  <p style={{ margin: '4px 0 0', color: '#59756e', fontSize: '0.82rem' }}>
                    Recorded on {new Date(medicalHistory.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </p>
                )}
              </div>
            )}
          </section>
        </main>
      </div>

      {/* Embedded PDF Viewer Modal */}
      {pdfModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15, 29, 25, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#1b342e', color: '#ffffff', borderRadius: '16px 16px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '1.4rem' }}>📄</span>
              <strong style={{ fontSize: '1.15rem' }}>{pdfModal.title || 'Clinical PDF Document Viewer'}</strong>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => downloadPdfFile(pdfModal.raw || pdfModal.url, `${pdfModal.title || 'Report'}.pdf`)}
                style={{ padding: '8px 18px', borderRadius: '999px', background: '#00ff88', color: '#171d1b', fontWeight: 800, fontSize: '0.85rem', border: 0, cursor: 'pointer' }}
              >
                ⬇ Download PDF File
              </button>
              <button
                type="button"
                onClick={() => setPdfModal(null)}
                style={{ background: 'rgba(255,255,255,0.15)', border: 0, color: '#ffffff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.4rem', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
              >
                ×
              </button>
            </div>
          </div>
          <div style={{ flex: 1, background: '#ffffff', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
            <iframe
              src={pdfModal.url}
              title={pdfModal.title}
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {isEditingModalOpen && (
        <div className="patient-modal-overlay">
          <div className="patient-modal-content">
            <div className="patient-modal-header">
              <h2>Edit Patient Profile</h2>
              <button type="button" onClick={() => setIsEditingModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className="patient-modal-grid">
                <div className="patient-modal-field">
                  <label>Full Name</label>
                  <input type="text" name="name" value={editFormData.name} onChange={handleEditChange} required />
                </div>
                <div className="patient-modal-field">
                  <label>Phone Number</label>
                  <input type="text" name="phone" value={editFormData.phone} onChange={handleEditChange} placeholder="+91 XXXXXXXXXX" />
                </div>
                <div className="patient-modal-field">
                  <label>Email Address</label>
                  <input type="email" name="email" value={editFormData.email} onChange={handleEditChange} placeholder="patient@example.com" />
                </div>
                <div className="patient-modal-field">
                  <label>Preferred Language</label>
                  <select name="preferred_language" value={editFormData.preferred_language} onChange={handleEditChange}>
                    <option value="en">English</option>
                    <option value="hi">Hindi (हिंदी)</option>
                    <option value="bn">Bengali (বাংলা)</option>
                    <option value="te">Telugu (తెలుగు)</option>
                    <option value="mr">Marathi (मराठी)</option>
                    <option value="ta">Tamil (தமிழ்)</option>
                  </select>
                </div>
                <div className="patient-modal-field">
                  <label>Date of Birth</label>
                  <input type="date" name="dob" value={editFormData.dob} onChange={handleEditChange} />
                </div>
                <div className="patient-modal-field">
                  <label>Gender</label>
                  <select name="gender" value={editFormData.gender} onChange={handleEditChange}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="patient-modal-field">
                  <label>Blood Group</label>
                  <select name="blood_group" value={editFormData.blood_group} onChange={handleEditChange}>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                  </select>
                </div>
                <div className="patient-modal-field">
                  <label>Emergency Contact</label>
                  <input type="text" name="emergency_contact" value={editFormData.emergency_contact} onChange={handleEditChange} placeholder="+91 Guardian Phone" />
                </div>
                <div className="patient-modal-field full">
                  <label>Residential Address</label>
                  <textarea name="address" rows="2" value={editFormData.address} onChange={handleEditChange} placeholder="Enter your current address..." />
                </div>
              </div>

              <div className="patient-modal-actions">
                <button type="button" onClick={() => setIsEditingModalOpen(false)}>Cancel</button>
                <button type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Profile Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
