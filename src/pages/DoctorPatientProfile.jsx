import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredUser, logout } from '../api/apiClient.js'
import { getPatientProfile, getVitals, getMedicalHistory, getReports } from '../api/patientApi.js'

function getInitials(name) {
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'PT'
}

function DoctorTopbar({ doctorName }) {
  const navigate = useNavigate()
  return (
    <header className="patient-profile-topbar">
      <div>
        <span onClick={() => navigate('/doctor-patients')} style={{ cursor: 'pointer' }}>
          ← Back to Patients List
        </span>
        <b>▣ Doctor Clinical OPD Workspace</b>
      </div>
      <div>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: '800', fontSize: '0.95rem', flexShrink: 0 }}>
          {getInitials(doctorName)}
        </div>
        <strong>
          {doctorName}
          <small>Attending Physician · OPD Active</small>
        </strong>
        <button type="button" onClick={logout} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '0.45rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '0.95rem' }}>
          Logout
        </button>
      </div>
    </header>
  )
}

function PatientProfileSummary({ profile, patientName }) {
  return (
    <section className="patient-profile-summary">
      <div className="patient-summary-main">
        <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: '800', fontSize: '1.8rem', flexShrink: 0, boxShadow: '0 6px 16px rgba(41,87,75,0.2)' }}>
          {getInitials(patientName)}
        </div>
        <div>
          <h2>{patientName}</h2>
          <span>Active OPD Patient · Verified Identity</span>
          <p>Patient ID: #{profile?.id?.slice(0, 8).toUpperCase() || '99824A12'}</p>
          <div className="summary-tags">
            <b>📱 {profile?.phone ? `+91 ${profile.phone}` : '+91 98765 43210'}</b>
            <b>📧 {profile?.email || 'patient@medimate.org'}</b>
            {profile?.preferred_language && <b>🗣 Language: {profile.preferred_language.toUpperCase()}</b>}
            {profile?.gender && <b>👤 Gender: {profile.gender}</b>}
            {profile?.blood_group && <b>🩸 Blood Group: {profile.blood_group}</b>}
          </div>
        </div>
      </div>

      <div className="summary-status">
        <b>Print Clinical Chart</b>
        <span>↻ Synchronized via<br />ABHA Health Gateway</span>
      </div>

      <div className="summary-facts">
        <div>
          <small>Date of Birth</small>
          <strong>{profile?.dob || '14 Aug 1995'}</strong>
          <span>Age: 31 Years</span>
        </div>
        <div>
          <small>Emergency Contact</small>
          <strong>{profile?.emergency_contact || '+91 98112 34567'}</strong>
          <span>Guardian / Family</span>
        </div>
        <div>
          <small>Primary Location</small>
          <strong>{profile?.address || 'Sector 14, Badshahpur, HR'}</strong>
          <span>Residential District</span>
        </div>
        <div>
          <small>Health Gateway ID</small>
          <strong>ABHA-{profile?.id?.slice(0, 6).toUpperCase() || '883902'}</strong>
          <span>Tier-1 Clinical Profile</span>
        </div>
      </div>
    </section>
  )
}

function DoctorVitalsTelemetry({ vitals, loading }) {
  const latest = vitals[0]
  const items = latest ? [
    ['BLOOD PRESSURE', latest.bp || '120/80', 'Latest Telemetry'],
    ['HEART RATE', latest.hr != null ? `${latest.hr} bpm` : '72 bpm', 'Normal sinus rhythm'],
    ['SPO2 SATURATION', latest.spo2 != null ? `${latest.spo2}%` : '98%', 'Normal'],
    ['BLOOD SUGAR', latest.sugar != null ? `${latest.sugar} mg/dL` : '95 mg/dL', 'Fasting'],
    ['RISK ASSESSMENT', (latest.risk_level || 'low').toUpperCase(), 'Clinical Risk Zone'],
  ] : []

  return (
    <section className="patient-profile-card telemetry-card">
      <header>
        <div>
          <span>♧</span>
          <div>
            <h2>Clinical Vitals &amp; Sensor Telemetry</h2>
            <p>Live sensors &amp; triage intake measurements.</p>
          </div>
        </div>
      </header>
      {loading ? (
        <p style={{ padding: '1rem', opacity: 0.6, fontSize: '0.95rem' }}>Loading patient vitals…</p>
      ) : !latest ? (
        <p style={{ padding: '1rem', opacity: 0.6, fontSize: '0.95rem' }}>No vitals recorded yet for this patient.</p>
      ) : (
        <div className="patient-vitals-grid">
          {items.map(([label, value, status]) => (
            <article key={label}>
              <small>{label}</small>
              <strong>{value}</strong>
              <span>{status}</span>
            </article>
          ))}
        </div>
      )}
      {latest?.recommendation && (
        <p style={{ padding: '0.9rem 1rem', fontSize: '0.95rem', opacity: 0.85, borderTop: '1px solid rgba(0,0,0,0.08)', marginTop: '16px', background: '#effaf6', borderRadius: '10px' }}>
          💡 <strong>Clinical Guidance:</strong> {latest.recommendation}
        </p>
      )}
    </section>
  )
}

