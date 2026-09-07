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

function ProfileHeader({ onEditClick, onEmergencyClick }) {
  return (
    <div className="profile-workspace-header" style={{ display: 'flex', alignItems: 'center', justifyBetween: 'space-between', gap: '20px', marginBottom: '24px' }}>
      <div style={{ flex: 1 }}>
        <div className="profile-breadcrumb" style={{ color: '#29574b', fontSize: '0.85rem', fontWeight: 800, letterSpacing: '1px' }}>
          <span>PORTAL</span><i> / </i><span>PATIENT WORKSPACE</span><i> / </i><b>MY PROFILE</b>
        </div>
        <h1 style={{ margin: '6px 0 0', font: "700 2.2rem/1.1 'Playfair Display', serif", color: '#171d1b' }}>Patient Profile &amp; Health Identity</h1>
      </div>
      <div className="profile-header-actions" style={{ display: 'flex', gap: '12px' }}>
        <button type="button" className="profile-emergency-button" onClick={onEmergencyClick} style={{ padding: '10px 18px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', font: '700 0.95rem sans-serif', border: '1px solid #c4dcd3', cursor: 'pointer' }}>
          ▣ <span>Emergency Card</span>
        </button>
        <button type="button" className="profile-edit-button" onClick={onEditClick} style={{ padding: '10px 18px', borderRadius: '999px', background: '#29574b', color: '#00ff88', font: '700 0.95rem sans-serif', border: 'none', cursor: 'pointer' }}>
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
    <section className="profile-identity-card" style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #e2eae5', boxShadow: '0 8px 24px rgba(41,87,75,0.06)', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '20px' }}>
      <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: '800', fontSize: '1.8rem', flexShrink: 0, boxShadow: '0 4px 14px rgba(41,87,75,0.25)', border: '3px solid #dcece5' }}>
        {getInitials(userName)}
      </div>
      <div className="profile-identity-details" style={{ flex: 1 }}>
        <div className="profile-identity-title" style={{ display: 'flex', alignItems: 'baseline', gap: '14px', flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, font: "700 1.6rem 'Playfair Display', serif", color: '#171d1b' }}>{userName}</h2>
          <span style={{ fontSize: '0.9rem', color: '#59756e', fontWeight: 600 }}>Patient ID: #{patientIdText}</span>
          <b style={{ padding: '4px 12px', borderRadius: '999px', background: '#dcece5', color: '#29574b', fontSize: '0.85rem', fontWeight: 700 }}>
            {ageText} • {genderText}
          </b>
        </div>
        <div className="profile-contact-row" style={{ display: 'flex', flexWrap: 'wrap', gap: '18px', marginTop: '14px', color: '#404845', fontSize: '0.95rem', fontWeight: 600 }}>
          <span>📱 {phoneText}</span>
          <span>📧 {emailText}</span>
          <span>📍 {addressText}</span>
          <span>🩺 {doctorText}</span>
        </div>
      </div>
    </section>
  )
}

