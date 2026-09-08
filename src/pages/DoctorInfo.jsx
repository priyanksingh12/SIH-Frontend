import { useMemo, useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getFacilities } from '../api/facilityApi.js'
import { registerDoctor } from '../api/doctorApi.js'
import { getStoredUser } from '../api/apiClient.js'
import MedicalShaderBg from '../components/MedicalShaderBg'

function DoctorSidebar() {
  const links = ['Dashboard', 'Patients', 'Appointments', 'Vitals & History', 'My Profile']
  const icons = ['⌂', '♧', '▣', '≋', '◎']
  return (
    <aside className="w-[280px] shrink-0 bg-[#171d1b] text-white flex flex-col p-6 hidden md:flex border-r border-[#2a3632]">
      <div className="mb-10">
        <div className="font-serif text-2xl font-bold tracking-tight text-white">SwasthyaSahay</div>
        <small className="text-[0.65rem] uppercase tracking-[2px] font-bold opacity-80 text-[#00ff88]">CLINICAL SUITE</small>
      </div>
      <div className="flex items-center gap-3 p-4 rounded-2xl bg-[rgba(255,255,255,0.06)] border border-[rgba(255,255,255,0.08)] mb-6 relative">
        <span className="w-10 h-10 rounded-full bg-[#00ff88] text-[#171d1b] flex items-center justify-center font-bold text-sm shrink-0">DR</span>
        <div>
          <b className="block text-sm font-semibold text-white">Dr. {getStoredUser()?.name || 'Doctor'}</b>
          <small className="text-xs text-[rgba(255,255,255,0.6)]">Cardiology • Attending</small>
        </div>
        <i className="absolute right-4 w-2 h-2 rounded-full bg-[#00ff88] shadow-[0_0_8px_#00ff88]" />
      </div>
      <button className="w-full py-3.5 bg-[rgba(255,255,255,0.1)] hover:bg-[rgba(255,255,255,0.15)] text-white border border-[rgba(255,255,255,0.2)] rounded-xl font-bold text-sm cursor-pointer mb-6 transition-all duration-200">
        ＋ New Consultation
      </button>
      <nav className="flex flex-col gap-1">
        {links.map((link, idx) => (
          <Link
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-semibold text-[rgba(255,255,255,0.7)] no-underline transition-all duration-200 hover:text-white hover:bg-[rgba(255,255,255,0.05)] ${link === 'Dashboard' ? 'bg-[rgba(255,255,255,0.1)] text-white' : ''}`}
            to={link === 'Patients' ? '/doctor-patients' : '/doctor-dashboard'}
            key={link}
          >
            <span className="w-5 text-center text-lg">{icons[idx]}</span>
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

  const handleMedicalIdChange = (e) => {
    const filtered = e.target.value.replace(/[^a-zA-Z0-9-]/g, '')
    setMedicalId(filtered)
  }

  const finish = async (event) => {
    event.preventDefault()
    if (!medicalId.trim() || !activeFacility) return setError('Add your medical registration number and select a facility.')
    if (!specialization.trim()) return setError('Please enter your specialization.')
    setError('')
    setLoading(true)
    try {
      const regRes = await registerDoctor({
        specialization,
        qualification: qualification || 'MBBS',
        facility_id: activeFacility.id,
        license_number: medicalId,
        experience_years: Number(experienceYears) || 0,
      })

      const user = getStoredUser()
      const docToSave = {
        id: regRes?.doctor?.id || `doc_${Date.now()}`,
        user_id: user?.id,
        specialization,
        qualification: qualification || 'MBBS',
        license_number: medicalId,
        experience_years: Number(experienceYears) || 0,
        is_available: true,
        verified: true,
        user: {
          id: user?.id,
          name: user?.name ? (user.name.startsWith('Dr.') ? user.name : `Dr. ${user.name}`) : 'Dr. Doctor',
          email: user?.email,
          phone: user?.phone,
        },
        facility: {
          id: activeFacility.id,
          name: activeFacility.name,
          type: activeFacility.type,
        },
      }

      window.localStorage.setItem('SwasthyaSahay-doctor-info-complete', 'true')
      window.localStorage.setItem('SwasthyaSahay-doctor-medical-id', medicalId)
      window.localStorage.setItem('SwasthyaSahay-doctor-facility', activeFacility.name)
      navigate('/doctor-dashboard')
    } catch (err) {
      setError(err.message || 'Failed to complete profile. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-[#f5f7f6] font-sans">
      <DoctorSidebar />
      <main className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto" id="doctor-workspace">
        <header className="relative overflow-hidden h-[72px] shrink-0 bg-[#f5fbf7] border-b border-[#e2eae5] px-6 md:px-10 flex items-center justify-between sticky top-0 z-[10]">
          <MedicalShaderBg isNavbar />
          <div className="relative z-10 w-full flex items-center justify-between">
            <div className="flex items-center gap-6">
              <button className="border-0 bg-transparent text-[#59756e] font-bold text-sm cursor-pointer hidden md:block">← &nbsp; Back to Patients</button>
              <span className="text-[#29574b] font-bold text-sm bg-[#eaf3ee] px-3 py-1.5 rounded-full">♧ &nbsp; Secure Clinical Session</span>
            </div>
            <div className="flex items-center gap-4">
              <button className="hidden md:block px-4 py-2 bg-gradient-to-r from-[#29574b] to-[#1e4037] text-[#00ff88] border-0 rounded-full font-bold text-xs cursor-pointer shadow-md shadow-[#29574b]/20">✦ &nbsp; AI Clinical Assistant</button>
              <button className="w-10 h-10 rounded-full border border-[#e2eae5] bg-[#fafdfb] text-[#29574b] text-lg cursor-pointer relative flex items-center justify-center">♧<i className="absolute top-2 right-2.5 w-2 h-2 rounded-full bg-[#e74c3c]" /></button>
              <strong className="hidden md:flex flex-col text-[#171d1b] text-sm">Dr. {getStoredUser()?.name || 'Doctor'} <small className="text-[#59756e] font-normal text-xs">Attending</small></strong>
            </div>
          </div>
        </header>
        <form className="max-w-[800px] w-full mx-auto px-6 md:px-10 py-10" onSubmit={finish}>
          <div className="mb-10 text-center">
            <span className="inline-block px-3 py-1 rounded-full border border-[rgba(41,87,75,0.2)] bg-[rgba(41,87,75,0.05)] text-[#29574b] text-xs font-bold tracking-widest uppercase mb-4">♧ &nbsp; DOCTOR WORKSPACE SETUP • STEP 1 OF 1</span>
            <h1 className="text-4xl md:text-5xl font-['Playfair_Display',serif] text-[#171d1b] font-bold m-0 mb-4">Complete your professional profile</h1>
            <p className="text-[#59756e] text-lg max-w-[600px] mx-auto m-0 leading-relaxed">Add your medical registration and select your primary facility to start receiving automated clinical triage, referrals, and teleconsultations.</p>
          </div>
          <section className="bg-white rounded-3xl p-6 md:p-8 border border-[#e2eae5] shadow-[0_8px_30px_rgba(41,87,75,0.04)] mb-8">
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-[#e2eae5]">
              <div className="flex gap-4">
                <b className="w-12 h-12 rounded-xl bg-[#eaf3ee] text-[#29574b] flex items-center justify-center text-xl shrink-0">▣</b>
                <div>
                  <h2 className="m-0 text-xl text-[#171d1b] font-bold font-['Playfair_Display',serif]">Medical ID</h2>
                  <p className="m-0 mt-1 text-sm text-[#59756e] leading-relaxed">This will be used to verify your professional identity and link your state licensing registry.</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-[#fef2f2] text-[#991b1b] rounded-md text-xs font-bold uppercase tracking-wider hidden md:block">Mandatory</span>
            </div>
            <label className="block">
              <span className="text-xs font-bold text-[#404845] uppercase tracking-wide">MEDICAL REGISTRATION / MEDICAL ID NUMBER <em className="text-[#e74c3c] not-italic">*</em></span>
              <div className="flex items-center gap-3 mt-2">
                <input className="flex-1 px-4 py-3 rounded-xl border border-[#dcece5] bg-[#fafdfb] text-[#171d1b] font-semibold text-base focus:outline-none focus:border-[#29574b] focus:ring-2 focus:ring-[#29574b]/10 transition-all" value={medicalId} onChange={handleMedicalIdChange} placeholder="e.g. MCI-DL-2016-084920" />
                <small className="hidden md:block px-3 py-2 bg-[#f0fdf4] text-[#166534] border border-[#bbf7d0] rounded-lg text-xs font-bold whitespace-nowrap">✓ State Registry Ready</small>
              </div>
              <small className="block mt-2 text-[#59756e] text-xs">ⓘ &nbsp;Accepted formats: Medical Council of India (MCI), National Medical Commission (NMC), or State Medical Registry number.</small>
            </label>
            <label className="block mt-6">
              <span className="text-xs font-bold text-[#404845] uppercase tracking-wide">SPECIALIZATION <em className="text-[#e74c3c] not-italic">*</em></span>
              <div className="mt-2">
                <input className="w-full px-4 py-3 rounded-xl border border-[#dcece5] bg-[#fafdfb] text-[#171d1b] font-semibold text-base focus:outline-none focus:border-[#29574b] focus:ring-2 focus:ring-[#29574b]/10 transition-all" value={specialization} onChange={(e) => setSpecialization(e.target.value)} placeholder="e.g. General Physician, Cardiology" />
              </div>
            </label>
            <label className="block mt-6">
              <span className="text-xs font-bold text-[#404845] uppercase tracking-wide">QUALIFICATION</span>
              <div className="mt-2">
                <input className="w-full px-4 py-3 rounded-xl border border-[#dcece5] bg-[#fafdfb] text-[#171d1b] font-semibold text-base focus:outline-none focus:border-[#29574b] focus:ring-2 focus:ring-[#29574b]/10 transition-all" value={qualification} onChange={(e) => setQualification(e.target.value)} placeholder="e.g. MBBS, MD" />
              </div>
            </label>
            <label className="block mt-6">
              <span className="text-xs font-bold text-[#404845] uppercase tracking-wide">YEARS OF EXPERIENCE</span>
              <div className="mt-2">
                <input className="w-full px-4 py-3 rounded-xl border border-[#dcece5] bg-[#fafdfb] text-[#171d1b] font-semibold text-base focus:outline-none focus:border-[#29574b] focus:ring-2 focus:ring-[#29574b]/10 transition-all" type="number" min="0" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} placeholder="e.g. 5" />
              </div>
            </label>
          </section>
          <section className="bg-white rounded-3xl p-6 md:p-8 border border-[#e2eae5] shadow-[0_8px_30px_rgba(41,87,75,0.04)] mb-8">
            <div className="flex justify-between items-start mb-8 pb-6 border-b border-[#e2eae5]">
              <div className="flex gap-4">
                <b className="w-12 h-12 rounded-xl bg-[#eaf3ee] text-[#29574b] flex items-center justify-center text-xl shrink-0">♧</b>
                <div>
                  <h2 className="m-0 text-xl text-[#171d1b] font-bold font-['Playfair_Display',serif]">Hospital / Facility</h2>
                  <p className="m-0 mt-1 text-sm text-[#59756e] leading-relaxed">Select your primary public or private health center to enable patient intake and referral routing.</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-[#fef3c7] text-[#92400e] rounded-md text-xs font-bold uppercase tracking-wider hidden md:block whitespace-nowrap">Primary Affiliation</span>
            </div>
            <label className="block mb-6">
              <span className="text-xs font-bold text-[#404845] uppercase tracking-wide">SEARCH REGISTERED HEALTHCARE FACILITIES</span>
              <div className="mt-2 relative">
                <input className="w-full px-4 py-3.5 rounded-xl border border-[#dcece5] bg-[#fafdfb] text-[#171d1b] text-base focus:outline-none focus:border-[#29574b] focus:ring-2 focus:ring-[#29574b]/10 transition-all pl-12" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by facility name, type, or location..." />
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl text-[#8a9b95]">⌕</span>
                <small className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-[#59756e] bg-[#eaf3ee] px-2 py-1 rounded-md hidden sm:block">{loadingFacilities ? 'Loading facilities…' : `${filteredFacilities.length} facilities found`}</small>
              </div>
            </label>
            <div className="max-h-[300px] overflow-y-auto rounded-2xl border border-[#e2eae5] bg-[#fafdfb] flex flex-col p-2 gap-1.5 scrollbar-thin">
              {loadingFacilities ? <p className="p-4 text-center text-[#59756e]">Loading facilities…</p> : filteredFacilities.length === 0 ? <p className="p-4 text-center text-[#59756e]">No facilities found.</p> : filteredFacilities.map((facility) => (
                <button type="button" className={`flex items-start gap-4 p-4 rounded-xl text-left border cursor-pointer transition-all ${facility.id === selected ? 'bg-white border-[#29574b] shadow-[0_4px_12px_rgba(41,87,75,0.08)]' : 'bg-transparent border-transparent hover:bg-white hover:border-[#e2eae5]'}`} onClick={() => setSelected(facility.id)} key={facility.id}>
                  <i className={`w-6 h-6 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${facility.id === selected ? 'border-[#29574b] bg-[#29574b] text-[#00ff88]' : 'border-[#dcece5] bg-white text-transparent'}`}>{facility.id === selected ? '✓' : ''}</i>
                  <div className="flex-1">
                    <header className="flex justify-between items-start mb-1.5 gap-2">
                      <strong className="text-base text-[#171d1b]">{facility.name}</strong>
                      <span className="px-2 py-0.5 rounded bg-[#eaf3ee] text-[#29574b] text-[0.7rem] font-bold uppercase shrink-0">{facility.type}</span>
                    </header>
                    <p className="m-0 text-sm text-[#59756e] mb-2">⌖ &nbsp;{facility.location}</p>
                    <small className="text-xs text-[#8a9b95] flex items-center gap-2"><b className="text-[#404845]">{facility.contact || 'Contact on site'}</b> &nbsp; • &nbsp; <em className="not-italic text-[#29574b] font-bold">ABHA Linked</em></small>
                  </div>
                </button>
              ))}
            </div>
            {activeFacility && (
              <div className="mt-6 p-5 rounded-2xl bg-[#eaf3ee] border border-[#dcece5] relative overflow-hidden">
                <b className="block text-[#29574b] text-[0.7rem] font-bold tracking-widest uppercase mb-4">VERIFIED FACILITY CARD PREVIEW (WILL SYNC TO DOCTOR PROFILE)</b>
                <span className="absolute top-4 right-4 bg-white px-2 py-1 rounded text-[#29574b] text-[0.65rem] font-bold shadow-sm">↗ AUTO-SYNCHRONIZED</span>
                <div className="flex flex-col sm:flex-row gap-4 sm:gap-8">
                  <p className="m-0 flex flex-col gap-1"><span className="text-[0.65rem] text-[#59756e] font-bold uppercase tracking-wider">FACILITY NAME</span><strong className="text-[#171d1b] text-base">{activeFacility.name}</strong></p>
                  <p className="m-0 flex flex-col gap-1"><span className="text-[0.65rem] text-[#59756e] font-bold uppercase tracking-wider">FACILITY TYPE</span><strong className="text-[#171d1b] text-base">{activeFacility.type}</strong></p>
                  <p className="m-0 flex flex-col gap-1"><span className="text-[0.65rem] text-[#59756e] font-bold uppercase tracking-wider">FACILITY ADDRESS</span><strong className="text-[#171d1b] text-base">{activeFacility.location}</strong></p>
                </div>
              </div>
            )}
          </section>
          <section className="flex items-start gap-4 p-5 rounded-2xl bg-[#fffdf0] border border-[#fde68a] text-[#92400e] mb-8">
            <b className="text-xl mt-0.5">⟳</b>
            <p className="m-0 text-sm leading-relaxed"><strong className="block text-[#78350f] mb-1">Seamless Profile Synchronization</strong>Your employment, your Hospital Affiliation and Medical Registration ID will be automatically saved to your public and clinical profile. You can modify these anytime under "My Profile" → [Edit Profile].</p>
          </section>
          {error && <p className="bg-[#fef2f2] text-[#991b1b] p-4 rounded-xl border border-[#fecaca] font-bold text-sm text-center mb-6" role="alert">{error}</p>}
          <footer className="flex flex-col-reverse md:flex-row justify-between items-center gap-6 py-6 border-t border-[#e2eae5]">
            <span className="text-[#59756e] text-xs font-semibold">♧ &nbsp; Your registration details will be verified with the State Medical Council.</span>
            <button type="submit" disabled={loading} className="w-full md:w-auto px-8 py-4 bg-[#29574b] hover:bg-[#1e4037] text-white border-0 rounded-full font-bold text-base cursor-pointer shadow-lg shadow-[#29574b]/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed">
              {loading ? 'Saving…' : 'Continue to Dashboard'} &nbsp; →
            </button>
          </footer>
        </form>
      </main>
    </div>
  )
}