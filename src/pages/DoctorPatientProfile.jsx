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
    <header className="h-[68px] flex items-center justify-between px-4 md:px-8 border-b border-[#e2eae5] bg-white sticky top-0 z-[10]">
      <div className="flex items-center gap-4">
        <span onClick={() => navigate('/doctor-patients')} className="cursor-pointer text-[#29574b] font-bold text-sm hidden md:inline">
          ← Back to Patients List
        </span>
        <b className="text-[#171d1b] font-bold text-sm">▣ Doctor Clinical OPD Workspace</b>
      </div>
      <div className="flex items-center gap-2 md:gap-3">
        <div className="w-[38px] h-[38px] rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-extrabold text-[0.95rem] shrink-0">
          {getInitials(doctorName)}
        </div>
        <strong className="hidden md:flex flex-col text-[#171d1b] text-sm">
          {doctorName}
          <small className="font-normal text-[#59756e] text-xs">Attending Physician · OPD Active</small>
        </strong>
        <button type="button" onClick={logout} className="bg-[#c0392b] text-white border-0 py-[0.45rem] px-4 rounded-lg cursor-pointer font-bold text-[0.95rem] ml-2">
          Logout
        </button>
      </div>
    </header>
  )
}

function PatientProfileSummary({ profile, patientName }) {
  return (
    <section className="bg-white rounded-2xl p-6 border border-[#e2eae5] shadow-sm mb-6 flex flex-col lg:flex-row gap-6 justify-between items-start">
      <div className="flex items-center gap-5">
        <div className="w-[80px] h-[80px] rounded-full bg-[#29574b] text-[#00ff88] grid place-items-center font-extrabold text-[1.8rem] shrink-0 shadow-[0_6px_16px_rgba(41,87,75,0.2)]">
          {getInitials(patientName)}
        </div>
        <div>
          <h2 className="m-0 text-3xl font-['Playfair_Display',serif] text-[#171d1b]">{patientName}</h2>
          <span className="text-sm font-semibold text-[#59756e] block mt-1">Active OPD Patient · Verified Identity</span>
          <p className="m-0 mt-1 text-sm text-[#404845]">Patient ID: #{profile?.id?.slice(0, 8).toUpperCase() || '99824A12'}</p>
          <div className="flex flex-wrap gap-2 mt-3">
            <b className="px-2.5 py-1 rounded-md bg-[#f5fbf7] text-[#29574b] text-xs font-bold border border-[#dcece5]">📱 {profile?.phone ? `+91 ${profile.phone}` : '+91 98765 43210'}</b>
            <b className="px-2.5 py-1 rounded-md bg-[#f5fbf7] text-[#29574b] text-xs font-bold border border-[#dcece5]">📧 {profile?.email || 'patient@SwasthyaSahay.org'}</b>
            {profile?.preferred_language && <b className="px-2.5 py-1 rounded-md bg-[#f5fbf7] text-[#29574b] text-xs font-bold border border-[#dcece5]">🗣 Language: {profile.preferred_language.toUpperCase()}</b>}
            {profile?.gender && <b className="px-2.5 py-1 rounded-md bg-[#f5fbf7] text-[#29574b] text-xs font-bold border border-[#dcece5]">👤 Gender: {profile.gender}</b>}
            {profile?.blood_group && <b className="px-2.5 py-1 rounded-md bg-[#fef3c7] text-[#92400e] text-xs font-bold border border-[#fde68a]">🩸 Blood Group: {profile.blood_group}</b>}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 w-full lg:w-auto">
        <div className="flex items-center justify-between lg:justify-end gap-4 p-3 rounded-xl bg-[#eaf3ee] border border-[#dcece5]">
          <b className="text-sm text-[#29574b] cursor-pointer">Print Clinical Chart</b>
          <span className="text-xs text-[#59756e] text-right font-semibold leading-tight">↻ Synchronized via<br />ABHA Health Gateway</span>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-[#fafdfb] p-4 rounded-xl border border-[#e2eae5]">
          <div className="flex flex-col">
            <small className="text-[0.7rem] text-[#59756e] font-bold uppercase tracking-wide">Date of Birth</small>
            <strong className="text-[#171d1b] text-sm mt-0.5">{profile?.dob || '14 Aug 1995'}</strong>
            <span className="text-[#59756e] text-[0.75rem]">Age: 31 Years</span>
          </div>
          <div className="flex flex-col">
            <small className="text-[0.7rem] text-[#59756e] font-bold uppercase tracking-wide">Emergency Contact</small>
            <strong className="text-[#171d1b] text-sm mt-0.5">{profile?.emergency_contact || '+91 98112 34567'}</strong>
            <span className="text-[#59756e] text-[0.75rem]">Guardian / Family</span>
          </div>
          <div className="flex flex-col">
            <small className="text-[0.7rem] text-[#59756e] font-bold uppercase tracking-wide">Primary Location</small>
            <strong className="text-[#171d1b] text-sm mt-0.5">{profile?.address || 'Sector 14, Badshahpur, HR'}</strong>
            <span className="text-[#59756e] text-[0.75rem]">Residential District</span>
          </div>
          <div className="flex flex-col">
            <small className="text-[0.7rem] text-[#59756e] font-bold uppercase tracking-wide">Health Gateway ID</small>
            <strong className="text-[#171d1b] text-sm mt-0.5">ABHA-{profile?.id?.slice(0, 6).toUpperCase() || '883902'}</strong>
            <span className="text-[#59756e] text-[0.75rem]">Tier-1 Clinical Profile</span>
          </div>
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
    <section className="bg-white rounded-2xl p-5 border border-[#e2eae5] shadow-sm mb-5">
      <header className="mb-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl text-[#29574b] leading-none">♧</span>
          <div>
            <h2 className="m-0 text-xl font-['Playfair_Display',serif] text-[#171d1b] font-bold">Clinical Vitals &amp; Sensor Telemetry</h2>
            <p className="m-0 mt-1 text-sm text-[#59756e]">Live sensors &amp; triage intake measurements.</p>
          </div>
        </div>
      </header>
      {loading ? (
        <p className="p-4 opacity-60 text-[0.95rem]">Loading patient vitals…</p>
      ) : !latest ? (
        <p className="p-4 opacity-60 text-[0.95rem]">No vitals recorded yet for this patient.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items.map(([label, value, status]) => (
            <article key={label} className="bg-[#f5fbf7] p-3 rounded-xl border border-[#dcece5] flex flex-col">
              <small className="text-[0.7rem] text-[#59756e] font-bold uppercase tracking-wide">{label}</small>
              <strong className="text-xl font-['Playfair_Display',serif] text-[#171d1b] mt-1">{value}</strong>
              <span className="text-[#404845] text-xs font-semibold mt-1">{status}</span>
            </article>
          ))}
        </div>
      )}
      {latest?.recommendation && (
        <p className="px-4 py-3.5 text-[0.95rem] opacity-85 border-t border-[rgba(0,0,0,0.08)] mt-4 bg-[#effaf6] rounded-[10px] m-0">
          💡 <strong className="text-[#171d1b]">Clinical Guidance:</strong> {latest.recommendation}
        </p>
      )}
    </section>
  )
}

