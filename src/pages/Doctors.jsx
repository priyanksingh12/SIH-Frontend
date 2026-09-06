import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { getDoctors } from '../api/doctorApi.js'
import { bookAppointment } from '../api/appointmentApi.js'

const toneMap = ['sage', 'blue', 'sand', 'rose', 'mint', 'lilac']

function getInitials(name) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

export default function Doctors() {
  const navigate = useNavigate()
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState('')
  const [query, setQuery] = useState('')
  const [bookingDoctor, setBookingDoctor] = useState(null) // { id, name }
  const [bookingForm, setBookingForm] = useState({ scheduled_at: '', reason: '' })
  const [bookingError, setBookingError] = useState('')
  const [bookingLoading, setBookingLoading] = useState(false)

  useEffect(() => {
    getDoctors()
      .then(setDoctors)
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false))
  }, [])

  const filteredDoctors = doctors.filter((doctor) =>
    `${doctor.name} ${doctor.specialization} ${doctor.facility_id || ''}`.toLowerCase().includes(query.toLowerCase())
  )

  const openBooking = (doctor) => {
    const doctorName = doctor.user?.name || doctor.name || 'Doctor'
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
    window.sessionStorage.removeItem('medimate-doctors-entry')
    navigate('/patient-dashboard')
  }

  return <div className="doctors-page">
    <header className="doctors-page-header"><button onClick={leavePage}>← <span>Back to dashboard</span></button><Link className="brand" to="/patient-dashboard" onClick={() => window.sessionStorage.removeItem('medimate-doctors-entry')}>MediMate</Link><span className="doctors-session">PATIENT CARE NETWORK</span></header>
    <main className="doctors-page-main">
      <div className="doctors-heading"><div><span className="doctors-kicker">CARE NETWORK</span><h1>Find the right doctor<br />for your next step.</h1><p>Connect with trusted specialists and care teams in your area, all in one place.</p></div><div className="doctor-count"><strong>{loading ? '…' : filteredDoctors.length}</strong><span>trusted doctors<br />near you</span></div></div>
      <div className="doctor-filters"><button className="doctor-filter active">All specialists</button><button className="doctor-filter">Near me</button><button className="doctor-filter">Available today</button><label>⌕ <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search doctors or specialty" /></label></div>
      {loading ? (
        <p style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>Loading doctors…</p>
      ) : filteredDoctors.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '3rem', opacity: 0.6 }}>No doctors found.</p>
      ) : (
        <div className="doctor-grid">
          {filteredDoctors.map((doctor, index) => {
            const doctorName = doctor.user?.name || doctor.name || 'Doctor'
            const facilityName = doctor.facility?.name || ''
            return (
            <article className="doctor-card" key={doctor.id}>
              <div className="doctor-card-top">
                <div className={`doctor-avatar ${toneMap[index % toneMap.length]}`}>{getInitials(doctorName)}<i /></div>
                <span className="doctor-more">•••</span>
              </div>
              <h2>{doctorName}</h2>
              <p className="doctor-specialty">{doctor.specialization}</p>
              <p className="doctor-location"><span>⌖</span>{facilityName || 'Location not listed'}</p>
              <div className="doctor-card-footer">
                <span className="availability"><i />{doctor.is_available ? 'Available now' : 'Unavailable'}</span>
                <button onClick={() => openBooking(doctor)}>Book an Appointment <span>→</span></button>
              </div>
              {/* Inline booking form */}
              {bookingDoctor?.id === doctor.id && (
                <form className="booking-form" onSubmit={submitBooking} style={{ borderTop: '1px solid rgba(0,0,0,0.1)', marginTop: '0.75rem', paddingTop: '0.75rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    Date &amp; Time
                    <input type="datetime-local" value={bookingForm.slot} min={new Date().toISOString().slice(0, 16)} onChange={(e) => setBookingForm({ ...bookingForm, slot: e.target.value })} style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.85rem' }} />
                  </label>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                    Reason
                    <input type="text" value={bookingForm.reason} placeholder="Brief reason for appointment" onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })} style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.4rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.85rem' }} />
                  </label>
                  {bookingError && <p style={{ color: '#c0392b', fontSize: '0.8rem', margin: '0.25rem 0' }}>{bookingError}</p>}
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button type="button" onClick={() => setBookingDoctor(null)} style={{ flex: 1, padding: '0.4rem', borderRadius: '6px', border: '1px solid #ddd', background: 'transparent', cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                    <button type="submit" disabled={bookingLoading} style={{ flex: 2, padding: '0.4rem', borderRadius: '6px', background: '#1a1a2e', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.8rem' }}>{bookingLoading ? 'Booking…' : 'Confirm →'}</button>
                  </div>
                </form>
              )}
            </article>
          )
        })}
        </div>
      )}
    </main>
    {toast && <div className="booking-toast" role="status"><span>✓</span><div><strong>Appointment requested</strong><p>{toast}</p></div><button aria-label="Dismiss notification" onClick={() => setToast('')}>×</button></div>}
  </div>
}