function EmergencyCard({ profile }) {
  const bloodGroup = profile?.blood_group || 'Not set'
  const emergencyContact = profile?.emergency_contact || 'None registered'
  const allergies = profile?.allergies || 'No known severe allergies'
  const chronicConditions = profile?.conditions || 'None reported'

  return (
    <section className="profile-emergency-card" style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #e2eae5', boxShadow: '0 8px 24px rgba(41,87,75,0.06)', marginBottom: '24px' }}>
      <h2 style={{ margin: '0 0 16px', font: "700 1.3rem 'Playfair Display', serif", color: '#171d1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: '#c0392b' }}>✱</span> Emergency Medical ID
      </h2>
      <div className="profile-emergency-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
        <article style={{ padding: '16px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
          <small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Blood Group</small>
          <strong style={{ display: 'block', marginTop: '6px', fontSize: '1.2rem', color: '#171d1b', fontWeight: 800 }}>{bloodGroup}</strong>
        </article>
        <article style={{ padding: '16px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
          <small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Emergency Contact</small>
          <b style={{ display: 'block', marginTop: '6px', fontSize: '1rem', color: '#171d1b', fontWeight: 700 }}>{emergencyContact}</b>
        </article>
        <article className="profile-allergy" style={{ padding: '16px', borderRadius: '12px', background: '#fff1f0', border: '1px solid #fecaca' }}>
          <small style={{ display: 'block', color: '#991b1b', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Severe Allergies</small>
          <b style={{ display: 'block', marginTop: '6px', fontSize: '0.95rem', color: '#991b1b', fontWeight: 700 }}>⚠ {allergies}</b>
        </article>
        <article style={{ padding: '16px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
          <small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase' }}>Chronic Conditions</small>
          <b style={{ display: 'block', marginTop: '6px', fontSize: '0.95rem', color: '#171d1b', fontWeight: 700 }}>{chronicConditions}</b>
        </article>
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
  const pillBg = riskLevel === 'high' ? '#ffe4e6' : riskLevel === 'moderate' ? '#fef3c7' : '#dcece5'
  const pillColor = riskLevel === 'high' ? '#991b1b' : riskLevel === 'moderate' ? '#92400e' : '#29574b'

  return (
    <section className="profile-info-card" style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #e2eae5', boxShadow: '0 8px 24px rgba(41,87,75,0.06)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div className="profile-card-heading">
          <h2 style={{ margin: 0, font: "700 1.4rem 'Playfair Display', serif", color: '#171d1b' }}>Vitals Baseline &amp; Telemetry</h2>
          <p style={{ margin: '4px 0 0', color: '#59756e', fontSize: '0.85rem' }}>Clinician verified health summary from recent intake</p>
        </div>
        <b className="profile-normal-pill" style={{ padding: '6px 14px', borderRadius: '999px', background: pillBg, color: pillColor, fontSize: '0.85rem', fontWeight: 800 }}>
          {pillLabel}
        </b>
      </header>

      {loading ? (
        <p style={{ padding: '1rem', opacity: 0.6 }}>Loading vitals baseline…</p>
      ) : (
        <div className="profile-vital-rows" style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
            <span style={{ fontWeight: 600, color: '#404845' }}>Resting Blood Pressure</span>
            <strong style={{ fontSize: '1.2rem', color: '#171d1b', font: "700 1.2rem 'Playfair Display', serif" }}>{bp}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
            <span style={{ fontWeight: 600, color: '#404845' }}>Heart Rate</span>
            <strong style={{ fontSize: '1.2rem', color: '#171d1b', font: "700 1.2rem 'Playfair Display', serif" }}>{hr}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '14px', borderRadius: '12px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
            <span style={{ fontWeight: 600, color: '#404845' }}>Fasting Blood Sugar</span>
            <strong style={{ fontSize: '1.2rem', color: '#171d1b', font: "700 1.2rem 'Playfair Display', serif" }}>{sugar}</strong>
          </div>
          <div className="profile-body-stats" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '16px', borderRadius: '12px', background: '#effaf6', border: '1px solid #b8dfd1', marginTop: '6px' }}>
            <span><small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem' }}>Height</small><b style={{ fontSize: '1.05rem', color: '#29574b' }}>{height}</b></span>
            <i style={{ width: '1px', height: '24px', background: '#c4dcd3' }} />
            <span><small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem' }}>Weight</small><b style={{ fontSize: '1.05rem', color: '#29574b' }}>{weight}</b></span>
            <i style={{ width: '1px', height: '24px', background: '#c4dcd3' }} />
            <span><small style={{ display: 'block', color: '#59756e', fontSize: '0.8rem' }}>BMI</small><b style={{ fontSize: '1.05rem', color: '#29574b' }}>{bmiText}</b></span>
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
    <section className="profile-info-card profile-network-card" style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #e2eae5', boxShadow: '0 8px 24px rgba(41,87,75,0.06)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div className="profile-card-heading">
          <h2 style={{ margin: 0, font: "700 1.4rem 'Playfair Display', serif", color: '#171d1b' }}>Care &amp; Facility Network</h2>
          <p style={{ margin: '4px 0 0', color: '#59756e', fontSize: '0.85rem' }}>Connected health centers</p>
        </div>
        <b className="profile-facility-count" style={{ padding: '6px 14px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontSize: '0.85rem', fontWeight: 700 }}>
          2 Facilities
        </b>
      </header>

      <div className="profile-facilities" style={{ display: 'grid', gap: '14px' }}>
        <article style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px', borderRadius: '14px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>✚</div>
          <div style={{ flex: 1 }}>
            <b style={{ display: 'block', fontSize: '1rem', color: '#171d1b' }}>PHC Badshahpur <em style={{ fontSize: '0.8rem', fontStyle: 'normal', color: '#29574b', background: '#dcece5', padding: '2px 8px', borderRadius: '999px' }}>Primary Center</em></b>
            <small style={{ color: '#59756e', fontSize: '0.85rem' }}>Attending: {primaryDoctor}</small>
          </div>
          <span style={{ fontWeight: 700, color: '#29574b', fontSize: '0.9rem' }}>2.4 km</span>
        </article>

        <article style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px', borderRadius: '14px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#426f63', color: '#ffffff', display: 'grid', placeItems: 'center', fontWeight: 'bold' }}>🏥</div>
          <div style={{ flex: 1 }}>
            <b style={{ display: 'block', fontSize: '1rem', color: '#171d1b' }}>CHC Manesar <em style={{ fontSize: '0.8rem', fontStyle: 'normal', color: '#426f63', background: '#eaf3ee', padding: '2px 8px', borderRadius: '999px' }}>Secondary Referral</em></b>
            <small style={{ color: '#59756e', fontSize: '0.85rem' }}>Attending Specialist: {secondaryDoctor}</small>
          </div>
          <span style={{ fontWeight: 700, color: '#426f63', fontSize: '0.9rem' }}>9.8 km</span>
        </article>
      </div>
    </section>
  )
}

function ClinicalReportsCard({ reports, loading, onViewPdf }) {
  return (
    <section className="profile-info-card" style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #e2eae5', boxShadow: '0 8px 24px rgba(41,87,75,0.06)', marginTop: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div className="profile-card-heading">
          <h2 style={{ margin: 0, font: "700 1.4rem 'Playfair Display', serif", color: '#171d1b' }}>📄 Saved Clinical Reports &amp; AI Summaries</h2>
          <p style={{ margin: '4px 0 0', color: '#59756e', fontSize: '0.85rem' }}>Generated from AI Health Assistant triage sessions &amp; clinical intakes</p>
        </div>
        <b style={{ padding: '6px 14px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontSize: '0.85rem', fontWeight: 700 }}>
          {reports.length} File{reports.length !== 1 ? 's' : ''}
        </b>
      </header>

      {loading ? (
        <p style={{ padding: '1rem', opacity: 0.6 }}>Loading clinical reports…</p>
      ) : reports.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', background: '#f5fbf7', borderRadius: '14px', border: '1px solid #e2eae5' }}>
          <p style={{ margin: 0, color: '#59756e', fontSize: '0.95rem', fontWeight: 600 }}>
            No clinical PDF reports generated yet. Use the <strong>AI Health Assistant</strong> to evaluate symptoms and generate downloadable PDF reports.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '12px' }}>
          {reports.map((rep, idx) => {
            const pdfSource = rep.pdf_url || rep.report_url || rep.pdf_base64 || rep.report_base64 || rep.base64 || rep.pdf || rep.file_url
            const dateLabel = rep.generated_at ? new Date(rep.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recently'
            const title = rep.title || rep.file_name || 'AI Triage Clinical Summary PDF'

            return (
              <article key={rep.id || idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '14px 18px', borderRadius: '14px', background: '#f5fbf7', border: '1px solid #e2eae5' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                    📄
                  </div>
                  <div>
                    <strong style={{ display: 'block', fontSize: '1rem', color: '#171d1b' }}>{title}</strong>
                    <small style={{ color: '#59756e', fontSize: '0.85rem' }}>Generated on {dateLabel} • ABHA Encrypted PDF</small>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => onViewPdf(pdfSource, title)}
                    style={{ padding: '8px 14px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontWeight: 700, fontSize: '0.85rem', border: '1px solid #c4dcd3', cursor: 'pointer' }}
                  >
                    👁 View PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadPdfFile(pdfSource, `${title}.pdf`)}
                    style={{ padding: '8px 14px', borderRadius: '999px', background: '#29574b', color: '#00ff88', fontWeight: 800, fontSize: '0.85rem', border: 0, cursor: 'pointer' }}
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
    <div className="profile-dashboard-shell">
      <TopBar userName={profile?.name || userName} />
      <div className="profile-dashboard-body">
        <Sidebar userName={profile?.name || userName} activeLabel="My Profile" />
        <main className="profile-workspace" style={{ padding: '36px 48px 80px' }}>
          {saveSuccessMsg && (
            <div style={{ padding: '14px 20px', background: '#d4edda', color: '#155724', borderRadius: '12px', marginBottom: '20px', fontWeight: 700, fontSize: '1rem', border: '1px solid #c3e6cb' }}>
              ✓ {saveSuccessMsg}
            </div>
          )}

          <ProfileHeader onEditClick={openEditModal} onEmergencyClick={handleEmergencyClick} />
          <IdentityCard userName={profile?.name || userName} profile={profile} user={user} latestVitals={latestVitals} />
          <EmergencyCard profile={profile} />

          <div className="profile-info-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '24px' }}>
            <VitalsBaseline latestVitals={latestVitals} loading={vitalsLoading} />
            <CareNetwork latestVitals={latestVitals} />
          </div>

          <ClinicalReportsCard reports={reports} loading={reportsLoading} onViewPdf={handleViewPdf} />

          {/* Appointments & Teleconsultations Card */}
          <section style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #e2eae5', boxShadow: '0 8px 24px rgba(41,87,75,0.06)', marginTop: '24px' }}>
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h2 style={{ margin: 0, font: "700 1.4rem 'Playfair Display', serif", color: '#171d1b' }}>🩺 Doctor Consultations &amp; Telehealth</h2>
                <p style={{ margin: '4px 0 0', color: '#59756e', fontSize: '0.85rem' }}>Direct consultation rooms and real-time video sessions</p>
              </div>
              <b style={{ padding: '6px 14px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontSize: '0.85rem', fontWeight: 700 }}>
                {appointments.length} Scheduled
              </b>
            </header>

            {appointments.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', background: '#f5fbf7', borderRadius: '14px', border: '1px solid #e2eae5' }}>
                <p style={{ margin: 0, color: '#59756e', fontSize: '0.95rem', fontWeight: 600 }}>
                  No appointments scheduled. Visit the <strong>Doctors</strong> directory to schedule a consultation.
                </p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '12px' }}>
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

                  return (
                    <article key={appt.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '16px 20px', borderRadius: '14px', background: '#f5fbf7', border: isApproved ? '1.5px solid #a7f3d0' : '1px solid #e2eae5', flexWrap: 'wrap' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '1.05rem', color: '#171d1b' }}>{docName}</strong>
                          <span style={{ padding: '2px 8px', borderRadius: '999px', fontSize: '0.8rem', fontWeight: 700, background: isApproved ? '#d1fae5' : isPending ? '#fef3c7' : '#e0e7ff', color: isApproved ? '#065f46' : isPending ? '#92400e' : '#3730a3' }}>
                            {isApproved ? '✓ Approved' : isPending ? '⏳ Awaiting Doctor' : 'Completed'}
                          </span>
                        </div>
                        <small style={{ color: '#59756e', fontSize: '0.85rem', display: 'block', marginTop: '4px' }}>
                          🗓 {slotDate} {appt.reason ? `• ${appt.reason}` : ''}
                        </small>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {isApproved && (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveChatAppt(appt)}
                              style={{ padding: '8px 16px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontWeight: 700, fontSize: '0.85rem', border: '1.5px solid #29574b', cursor: 'pointer' }}
                            >
                              💬 Chat
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveVideoAppt({ ...appt, isInitiator: true, autoAccept: false })}
                              style={{ padding: '8px 18px', borderRadius: '999px', background: '#29574b', color: '#00ff88', fontWeight: 800, fontSize: '0.85rem', border: 'none', cursor: 'pointer' }}
                            >
                              📹 Video Call
                            </button>
                          </>
                        )}
                        {isPending && (
                          <span style={{ fontSize: '0.85rem', color: '#92400e', fontWeight: 600, background: '#fef3c7', padding: '6px 12px', borderRadius: '999px' }}>
                            ⏳ Unlocks on approval
                          </span>
                        )}
                        {isCompleted && (
                          <button
                            type="button"
                            onClick={() => setActiveChatAppt(appt)}
                            style={{ padding: '8px 14px', borderRadius: '999px', background: '#eaf3ee', color: '#29574b', fontWeight: 700, fontSize: '0.85rem', border: '1px solid #c4dcd3', cursor: 'pointer' }}
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
