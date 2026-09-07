import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/authApi.js'

const clinicImage = 'https://www.figma.com/api/mcp/asset/3915cd95-4c6c-4523-b29c-2ff23ca84be8.png'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ phone: '', password: '', remember: false })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (event) =>
    setForm({
      ...form,
      [event.target.name]:
        event.target.type === 'checkbox' ? event.target.checked : event.target.value,
    })

  const goSignUp = () => {
    navigate('/signup')
  }

  const backToLanding = () => {
    navigate('/')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!form.phone || !form.password)
      return setError('Enter your phone number and password to continue.')
    setError('')
    setLoading(true)
    try {
      const data = await login({ phone: form.phone, password: form.password })
      const user = data.user
      window.localStorage.setItem('medimate-signup-complete', 'true')
      window.localStorage.setItem('medimate-account-role', user.role || 'patient')
      window.localStorage.setItem('medimate-account-name', user.name || '')
      window.localStorage.removeItem('medimate-account-created')
      window.localStorage.removeItem('medimate-auth-mode')
      if (user.role === 'doctor') {
        // Check via API if the doctor has already completed onboarding.
        // This works across devices/browsers unlike the localStorage flag.
        try {
          const { getDoctorProfile } = await import('../api/doctorApi.js')
          const profileRes = await getDoctorProfile()
          if (profileRes?.doctor?.license_number) {
            // Doctor profile already registered — go straight to dashboard
            window.localStorage.setItem('medimate-doctor-info-complete', 'true')
            if (profileRes.doctor.facility?.name) {
              window.localStorage.setItem('medimate-doctor-facility', profileRes.doctor.facility.name)
            }
            navigate('/doctor-dashboard')
          } else {
            navigate('/doctor-info')
          }
        } catch {
          // API call failed — fall back to localStorage flag
          const doctorInfoDone = window.localStorage.getItem('medimate-doctor-info-complete') === 'true'
          navigate(doctorInfoDone ? '/doctor-dashboard' : '/doctor-info')
        }
      } else {
        // Returning patient logging in -> directly navigate to patient dashboard
        window.localStorage.setItem('medimate-vitals-complete', 'true')
        navigate('/patient-dashboard')
      }
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        {/* ── Left hero panel ── */}
        <section className="login-hero">
          <div className="login-hero-image" style={{ backgroundImage: `url(${clinicImage})` }} />
          <div className="login-hero-overlay" />
          <header className="login-brand">
            <div className="login-brand-mark">⊙</div>
            <div>
              <strong>MediMate</strong>
              <small>CLINICAL HEALTH NETWORK</small>
            </div>
            <button type="button" onClick={backToLanding}>
              Back to website <span>→</span>
            </button>
          </header>
          <div className="login-quote">
            <blockquote>
              "Longitudinal, compassionate healthcare continuity across primary care facilities and
              specialty hubs."
            </blockquote>
            <p>
              <i /> MEDIMATE CLINICAL PLATFORM • AYUSHMAN BHARAT / ABHA CONNECTED
            </p>
            <div>
              <b />
              <i />
              <i />
            </div>
          </div>
        </section>

        {/* ── Right form panel ── */}
        <section className="login-panel">
          <div className="language-pill">◎ &nbsp; English (IN) &nbsp;⌄</div>
          <form className="login-form" onSubmit={submit}>
            <header>
              <h1>Welcome back</h1>
              <p>Continue your journey to better care.</p>
            </header>

            <div className="login-fields">
              <label>
                Phone Number
                <input
                  name="phone"
                  type="tel"
                  value={form.phone}
                  onChange={update}
                  placeholder="10-digit mobile number"
                  inputMode="numeric"
                  maxLength={10}
                />
                <span>☎</span>
              </label>
              <label>
                Password
                <div className="password-input">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={update}
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? '◉' : '◌'}
                  </button>
                </div>
              </label>
            </div>

            <div className="login-options">
              <label>
                <input name="remember" type="checkbox" checked={form.remember} onChange={update} />
                {' '}Remember this workstation
              </label>
              <button type="button">Forgot password?</button>
            </div>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? 'Logging in…' : <>Log in to Clinical Portal <span>→</span></>}
            </button>

            <div className="login-divider">
              <span>OR CONTINUE WITH</span>
            </div>

            <button
              className="google-button"
              type="button"
              onClick={() => alert('Google Sign-In requires a Google Client ID. Contact your developer to enable this.')}
            >
              <strong>G</strong> Google
            </button>

            {/* ── Sign up prompt ── */}
            <p className="login-prompt" style={{ marginTop: '1.25rem', textAlign: 'center', fontSize: '0.875rem', opacity: 0.8 }}>
              Creating an account for the first time?{' '}
              <button
                type="button"
                onClick={goSignUp}
                style={{ fontWeight: 600, textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
              >
                Sign up
              </button>
            </p>
          </form>
        </section>
      </section>
    </main>
  )
}