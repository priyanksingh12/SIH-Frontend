import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getStoredUser } from '../api/apiClient.js'
import { saveVitals, addMedicalHistory } from '../api/patientApi.js'

const inputFields = [
  ['bloodPressure', 'Blood Pressure', '120/80', 'mmHg', 'Target: below 120/80'],
  ['bloodSugar', 'Blood Sugar (Fasting)', '95', 'mg/dL', 'Normal: 70–140'],
  ['spo2', 'SpO2', '98', '%', 'Normal: 95–100%'],
  ['heartRate', 'Heart Rate', '72', 'bpm', 'Normal: 60–100'],
  ['weight', 'Weight', '70', 'kg', ''],
  ['height', 'Height', '175', 'cm', ''],
  ['temperature', 'Temperature', '36.5', '°C', ''],
]

function InputField({ field, value, onChange }) {
  const [name, label, placeholder, unit, helper] = field
  return (
    <label className="vitals-field">
      <span>{label}</span>
      <div className="vitals-input-wrap">
        <input name={name} value={value} placeholder={placeholder} onChange={onChange} inputMode="decimal" />
        <b>{unit}</b>
      </div>
      {helper && <small>{helper}</small>}
    </label>
  )
}

export default function Vitals() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const patientId = user?.id
  const isDoctor = user?.role === 'doctor' || window.localStorage.getItem('medimate-account-role') === 'doctor'
  const dashPath = isDoctor ? '/doctor-dashboard' : '/patient-dashboard'

  const [form, setForm] = useState(
    Object.fromEntries(inputFields.map(([name, , placeholder]) => [name, placeholder]))
  )
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [savedVitals, setSavedVitals] = useState(null)

  // Medical History state
  const [medConditions, setMedConditions] = useState('')
  const [medSurgeries, setMedSurgeries] = useState('')
  const [hadTyphoid, setHadTyphoid] = useState(false)
  const [hadMalaria, setHadMalaria] = useState(false)
  const [doctorNotes, setDoctorNotes] = useState('')

  const updateField = (event) => setForm({ ...form, [event.target.name]: event.target.value })

  // Single combined handler: saves vitals AND medical history, then shows the
  // "Your vitals are saved" confirmation screen — same behavior the old
  // standalone "Save Vitals" button used to have.
  const finish = async (event) => {
    event.preventDefault()

    const formElement = event.target
    const dateVal = formElement.querySelector('input[type="date"]')?.value
    const timeVal = formElement.querySelector('input[type="time"]')?.value
    const notesVal = formElement.querySelector('textarea[name="vitalsNotes"]')?.value

    const recordTime = (dateVal && timeVal)
      ? new Date(`${dateVal}T${timeVal}`).toISOString()
      : new Date().toISOString()

    const newRecord = {
      id: 'vitals_' + Date.now(),
      bp: form.bloodPressure || '118/76',
      sugar: Number(form.bloodSugar) || 92,
      spo2: Number(form.spo2) || 98,
      hr: Number(form.heartRate) || 72,
      weight: form.weight ? Number(form.weight) : undefined,
      height: form.height ? Number(form.height) : undefined,
      temperature: form.temperature ? Number(form.temperature) : undefined,
      notes: notesVal || '',
      created_at: recordTime,
    }

    const history = JSON.parse(window.localStorage.getItem('medimate-vitals-history') || '[]')
    history.unshift(newRecord)
    window.localStorage.setItem('medimate-vitals-history', JSON.stringify(history))

    // Always save medical history to localStorage FIRST (works in guest mode too,
    // and ensures the Profile page can read the latest data even if the API fails).
    const conditions = medConditions.split(',').map((s) => s.trim()).filter(Boolean)
    const surgeries = medSurgeries.split(',').map((s) => s.trim()).filter(Boolean)
    const medHistoryPayload = {
      conditions,
      surgeries,
      had_typhoid: hadTyphoid,
      had_malaria: hadMalaria,
      doctor_notes: doctorNotes,
    }
    const medHistoryLocal = JSON.parse(window.localStorage.getItem('medimate-medical-history') || '[]')
    medHistoryLocal.unshift({ ...medHistoryPayload, created_at: new Date().toISOString() })
    window.localStorage.setItem('medimate-medical-history', JSON.stringify(medHistoryLocal))

    if (!patientId) {
      // Guest mode: local save already done above.
      window.localStorage.setItem('medimate-vitals-complete', 'true')
      setSaved(true)
      return
    }

    setError('')
    setLoading(true)
    try {
      const result = await saveVitals(patientId, {
        bp: form.bloodPressure,
        sugar: Number(form.bloodSugar),
        spo2: Number(form.spo2),
        hr: Number(form.heartRate),
        weight: form.weight ? Number(form.weight) : undefined,
        height: form.height ? Number(form.height) : undefined,
        temperature: form.temperature ? Number(form.temperature) : undefined,
        notes: notesVal,
      })
      if (result?.vitals) {
        setSavedVitals(result.vitals)
      }

      await addMedicalHistory(patientId, { conditions, surgeries, had_typhoid: hadTyphoid, had_malaria: hadMalaria, doctor_notes: doctorNotes })

      window.localStorage.setItem('medimate-vitals-complete', 'true')
      setSaved(true)
    } catch (err) {
      setError(err.message || 'Failed to save vitals and medical history. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (saved) {
    return (
      <div className="vitals-saved">
        <div>
          <span>✓</span>
          <h1>Your vitals are saved.</h1>
          {savedVitals?.risk_level && (
            <p style={{ fontSize: '1.2rem', margin: '0.75rem 0' }}>
              Risk level: <strong>{savedVitals.risk_level}</strong>
            </p>
          )}
          {savedVitals?.recommendation && (
            <p style={{ fontSize: '1.05rem', opacity: 0.85, marginTop: '0.5rem' }}>
              {savedVitals.recommendation}
            </p>
          )}
          <p style={{ fontSize: '1.1rem' }}>We&apos;ll use them to personalize your health journey.</p>
          <button onClick={() => navigate('/patient-dashboard')} style={{ fontSize: '1.1rem', padding: '16px 32px' }}>
            View your dashboard →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="vitals-page" style={{ justifyContent: 'center' }}>
      <main className="vitals-main" style={{ width: '100%', maxWidth: '840px', margin: '0 auto', padding: '40px 24px' }}>
        <div className="vitals-content" style={{ width: '100%', padding: 0 }}>
          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'flex-start' }}>
            <button
              type="button"
              onClick={() => navigate(dashPath)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                borderRadius: '999px',
                border: '1px solid #c4dcd3',
                background: '#eaf3ee',
                color: '#29574b',
                fontWeight: 700,
                fontSize: '0.95rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              ← Back to Dashboard
            </button>
          </div>
          <header className="vitals-header" style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h1 style={{ fontSize: '3.2rem', fontWeight: 700, margin: 0 }}>Add Vitals</h1>
            <p style={{ fontSize: '1.25rem', marginTop: '10px', color: '#404845' }}>
              Keep your health information up to date.
            </p>
          </header>

          {/* Single combined form: Vitals section immediately followed by
              Medical History section, with one submit button at the end. */}
          <form className="vitals-form" onSubmit={finish} style={{ padding: '44px' }}>
            <div className="vitals-fields">
              {inputFields.map((field) => (
                <InputField
                  field={field}
                  value={form[field[0]]}
                  onChange={updateField}
                  key={field[0]}
                />
              ))}
            </div>

            <div className="vitals-extra-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <label>
                <span>Date</span>
                <input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
              </label>
              <label>
                <span>Time</span>
                <input type="time" defaultValue={new Date().toTimeString().slice(0, 5)} />
              </label>
            </div>

            <label className="vitals-notes">
              <span>Notes (Optional)</span>
              <textarea name="vitalsNotes" placeholder="How were you feeling before taking these measurements?" />
            </label>

            {/* Medical History section — now directly follows the Vitals section */}

            <div style={{ width: '100%', gridColumn: '1 / -1', alignSelf: 'stretch', marginTop: '40px', paddingTop: '32px', borderTop: '1px solid #e2eae5' }}>
              <div style={{ width: '100%', marginBottom: '24px' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>Medical History</h2>
                <p style={{ fontSize: '1.05rem', color: '#526e67', marginTop: '8px' }}>
                  Record your past conditions, surgeries, and disease history.
                </p>
              </div>

                            <div className="vitals-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', width: '100%' }}>
                <label className="vitals-field">
                  <span>Conditions <small style={{ fontWeight: 400, color: '#526e67' }}>(comma-separated)</small></span>
                  <div className="vitals-input-wrap">
                    <input
                      value={medConditions}
                      onChange={(e) => setMedConditions(e.target.value)}
                      placeholder="e.g. Diabetes Type 2, Hypertension"
                    />
                  </div>
                </label>

                <label className="vitals-field">
                  <span>Previous Surgeries <small style={{ fontWeight: 400, color: '#526e67' }}>(comma-separated)</small></span>
                  <div className="vitals-input-wrap">
                    <input
                      value={medSurgeries}
                      onChange={(e) => setMedSurgeries(e.target.value)}
                      placeholder="e.g. Appendectomy, Knee Replacement"
                    />
                  </div>
                </label>
              </div>
              
              <div className="vitals-extra-fields" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, fontSize: '1.05rem', color: '#171d1b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hadTyphoid}
                    onChange={(e) => setHadTyphoid(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: '#29574b', cursor: 'pointer' }}
                  />
                  Had Typhoid
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, fontSize: '1.05rem', color: '#171d1b', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={hadMalaria}
                    onChange={(e) => setHadMalaria(e.target.checked)}
                    style={{ width: '20px', height: '20px', accentColor: '#29574b', cursor: 'pointer' }}
                  />
                  Had Malaria
                </label>
              </div>

              <label className="vitals-notes" style={{ marginTop: '20px' }}>
                <span>Doctor Notes <small style={{ fontWeight: 400, color: '#526e67' }}>(Optional)</small></span>
                <textarea
                  value={doctorNotes}
                  onChange={(e) => setDoctorNotes(e.target.value)}
                  placeholder="e.g. Advised diet control, follow-up in 3 months"
                />
              </label>
            </div>

            {error && (
              <p className="signup-error" role="alert" style={{ margin: '20px 0 0.5rem', fontSize: '1rem' }}>
                {error}
              </p>
            )}

            <div className="vitals-form-actions" style={{ marginTop: '12px' }}>
              <button type="button" onClick={() => window.location.reload()} style={{ fontSize: '1.1rem', padding: '12px 24px' }}>
                Cancel
              </button>
              <button className="save-vitals" type="submit" disabled={loading} style={{ fontSize: '1.2rem', padding: '16px 36px', color: '#00ff88', fontWeight: 800 }}>
                {loading ? 'Saving…' : 'Save Medical History'} {!loading && <span>→</span>}
              </button>
            </div>
          </form>

          {/* Section 1: Your readings, at a glance */}
          <section className="recent-readings" style={{ marginTop: '56px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 700, margin: 0 }}>Your readings, at a glance</h2>
              <p style={{ fontSize: '1.2rem', color: '#526e67', marginTop: '8px' }}>
                A unified snapshot across all tracked metrics.
              </p>
            </div>

            <div className="reading-grid">
              <article>
                <span>BLOOD PRESSURE</span>
                <strong>118/76 <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#404845' }}>mmHg</span></strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <small>Healthy</small>
                  <em>Last 30 days</em>
                </div>
              </article>

              <article>
                <span>BLOOD SUGAR</span>
                <strong>92 <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#404845' }}>mg/dL</span></strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <small>Stable</small>
                  <em>Last 30 days</em>
                </div>
              </article>

              <article>
                <span>SPO2</span>
                <strong>98%</strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <small>Optimal</small>
                  <em>Last 30 days</em>
                </div>
              </article>

              <article>
                <span>HEART RATE</span>
                <strong>72 <span style={{ fontSize: '1.1rem', fontWeight: 500, color: '#404845' }}>bpm</span></strong>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                  <small>Improving</small>
                  <em>Last 30 days</em>
                </div>
              </article>
            </div>
          </section>

          {/* Section 2: What your readings tell us */}
          <section className="health-insights" style={{ marginTop: '56px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: '24px' }}>What your readings tell us</h2>
            <div>
              <article>
                <span>🫀</span>
                <div>
                  <b>BLOOD PRESSURE</b>
                  <p>118/76 mmHg is within the optimal range. Keep maintaining your routine!</p>
                </div>
              </article>

              <article>
                <span>🩸</span>
                <div>
                  <b>BLOOD SUGAR</b>
                  <p>Fasting blood sugar of 92 mg/dL shows good glycemic control.</p>
                </div>
              </article>

              <article>
                <span>🌿</span>
                <div>
                  <b>OVERALL VITALITY</b>
                  <p>Your combined vitals indicate a healthy recovery trajectory.</p>
                </div>
              </article>
            </div>
          </section>

          {/* Section 3: Every reading helps us understand the bigger picture */}
          <section className="health-risk" style={{ marginTop: '56px' }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={{ fontSize: '2.2rem', fontWeight: 700, margin: 0 }}>Every reading helps us understand the bigger picture</h2>
              <p style={{ fontSize: '1.2rem', color: '#526e67', marginTop: '8px' }}>
                How your vitals power personalized care.
              </p>
            </div>

            <div className="risk-summary">
              <div className="risk-steps">
                <span>
                  New Vitals
                  <b>STEP 1</b>
                </span>
                <i>→</i>
                <span>
                  Health Analysis
                  <b>STEP 2</b>
                </span>
                <i>→</i>
                <span>
                  Risk Score
                  <b>STEP 3</b>
                </span>
                <i>→</i>
                <span>
                  Next Step
                  <b>STEP 4</b>
                </span>
              </div>

              <div className="risk-score">
                <small>Health Risk Score</small>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '6px 0' }}>
                  <strong>85</strong>
                  <span>Low Risk</span>
                </div>
                <a href="#risk" onClick={(e) => e.preventDefault()}>View health risk →</a>
              </div>
            </div>
          </section>

          {/* Section 4 & 5: What happens next? & Keep tracking regularly */}
          <section className="next-steps" style={{ marginTop: '56px' }}>
            <h2 style={{ fontSize: '2.2rem', fontWeight: 700, marginBottom: '24px' }}>What happens next?</h2>
            <div className="next-step-grid">
              {[
                ['01', 'Recorded', 'Your vitals are securely logged in your personal health chart, ensuring an accurate historical record.'],
                ['02', 'Checked', 'Our automated systems compare your new readings against your baseline and clinical guidelines.'],
                ['03', 'Updated', 'Your health score and personalized recommendations are refreshed to reflect your current status.'],
              ].map(([number, title, text]) => (
                <article key={number}>
                  <strong>{number}</strong>
                  <b>{title}</b>
                  <p>{text}</p>
                </article>
              ))}
            </div>

            <div className="tracking-note">
              <div>
                <b>Keep tracking regularly</b>
                <span>Consistent monitoring builds a clearer picture of your health journey.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.localStorage.setItem('medimate-vitals-complete', 'true')
                  navigate('/patient-dashboard')
                }}
              >
                View My Health <span>→</span>
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}