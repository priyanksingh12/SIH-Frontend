import { useMemo, useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getFacilities } from '../api/facilityApi.js'
import { registerDoctor } from '../api/doctorApi.js'
import { getStoredUser } from '../api/apiClient.js'

function DoctorSidebar() {
  const links = ['Dashboard', 'Patients', 'Appointments', 'Vitals & History', 'My Profile']
  const icons = ['⌂', '♧', '▣', '≋', '◎']
  return (
    <aside className="doctor-sidebar">
      <div className="doctor-suite-brand">
        <span>＋</span>
        <div>
          <strong>MediMate</strong>
          <small>CLINICAL SUITE</small>
        </div>
      </div>
      <div className="doctor-identity">
        <span>DR</span>
        <div>
          <b>Dr. {getStoredUser()?.name || 'Doctor'}</b>
          <small>Cardiology • Attending</small>
        </div>
        <i />
      </div>
      <button className="doctor-consult">＋ New Consultation</button>
      <nav>
        {links.map((link, idx) => (
          <Link
            className={link === 'Dashboard' ? 'active' : ''}
            to={link === 'Patients' ? '/doctor-patients' : '/doctor-dashboard'}
            key={link}
          >
            <span>{icons[idx]}</span>
            {link}
          </Link>
        ))}
      </nav>
    </aside>
  )
}

export default function DoctorInfo() {
  const navigate = useNavigate()
  const [facilities, setFacilities] = useState([])
  const [loadingFacilities, setLoadingFacilities] = useState(true)
  const [medicalId, setMedicalId] = useState('')
  const [specialization, setSpecialization] = useState('')
  const [qualification, setQualification] = useState('MBBS')
  const [experienceYears, setExperienceYears] = useState('')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getFacilities()
      .then(setFacilities)
      .catch(() => setFacilities([]))
      .finally(() => setLoadingFacilities(false))
  }, [])

  const filteredFacilities = useMemo(
    () => facilities.filter((f) => `${f.name} ${f.type || ''} ${f.location || ''}`.toLowerCase().includes(query.toLowerCase())),
    [query, facilities]
  )

  const activeFacility = selected !== null ? facilities.find((f) => f.id === selected) : null

  const finish = async (event) => {
    event.preventDefault()
    if (!medicalId.trim() || !activeFacility) return setError('Add your medical registration number and select a facility.')
    if (!specialization.trim()) return setError('Please enter your specialization.')
    setError('')
    setLoading(true)
    try {
      await registerDoctor({
        specialization,
        qualification: qualification || 'MBBS',
        facility_id: activeFacility.id,
        license_number: medicalId,
        experience_years: Number(experienceYears) || 0,
      })
      window.localStorage.setItem('medimate-doctor-info-complete', 'true')
      window.localStorage.setItem('medimate-doctor-medical-id', medicalId)
      window.localStorage.setItem('medimate-doctor-facility', activeFacility.name)
      navigate('/doctor-dashboard')
    } catch (err) {
      setError(err.message || 'Failed to complete profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return <div className="doctor-onboarding"><DoctorSidebar /><main className="doctor-workspace" id="doctor-workspace"><header className="doctor-topbar"><div><button>← &nbsp; Back to Patients</button><span>♧ &nbsp; Secure Clinical Session</span></div><div><button className="ai-assistant">✦ &nbsp; AI Clinical Assistant</button><button className="notification">♧<i /></button><strong>Dr. {getStoredUser()?.name || 'Doctor'} <small>Attending</small></strong></div></header><form className="doctor-content" onSubmit={finish}><div className="doctor-hero"><span>♧ &nbsp; DOCTOR WORKSPACE SETUP • STEP 1 OF 1</span><h1>Complete your professional profile</h1><p>Add your medical registration and select your primary facility to start receiving automated clinical triage, referrals, and teleconsultations.</p></div><section className="doctor-card medical-card"><div className="doctor-card-heading"><div><b>▣</b><div><h2>Medical ID</h2><p>This will be used to verify your professional identity and link your state licensing registry.</p></div></div><span>Mandatory</span></div><label>MEDICAL REGISTRATION / MEDICAL ID NUMBER <em>*</em><div className="doctor-id-input"><input value={medicalId} onChange={(e) => setMedicalId(e.target.value)} placeholder="e.g. MCI-DL-2016-084920" /><small>✓ State Registry Ready</small></div><small className="field-note">ⓘ &nbsp;Accepted formats: Medical Council of India (MCI), National Medical Commission (NMC), or State Medical Registry number.</small></label><label style={{marginTop:'1rem',display:'block'}}>SPECIALIZATION <em>*</em><div className="doctor-id-input"><input value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="e.g. General Physician, Cardiology" /></div></label><label style={{marginTop:'1rem',display:'block'}}>QUALIFICATION<div className="doctor-id-input"><input value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="e.g. MBBS, MD" /></div></label><label style={{marginTop:'1rem',display:'block'}}>YEARS OF EXPERIENCE<div className="doctor-id-input"><input type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="e.g. 5" /></div></label></section><section className="doctor-card facility-card"><div className="doctor-card-heading"><div><b>♧</b><div><h2>Hospital / Facility</h2><p>Select your primary public or private health center to enable patient intake and referral routing.</p></div></div><span>Primary Affiliation</span></div><label>SEARCH REGISTERED HEALTHCARE FACILITIES<div className="facility-search"><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by facility name, type, or location..." /><small>{loadingFacilities ? 'Loading facilities…' : `${filteredFacilities.length} facilities found`}</small></div></label><div className="facility-list">{loadingFacilities ? <p style={{padding:'1rem',opacity:.6}}>Loading facilities…</p> : filteredFacilities.length === 0 ? <p style={{padding:'1rem',opacity:.6}}>No facilities found.</p> : filteredFacilities.map((facility) => <button type="button" className={facility.id === selected ? 'facility-option selected' : 'facility-option'} onClick={() => setSelected(facility.id)} key={facility.id}><i>{facility.id === selected ? '✓' : ''}</i><div><header><strong>{facility.name}</strong><span>{facility.type}</span></header><p>⌖ &nbsp;{facility.location}</p><small><b>{facility.contact || 'Contact on site'}</b> &nbsp; • &nbsp; <em>ABHA Linked</em></small></div></button>)}</div>{activeFacility && <div className="facility-preview"><b>VERIFIED FACILITY CARD PREVIEW (WILL SYNC TO DOCTOR PROFILE)</b><span>↗ AUTO-SYNCHRONIZED</span><div><p>FACILITY NAME<strong>{activeFacility.name}</strong></p><p>FACILITY TYPE<strong>{activeFacility.type}</strong></p><p>FACILITY ADDRESS<strong>{activeFacility.location}</strong></p></div></div>}</section><section className="sync-note"><b>⟳</b><p><strong>Seamless Profile Synchronization</strong>Your employment, your Hospital Affiliation and Medical Registration ID will be automatically saved to your public and clinical profile. You can modify these anytime under "My Profile" → [Edit Profile].</p></section>{error && <p className="doctor-error" role="alert">{error}</p>}<footer className="doctor-submit-row"><span>♧ &nbsp; Your registration details will be verified with the State Medical Council.</span><button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Continue to Dashboard'} &nbsp; →</button></footer></form></main></div>
}