import { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getDoctors } from '../api/doctorApi.js'
import { bookAppointment } from '../api/appointmentApi.js'
import MedicalShaderBg from '../components/MedicalShaderBg'

const toneMap = ['sage', 'blue', 'sand', 'rose', 'mint', 'lilac']

function getInitials(name) {
  return (name || '')
    .replace(/^Dr\.\s*/i, '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || 'DR'
}

export default function Doctors() {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [filterMode, setFilterMode] = useState('all') // 'all' | 'available'
  const [bookingDoctor, setBookingDoctor] = useState(null)
  const [bookingForm, setBookingForm] = useState({ slot: '', reason: '' })
  const [bookingError, setBookingError] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => {
    getDoctors()
      .then(setDoctors)
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false))
  }, [])

  // Filter and sort alphabetically by Doctor's Name (A-Z)
  const processedDoctors = useMemo(() => {
    const filtered = doctors.filter((doctor) => {
      const docName = doctor.user?.name || doctor.name || ''
      const spec = doctor.specialization || ''
      const qual = doctor.qualification || ''
      const facName = doctor.facility?.name || ''
      const searchTarget = `${docName} ${spec} ${qual} ${facName}`.toLowerCase()
      const matchesQuery = searchTarget.includes(query.toLowerCase().trim())

      if (!matchesQuery) return false
      if (filterMode === 'available' && !doctor.is_available) return false
      return true
    })

    // Sort alphabetically by doctor's name
    filtered.sort((a, b) => {
      const nameA = (a.user?.name || a.name || '').replace(/^Dr\.\s*/i, '').toLowerCase()
      const nameB = (b.user?.name || b.name || '').replace(/^Dr\.\s*/i, '').toLowerCase()
      return nameA.localeCompare(nameB)
    })

    return filtered
  }, [doctors, query, filterMode])

  const openBooking = (doctor) => {
    const rawName = doctor.user?.name || doctor.name || 'Doctor'
    const doctorName = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`
    setBookingDoctor({ id: doctor.id, name: doctorName })
    setBookingForm({ slot: '', reason: '' })
    setBookingError('')
  }

  const submitBooking = async (event) => {
    event.preventDefault()
    if (!bookingForm.slot || !bookingForm.reason) return setBookingError('Please fill in date/time and reason.')
    setBookingLoading(true)
    setBookingError('')
    try {
      await bookAppointment({
        doctor_id: bookingDoctor.id,
        slot: new Date(bookingForm.slot).toISOString(),
      })
      setBookingDoctor(null)
      setToast(`Appointment requested with ${bookingDoctor.name}`)
      window.setTimeout(() => setToast(''), 4000)
    } catch (err) {
      setBookingError(err.message || 'Booking failed. Please try again.')
    } finally {
      setBookingLoading(false)
    }
  }

  const leavePage = () => {
    window.sessionStorage.removeItem('SwasthyaSahay-doctors-entry')
    navigate('/patient-dashboard')
  }

  return (
    <div className="min-h-screen bg-transparent text-[#171d1b]">
      <header className="relative overflow-hidden flex items-center justify-between px-4 md:px-12 py-4 border-b border-[rgba(41,87,75,0.12)] bg-[#f5fbf7] gap-4">
        <MedicalShaderBg isNavbar />
        <div className="relative z-10 w-full flex items-center justify-between gap-4">
          <button
            onClick={leavePage}
            className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#c4dcd3] bg-[#eaf3ee] text-[#29574b] font-bold text-sm cursor-pointer"
          >
            ← <span className="hidden sm:inline">Back to dashboard</span>
          </button>
          <Link
            style={{ color: '#29574b' }}
            className="font-serif text-2xl font-bold md:text-[32px] text-[#29574b] brand-text no-underline tracking-tight shrink-0"
            to="/patient-dashboard"
            onClick={() => window.sessionStorage.removeItem('SwasthyaSahay-doctors-entry')}
          >
            SwasthyaSahay
          </Link>
          <span className="text-xs font-bold text-[#717975] tracking-widest uppercase hidden sm:block">PATIENT CARE NETWORK</span>
        </div>
      </header>

      <main className="w-full max-w-6xl mx-auto px-4 md:px-10 lg:px-16 py-8 pb-16">
        <div className="flex items-start justify-between gap-6 flex-wrap mb-7">
          <div>
            <span className="text-xs font-extrabold text-[#29574b] tracking-widest uppercase">CARE NETWORK</span>
            <h1 className="m-0 mt-2 text-3xl md:text-5xl font-bold font-serif leading-tight">
              Find the right doctor<br />for your next step.
            </h1>
            <p className="mt-2 text-[#404845] text-base md:text-lg">Connect with trusted specialists and care teams in your area, arranged alphabetically for quick access.</p>
          </div>
          <div className="flex flex-col items-center text-center shrink-0">
            <strong className="text-5xl md:text-6xl font-bold font-serif text-[#29574b]">
              {loading ? '…' : processedDoctors.length}
            </strong>
            <span className="text-sm text-[#717975] font-semibold mt-1">trusted doctors<br />found</span>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="flex flex-wrap items-center gap-3 mb-7">
          <button
            className={`px-4 py-2 rounded-full border text-sm font-bold cursor-pointer transition-all ${filterMode === 'all' ? 'bg-[#29574b] text-[#00ff88] border-[#29574b]' : 'bg-white text-[#404845] border-[#dee4e0] hover:border-[#29574b]'}`}
            onClick={() => setFilterMode('all')}
          >
            All specialists
          </button>
          <button
            className={`px-4 py-2 rounded-full border text-sm font-bold cursor-pointer transition-all ${filterMode === 'available' ? 'bg-[#29574b] text-[#00ff88] border-[#29574b]' : 'bg-white text-[#404845] border-[#dee4e0] hover:border-[#29574b]'}`}
            onClick={() => setFilterMode('available')}
          >
            Available now
          </button>
          <label className="flex-1 min-w-[220px] flex items-center gap-2 px-4 py-2.5 border border-[#dee4e0] rounded-full bg-white text-[#404845] text-sm cursor-text">
            ⌕{' '}
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by doctor name, specialty, or hospital..."
              className="flex-1 border-0 outline-none bg-transparent text-[#171d1b] text-sm"
            />
          </label>
        </div>

        {loading ? (
          <p className="text-center py-12 opacity-60 text-lg">Loading doctors…</p>
        ) : processedDoctors.length === 0 ? (
          <div className="text-center py-16 opacity-70">
            <p className="text-xl font-semibold m-0">No doctors found.</p>
            <p className="text-base mt-2">Try searching with a different doctor name or clearing your query.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {processedDoctors.map((doctor, index) => {
              const rawName = doctor.user?.name || doctor.name || 'Doctor'
              const doctorName = rawName.startsWith('Dr.') ? rawName : `Dr. ${rawName}`
              const facilityName = doctor.facility?.name || ''
              const qualification = doctor.qualification || ''

              return (
                <article
                  key={doctor.id}
                  className="p-5 rounded-2xl bg-white border border-[#e2eae5] shadow-sm hover:shadow-md transition-shadow flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg text-[#29574b] bg-[#eaf3ee] relative`}>
                      {getInitials(doctorName)}
                      <i className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-white" />
                    </div>
                    <span className="text-[#c0c8c4] font-bold tracking-widest text-sm">•••</span>
                  </div>
                  <h2 className="m-0 text-lg font-bold text-[#171d1b] font-serif">{doctorName}</h2>
                  <p className="mt-1 text-sm text-[#29574b] font-semibold">
                    {doctor.specialization} {qualification && `(${qualification})`}
                  </p>
                  <p className="mt-1 text-sm text-[#717975] flex items-center gap-1">
                    <span>⌖</span>
                    {facilityName || 'Location not listed'}
                  </p>
                  <div className="mt-auto pt-4 flex items-center justify-between flex-wrap gap-2 border-t border-[#f2f7f5]">
                    <span className="flex items-center gap-1.5 text-sm text-[#526e67] font-semibold">
                      <i style={{ background: doctor.is_available ? '#10b981' : '#9ca3af' }} className="w-2 h-2 rounded-full" />
                      {doctor.is_available ? 'Available now' : 'Unavailable'}
                    </span>
                    <button
                      onClick={() => openBooking(doctor)}
                      className="px-3 py-1.5 rounded-full bg-[#29574b] text-[#00ff88] text-xs font-extrabold border-0 cursor-pointer hover:bg-[#1e4238] transition-colors"
                    >
                      Book an Appointment →
                    </button>
                  </div>

                  {/* Inline booking form */}
                  {bookingDoctor?.id === doctor.id && (
                    <form
                      className="mt-3 pt-3 border-t border-[rgba(0,0,0,0.08)] grid gap-3"
                      onSubmit={submitBooking}
                    >
                      <label className="grid gap-1 text-xs font-bold text-[#1b342e]">
                        Date &amp; Time
                        <input
                          type="datetime-local"
                          value={bookingForm.slot}
                          min={new Date().toISOString().slice(0, 16)}
                          onChange={(e) => setBookingForm({ ...bookingForm, slot: e.target.value })}
                          className="w-full mt-1 px-2 py-1.5 rounded-lg border border-[#ddd] text-sm bg-white"
                        />
                      </label>
                      <label className="grid gap-1 text-xs font-bold text-[#1b342e]">
                        Reason
                        <input
                          type="text"
                          value={bookingForm.reason}
                          placeholder="Brief reason for appointment"
                          onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })}
                          className="w-full mt-1 px-2 py-1.5 rounded-lg border border-[#ddd] text-sm bg-white"
                        />
                      </label>
                      {bookingError && (
                        <p className="text-red-600 text-xs m-0">{bookingError}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setBookingDoctor(null)}
                          className="flex-1 py-1.5 rounded-lg border border-[#ddd] bg-transparent cursor-pointer text-xs font-semibold"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={bookingLoading}
                          className="flex-[2] py-1.5 rounded-lg bg-[#1a1a2e] text-white border-0 cursor-pointer text-xs font-bold disabled:opacity-60"
                        >
                          {bookingLoading ? 'Booking…' : 'Confirm →'}
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </main>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#29574b] text-white shadow-xl max-w-sm w-full mx-4" role="status">
          <span className="text-[#00ff88] text-lg font-bold">✓</span>
          <div className="flex-1">
            <strong className="block text-sm font-bold">Appointment requested</strong>
            <p className="m-0 text-xs text-[rgba(255,255,255,0.8)]">{toast}</p>
          </div>
          <button aria-label="Dismiss notification" onClick={() => setToast('')} className="text-white/60 hover:text-white bg-transparent border-0 cursor-pointer text-lg font-bold">
            ×
          </button>
        </div>
      )}
    </div>
  )
}


