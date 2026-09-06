import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { signup } from '../api/authApi.js'

const clinicImage = 'https://www.figma.com/api/mcp/asset/ea0832b8-8024-4aa8-a597-822e199eea9f.png'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिंदी (Hindi)' },
  { value: 'mr', label: 'मराठी (Marathi)' },
  { value: 'ta', label: 'தமிழ் (Tamil)' },
  { value: 'te', label: 'తెలుగు (Telugu)' },
  { value: 'kn', label: 'ಕನ್ನಡ (Kannada)' },
  { value: 'bn', label: 'বাংলা (Bengali)' },
  { value: 'gu', label: 'ગુજરાતી (Gujarati)' },
  { value: 'pa', label: 'ਪੰਜਾਬੀ (Punjabi)' },
]

export default function SignUp() {
  const navigate = useNavigate()
  const [role, setRole] = useState('patient')
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',
    preferred_language: 'en',
    consent: false,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const update = (e) =>
    setForm({
      ...form,
      [e.target.name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    })

  const goLogin = () => {
    navigate('/login')
  }

  const backToLanding = () => {
    navigate('/')
  }

  const submit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.phone || !form.password || !form.confirmPassword || !form.consent)
      return setError('Complete all required fields to continue.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    if (!/^\d{10}$/.test(form.phone)) return setError('Enter a valid 10-digit phone number.')
    setError('')
    setLoading(true)
    try {
      const data = await signup({
        name: form.name,
        phone: form.phone,
        password: form.password,
        role,
        email: form.email || undefined,
        preferred_language: form.preferred_language,
      })
      const user = data.user
      window.localStorage.setItem('medimate-signup-complete', 'true')
      window.localStorage.setItem('medimate-account-role', user.role || role)
      window.localStorage.setItem('medimate-account-name', user.name || form.name)
      window.localStorage.setItem('medimate-account-email', form.email || '')
      window.localStorage.removeItem('medimate-auth-mode')
      // Navigate without reload — let React Router handle it
      navigate('/account-created')
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        {/* ── Left hero panel (Same layout as Login) ── */}
        <section className="login-hero">
          <div className="login-hero-image" style={{ backgroundImage: `url(${clinicImage})` }} />
          <div className="login-hero-overlay" />
          <header className="login-brand">
            <div className="login-brand-mark">⊙</div>
            <div>
              <strong>MediMate</strong>
              <small>CONNECTED HEALTHCARE ECOSYSTEM</small>
            </div>
            <button type="button" onClick={backToLanding}>
              Back to website <span>→</span>
            </button>
          </header>
          <div className="login-quote">
            <blockquote>
              "Connecting patients, community clinicians, and tertiary hospitals into one synchronized care ecosystem."
            </blockquote>
            <p>
              <i /> EMPOWERING OVER 120,000 UNIFIED HEALTH RECORDS SECURELY ACROSS CLINICAL NETWORKS
            </p>
            <div>
              <b />
              <i />
              <i />
            </div>
          </div>
        </section>

        {/* ── Right form panel (Same layout as Login) ── */}
        <section className="login-panel">
          <form className="login-form" onSubmit={submit}>
            <header>
              <h1>Create your account</h1>
              <p>Personalize your healthcare experience.</p>
            </header>

            <fieldset className="role-selector">
              <legend>SELECT YOUR ROLE</legend>
              <div className="role-options">
                <button
                  type="button"
                  className={role === 'patient' ? 'role-option selected' : 'role-option'}
                  onClick={() => setRole('patient')}
                >
                  <span>♙</span>
                  <strong>Patient</strong>
                  <small>Personal health</small>
                </button>
                <button
                  type="button"
                  className={role === 'doctor' ? 'role-option selected' : 'role-option'}
                  onClick={() => setRole('doctor')}
                >
                  <span>▣</span>
                  <strong>Doctor</strong>
                  <small>Patient care</small>
                </button>
              </div>
            </fieldset>

            <div className="login-fields">
              <label>
                Full Name
                <input
                  name="name"
                  value={form.name}
                  onChange={update}
                  placeholder="e.g. Riya Sharma"
                />
              </label>
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
              </label>
              <label>
                Email address <span style={{ opacity: 0.5, fontSize: '0.8em' }}>(optional)</span>
                <input
                  name="email"
                  type="email"
                  value={form.email}
                  onChange={update}
                  placeholder="name@example.com"
                />
              </label>
              <div className="password-row">
                <label>
                  Password
                  <div className="password-input">
                    <input
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={form.password}
                      onChange={update}
                      placeholder="Create password"
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
                <label>
                  Confirm Password
                  <div className="password-input">
                    <input
                      name="confirmPassword"
                      type={showConfirm ? 'text' : 'password'}
                      value={form.confirmPassword}
                      onChange={update}
                      placeholder="Repeat password"
                    />
                    <button
                      type="button"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      onClick={() => setShowConfirm(!showConfirm)}
                    >
                      {showConfirm ? '◉' : '◌'}
                    </button>
                  </div>
                </label>
              </div>
              <label>
                Preferred Language
                <select
                  name="preferred_language"
                  value={form.preferred_language}
                  onChange={update}
                  style={{
                    display: 'block',
                    width: '100%',
                    marginTop: '0.35rem',
                    padding: '0.6rem 0.75rem',
                    borderRadius: '10px',
                    border: '1px solid #d5dbd8',
                    background: '#fff',
                    fontSize: '14.5px',
                    fontFamily: 'Manrope, sans-serif',
                    color: '#1b342e',
                    cursor: 'pointer',
                    height: '46px',
                  }}
                >
                  {LANGUAGES.map(({ value, label }) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="consent">
              <input
                name="consent"
                type="checkbox"
                checked={form.consent}
                onChange={update}
              />
              <span>
                I agree to the MediMate <u>Terms of Service</u>, <u>Privacy Policy</u>, and ABHA Data Consent.
              </span>
            </label>

            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? 'Creating account…' : <>Create account <span>→</span></>}
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

            <p className="login-prompt">
              Already have an account? <button type="button" onClick={goLogin}>Log in</button>
            </p>
            <p className="security-note">
              ♡ &nbsp;256-Bit Clinical Encryption &nbsp; · &nbsp; ABHA / NDHM Compliant
            </p>
          </form>
        </section>
      </section>
    </main>
  )
}