function DoctorReports({ reports, loading }) {
  return (
    <section className="patient-profile-card reports-card">
      <header>
        <div>
          <span>▤</span>
          <div>
            <h2>Diagnostic &amp; Lab Reports</h2>
            <p>Uploaded clinical investigations &amp; imaging.</p>
          </div>
        </div>
      </header>
      <div className="report-list">
        {loading ? (
          <p style={{ padding: '1rem', opacity: 0.6, fontSize: '0.95rem' }}>Loading diagnostic reports…</p>
        ) : reports.length === 0 ? (
          <p style={{ padding: '1rem', opacity: 0.6, fontSize: '0.95rem' }}>No lab reports uploaded for this patient yet.</p>
        ) : (
          reports.map((report) => (
            <article key={report.id}>
              <span>▤</span>
              <p>
                <strong>{report.file_name || 'Lab Investigation'}</strong>
                <small>PDF · {report.generated_at ? new Date(report.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}</small>
              </p>
              <a href={report.pdf_url || report.file_url} target="_blank" rel="noopener noreferrer">
                <button type="button">View Report</button>
              </a>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function DoctorTimeline({ history, loading, onAddNote }) {
  return (
    <section className="patient-profile-card longitudinal-card">
      <header>
        <div>
          <span>♧</span>
          <div>
            <h2>Longitudinal Medical History</h2>
            <p>Past encounters, diagnoses &amp; clinical milestones.</p>
          </div>
        </div>
        <button type="button" onClick={onAddNote} style={{ padding: '6px 14px', borderRadius: '999px', background: '#29574b', color: '#00ff88', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>
          + Add Note
        </button>
      </header>
      <div className="patient-timeline">
        {loading ? (
          <p style={{ padding: '1rem', opacity: 0.6, fontSize: '0.95rem' }}>Loading clinical timeline…</p>
        ) : history.length === 0 ? (
          <p style={{ padding: '1rem', opacity: 0.6, fontSize: '0.95rem' }}>No medical history encounters logged yet.</p>
        ) : (
          history.map((entry, index) => (
            <article key={entry.id || index}>
              <i className={index === 0 ? 'current' : ''} />
              <div>
                <header>
                  <strong>{entry.condition || 'OPD Encounter'}</strong>
                  <small>{entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recorded Encounter'}</small>
                </header>
                <p>{entry.notes || 'Clinical evaluation performed.'}</p>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function DoctorCarePathway({ vitals }) {
  const latestVitals = vitals && vitals[0]
  const risk = (latestVitals?.risk_level || 'low').toLowerCase()

  return (
    <section className="patient-profile-card pathway-card">
      <header>
        <span>⌁</span>
        <div>
          <h2>Care Referral Pathway</h2>
          <p>Inter-facility tier coordination &amp; specialist routing.</p>
        </div>
      </header>
      <div className="pathway-block">
        <small>REFERRAL TRACK <b>{risk === 'high' ? 'High Risk Emergency' : risk === 'moderate' ? 'Tier-2 Active' : 'Routine Track'}</b></small>
        <strong>
          {risk === 'high'
            ? 'PHC Badshahpur → District Civil Hospital Emergency'
            : risk === 'moderate'
            ? 'PHC Badshahpur → CHC Tele-Cardiology Consult'
            : 'PHC Badshahpur → General OPD Continuity'}
        </strong>
        <p>
          {latestVitals?.recommendation
            ? latestVitals.recommendation
            : 'Patient telemetry within expected range. Regular OPD follow-up scheduled.'}
        </p>
      </div>
    </section>
  )
}

export default function DoctorPatientProfile() {
  const navigate = useNavigate()
  const doctorUser = getStoredUser()
  const doctorName = doctorUser?.name || 'Dr. Practitioner'
  const selectedPatient = window.sessionStorage.getItem('medimate-doctor-patient') || 'Patient'

  const [profile, setProfile] = useState(null)
  const [vitals, setVitals] = useState([])
  const [vitalsLoading, setVitalsLoading] = useState(true)
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [reports, setReports] = useState([])
  const [reportsLoading, setReportsLoading] = useState(true)

  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [newNoteCondition, setNewNoteCondition] = useState('')
  const [newNoteText, setNewNoteText] = useState('')

  useEffect(() => {
    const dummyId = doctorUser?.id || 'demo-patient-id'
    getPatientProfile(dummyId).then((p) => { if (p) setProfile(p) }).catch(() => {})
    getVitals(dummyId).then(setVitals).catch(() => setVitals([])).finally(() => setVitalsLoading(false))
    getMedicalHistory(dummyId).then(setHistory).catch(() => setHistory([])).finally(() => setHistoryLoading(false))
    getReports(dummyId).then(setReports).catch(() => setReports([])).finally(() => setReportsLoading(false))
  }, [doctorUser?.id])

  const handleAddNoteSubmit = (e) => {
    e.preventDefault()
    if (!newNoteText.trim()) return
    const newEntry = {
      id: 'note_' + Date.now(),
      condition: newNoteCondition.trim() || 'Attending Physician Note',
      notes: newNoteText.trim(),
      created_at: new Date().toISOString(),
    }
    setHistory((prev) => [newEntry, ...prev])
    setNewNoteCondition('')
    setNewNoteText('')
    setNoteModalOpen(false)
    alert('Clinical note added to patient timeline successfully!')
  }

  return (
    <div className="patient-profile-page" style={{ minHeight: '100vh', background: '#f5fbf7' }}>
      <main className="patient-profile-workspace" style={{ width: '100%' }}>
        <DoctorTopbar doctorName={doctorName} />

        <div className="patient-profile-content">
          <div className="patient-breadcrumb">DOCTOR PORTAL / PATIENT CLINICAL FILE / {selectedPatient.toUpperCase()}</div>

          <div className="patient-title-row">
            <div>
              <h1>Patient Clinical File &amp;<br />Health Profile</h1>
              <p>Comprehensive health history, telemetry vitals, diagnostic reports, and care referral management.</p>
            </div>
            <div>
              <button type="button" onClick={() => setNoteModalOpen(true)} style={{ background: '#29574b', color: '#00ff88', borderColor: '#29574b' }}>
                + Clinical Note
              </button>
              <button type="button" onClick={() => alert(`Referral initiated for ${selectedPatient} to Tier-3 General Hospital.`)}>
                ↗ Refer Patient
              </button>
              <button type="button" onClick={() => navigate('/doctor-patients')}>
                ← Back to List
              </button>
            </div>
          </div>

          <PatientProfileSummary profile={profile} patientName={selectedPatient} />

          <div className="patient-profile-columns">
            <div>
              <DoctorVitalsTelemetry vitals={vitals} loading={vitalsLoading} />
              <DoctorTimeline history={history} loading={historyLoading} onAddNote={() => setNoteModalOpen(true)} />
            </div>
            <div>
              <DoctorReports reports={reports} loading={reportsLoading} />
              <DoctorCarePathway vitals={vitals} />
            </div>
          </div>
        </div>
      </main>

      {noteModalOpen && (
        <div className="patient-modal-overlay">
          <div className="patient-modal-content">
            <div className="patient-modal-header">
              <h2>Add Physician Clinical Note</h2>
              <button type="button" onClick={() => setNoteModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleAddNoteSubmit}>
              <div className="patient-modal-field" style={{ marginBottom: '16px' }}>
                <label>Diagnosis / Clinical Condition</label>
                <input
                  type="text"
                  value={newNoteCondition}
                  onChange={(e) => setNewNoteCondition(e.target.value)}
                  placeholder="e.g. Essential Hypertension / Follow-up evaluation"
                />
              </div>
              <div className="patient-modal-field full">
                <label>Physician Assessment &amp; Treatment Plan</label>
                <textarea
                  rows="4"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Enter detailed clinical observation, prescription modifications, or instructions..."
                  required
                />
              </div>
              <div className="patient-modal-actions">
                <button type="button" onClick={() => setNoteModalOpen(false)}>Cancel</button>
                <button type="submit">Save Clinical Note</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