function DoctorReports({ reports, loading }) {
  return (
    <section className="bg-white rounded-2xl p-5 border border-[#e2eae5] shadow-sm mb-5">
      <header className="mb-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl text-[#29574b] leading-none">▤</span>
          <div>
            <h2 className="m-0 text-xl font-['Playfair_Display',serif] text-[#171d1b] font-bold">Diagnostic &amp; Lab Reports</h2>
            <p className="m-0 mt-1 text-sm text-[#59756e]">Uploaded clinical investigations &amp; imaging.</p>
          </div>
        </div>
      </header>
      <div className="flex flex-col gap-3">
        {loading ? (
          <p className="p-4 opacity-60 text-[0.95rem]">Loading diagnostic reports…</p>
        ) : reports.length === 0 ? (
          <p className="p-4 opacity-60 text-[0.95rem]">No lab reports uploaded for this patient yet.</p>
        ) : (
          reports.map((report) => (
            <article key={report.id} className="flex items-center gap-3 p-3 rounded-xl bg-[#fafdfb] border border-[#e2eae5]">
              <span className="text-xl text-[#59756e]">▤</span>
              <p className="m-0 flex flex-col flex-1">
                <strong className="text-sm text-[#171d1b]">{report.file_name || 'Lab Investigation'}</strong>
                <small className="text-xs text-[#59756e]">PDF · {report.generated_at ? new Date(report.generated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recent'}</small>
              </p>
              <a href={report.pdf_url || report.file_url} target="_blank" rel="noopener noreferrer" className="no-underline">
                <button type="button" className="px-3 py-1.5 bg-[#eaf3ee] text-[#29574b] border border-[#29574b] rounded-lg text-xs font-bold cursor-pointer">View Report</button>
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
    <section className="bg-white rounded-2xl p-5 border border-[#e2eae5] shadow-sm mb-5">
      <header className="flex justify-between items-start mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl text-[#29574b] leading-none">♧</span>
          <div>
            <h2 className="m-0 text-xl font-['Playfair_Display',serif] text-[#171d1b] font-bold">Longitudinal Medical History</h2>
            <p className="m-0 mt-1 text-sm text-[#59756e]">Past encounters, diagnoses &amp; clinical milestones.</p>
          </div>
        </div>
        <button type="button" onClick={onAddNote} className="px-3.5 py-1.5 rounded-full bg-[#29574b] text-[#00ff88] border-0 cursor-pointer font-bold text-[0.85rem] shrink-0">
          + Add Note
        </button>
      </header>
      <div className="relative pl-4 border-l-2 border-[#e2eae5] ml-2 flex flex-col gap-6">
        {loading ? (
          <p className="p-4 opacity-60 text-[0.95rem]">Loading clinical timeline…</p>
        ) : history.length === 0 ? (
          <p className="p-4 opacity-60 text-[0.95rem]">No medical history encounters logged yet.</p>
        ) : (
          history.map((entry, index) => (
            <article key={entry.id || index} className="relative">
              <i className={`absolute -left-[23px] top-1 w-3 h-3 rounded-full bg-white border-[3px] border-[#dcece5] ${index === 0 ? 'border-[#29574b] bg-[#00ff88]' : ''}`} />
              <div>
                <header className="flex flex-col mb-1.5">
                  <strong className="text-base text-[#171d1b] font-bold">{entry.condition || 'OPD Encounter'}</strong>
                  <small className="text-xs text-[#59756e] font-semibold">{entry.created_at ? new Date(entry.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Recorded Encounter'}</small>
                </header>
                <p className="m-0 text-sm text-[#404845] leading-relaxed p-3 bg-[#fafdfb] border border-[#e2eae5] rounded-xl">{entry.notes || 'Clinical evaluation performed.'}</p>
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
    <section className="bg-white rounded-2xl p-5 border border-[#e2eae5] shadow-sm mb-5">
      <header className="mb-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl text-[#29574b] leading-none">⌁</span>
          <div>
            <h2 className="m-0 text-xl font-['Playfair_Display',serif] text-[#171d1b] font-bold">Care Referral Pathway</h2>
            <p className="m-0 mt-1 text-sm text-[#59756e]">Inter-facility tier coordination &amp; specialist routing.</p>
          </div>
        </div>
      </header>
      <div className={`p-4 rounded-xl border ${risk === 'high' ? 'bg-[#fef2f2] border-[#fecaca]' : risk === 'moderate' ? 'bg-[#fffbeb] border-[#fde68a]' : 'bg-[#f0fdf4] border-[#bbf7d0]'}`}>
        <small className={`text-[0.7rem] font-bold uppercase tracking-wide block mb-2 ${risk === 'high' ? 'text-[#991b1b]' : risk === 'moderate' ? 'text-[#92400e]' : 'text-[#166534]'}`}>
          REFERRAL TRACK <b className="ml-1 opacity-80">{risk === 'high' ? 'High Risk Emergency' : risk === 'moderate' ? 'Tier-2 Active' : 'Routine Track'}</b>
        </small>
        <strong className={`block text-lg font-['Playfair_Display',serif] font-bold leading-tight ${risk === 'high' ? 'text-[#7f1d1d]' : risk === 'moderate' ? 'text-[#78350f]' : 'text-[#14532d]'}`}>
          {risk === 'high'
            ? 'PHC Badshahpur → District Civil Hospital Emergency'
            : risk === 'moderate'
            ? 'PHC Badshahpur → CHC Tele-Cardiology Consult'
            : 'PHC Badshahpur → General OPD Continuity'}
        </strong>
        <p className={`m-0 mt-2 text-sm ${risk === 'high' ? 'text-[#991b1b]' : risk === 'moderate' ? 'text-[#92400e]' : 'text-[#166534]'}`}>
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
  const selectedPatient = window.sessionStorage.getItem('SwasthyaSahay-doctor-patient') || 'Patient'

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
    <div className="min-h-screen bg-[#f5fbf7] font-sans">
      <main className="w-full">
        <DoctorTopbar doctorName={doctorName} />

        <div className="w-full max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-8 pb-16">
          <div className="text-[#29574b] text-xs font-bold uppercase tracking-widest mb-4">DOCTOR PORTAL / PATIENT CLINICAL FILE / {selectedPatient.toUpperCase()}</div>

          <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 gap-4">
            <div>
              <h1 className="text-4xl font-['Playfair_Display',serif] text-[#171d1b] font-bold m-0 leading-tight">Patient Clinical File &amp;<br />Health Profile</h1>
              <p className="text-[#59756e] mt-2 text-base">Comprehensive health history, telemetry vitals, diagnostic reports, and care referral management.</p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <button type="button" onClick={() => setNoteModalOpen(true)} className="px-4.5 py-2.5 rounded-full bg-[#29574b] text-[#00ff88] border border-[#29574b] font-bold text-[0.92rem] cursor-pointer">
                + Clinical Note
              </button>
              <button type="button" onClick={() => alert(`Referral initiated for ${selectedPatient} to Tier-3 General Hospital.`)} className="px-4.5 py-2.5 rounded-full bg-white text-[#29574b] border border-[#dcece5] font-bold text-[0.92rem] cursor-pointer">
                ↗ Refer Patient
              </button>
              <button type="button" onClick={() => navigate('/doctor-patients')} className="px-4.5 py-2.5 rounded-full bg-[#fef2f2] text-[#991b1b] border-0 font-bold text-[0.92rem] cursor-pointer md:hidden">
                ← Back
              </button>
            </div>
          </div>

          <PatientProfileSummary profile={profile} patientName={selectedPatient} />

          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
            <div className="flex flex-col">
              <DoctorVitalsTelemetry vitals={vitals} loading={vitalsLoading} />
              <DoctorTimeline history={history} loading={historyLoading} onAddNote={() => setNoteModalOpen(true)} />
            </div>
            <div className="flex flex-col">
              <DoctorReports reports={reports} loading={reportsLoading} />
              <DoctorCarePathway vitals={vitals} />
            </div>
          </div>
        </div>
      </main>

      {noteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(15,28,24,0.4)] backdrop-blur-sm">
          <div className="bg-white rounded-[24px] w-full max-w-[500px] shadow-xl overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-[#e2eae5] flex justify-between items-center">
              <h2 className="m-0 text-xl font-['Playfair_Display',serif] text-[#171d1b] font-bold">Add Physician Clinical Note</h2>
              <button type="button" onClick={() => setNoteModalOpen(false)} className="w-8 h-8 rounded-full border-0 bg-[#f5fbf7] text-[#59756e] font-bold text-lg cursor-pointer flex items-center justify-center hover:bg-[#e2eae5]">×</button>
            </div>
            <form onSubmit={handleAddNoteSubmit} className="p-6 flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#404845]">Diagnosis / Clinical Condition</label>
                <input
                  type="text"
                  value={newNoteCondition}
                  onChange={(e) => setNewNoteCondition(e.target.value)}
                  placeholder="e.g. Essential Hypertension / Follow-up evaluation"
                  className="px-4 py-3 rounded-xl border border-[#dcece5] bg-[#fafdfb] text-[#171d1b] font-medium focus:outline-none focus:border-[#29574b]"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-sm font-bold text-[#404845]">Physician Assessment &amp; Treatment Plan</label>
                <textarea
                  rows="4"
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  placeholder="Enter detailed clinical observation, prescription modifications, or instructions..."
                  required
                  className="px-4 py-3 rounded-xl border border-[#dcece5] bg-[#fafdfb] text-[#171d1b] font-medium resize-none focus:outline-none focus:border-[#29574b]"
                />
              </div>
              <div className="flex gap-3 mt-2">
                <button type="button" onClick={() => setNoteModalOpen(false)} className="flex-1 py-3 rounded-xl border border-[#dcece5] bg-transparent text-[#59756e] font-bold cursor-pointer">Cancel</button>
                <button type="submit" className="flex-[2] py-3 rounded-xl border-0 bg-[#29574b] text-[#00ff88] font-bold cursor-pointer">Save Clinical Note</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
