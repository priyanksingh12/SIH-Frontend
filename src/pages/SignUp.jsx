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
      window.localStorage.setItem('SwasthyaSahay-signup-complete', 'true')
      window.localStorage.setItem('SwasthyaSahay-account-role', user.role || role)
      window.localStorage.setItem('SwasthyaSahay-account-name', user.name || form.name)
      window.localStorage.setItem('SwasthyaSahay-account-email', form.email || '')
      window.localStorage.removeItem('SwasthyaSahay-auth-mode')
      // Navigate without reload — let React Router handle it
      navigate('/account-created')
    } catch (err) {
      setError(err.message || 'Signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen flex flex-col md:flex-row bg-[#fcfdfc] text-[#1b342e]">
      {/* ── Left hero panel ── */}
      <section className="relative hidden md:flex md:w-1/2 min-h-screen flex-col justify-between p-16 overflow-hidden text-white bg-[rgba(53,89,79,0.95)]">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${clinicImage})` }} />
        <div className="absolute inset-0 bg-[rgba(41,87,75,0.85)]" />
        <header className="relative z-10 flex items-center gap-4">
          <div className="grid place-items-center w-10 h-10 rounded-full bg-[#1b342e] text-white text-lg font-bold">⊙</div>
          <div>
            <strong className="block text-xl leading-tight">SwasthyaSahay</strong>
            <small className="block text-[10px] tracking-widest opacity-80 uppercase">CONNECTED HEALTHCARE ECOSYSTEM</small>
          </div>
          <button type="button" onClick={backToLanding} className="ml-auto bg-transparent border-none text-white text-sm font-semibold cursor-pointer hover:underline flex items-center gap-2">
            Back to website <span>→</span>
          </button>
        </header>
        <div className="relative z-10">
          <blockquote className="text-2xl md:text-4xl font-serif leading-tight font-medium max-w-[500px]">
            "Connecting patients, community clinicians, and tertiary hospitals into one synchronized care ecosystem."
          </blockquote>
          <p className="mt-8 text-[11px] font-bold tracking-widest flex items-center gap-3">
            <i className="w-2 h-2 rounded-full bg-[#00ff88]" /> EMPOWERING OVER 120,000 UNIFIED HEALTH RECORDS SECURELY ACROSS CLINICAL NETWORKS
          </p>
          <div className="flex gap-2 mt-6">
            <b className="w-8 h-1 bg-white rounded-full opacity-100" />
            <i className="w-2 h-1 bg-white rounded-full opacity-30" />
            <i className="w-2 h-1 bg-white rounded-full opacity-30" />
          </div>
        </div>
      </section>

      {/* ── Right form panel ── */}
      <section className="w-full md:w-1/2 min-h-screen grid place-items-center p-8 md:p-16 overflow-auto bg-transparent relative">
        <div className="absolute top-6 right-8 text-xs font-bold tracking-widest border border-[#d5dbd8] rounded-full px-4 py-2 cursor-pointer bg-white hidden md:block text-[#1b342e]">◎ &nbsp; English (IN) &nbsp;⌄</div>
        <form className="w-full max-w-[480px] grid gap-5" onSubmit={submit}>
          <header className="mb-2">
            <h1 className="text-3xl md:text-4xl font-serif text-[#1b342e]">Create your account</h1>
            <p className="text-[#59756e] mt-2 text-[15px]">Personalize your healthcare experience.</p>
          </header>

          <fieldset className="m-0 p-0 border-none grid gap-3">
            <legend className="text-[11px] font-bold tracking-[0.08em] text-[#59756e] mb-2 uppercase">SELECT YOUR ROLE</legend>
            <div className="flex gap-4">
              <button
                type="button"
                className={`flex-1 grid justify-items-center gap-1 min-h-[76px] p-3 border rounded-xl text-[#1b342e] transition-all cursor-pointer ${role === 'patient' ? 'border-2 border-[#426f63] bg-[#f4faf7]' : 'border-[#e2e8e5] bg-white hover:border-[#b0b8b5]'}`}
                onClick={() => setRole('patient')}
              >
                <span className="text-xl">♙</span>
                <strong className="text-[13px]">Patient</strong>
                <small className="text-[11px] opacity-60">Personal health</small>
              </button>
              <button
                type="button"
                className={`flex-1 grid justify-items-center gap-1 min-h-[76px] p-3 border rounded-xl text-[#1b342e] transition-all cursor-pointer ${role === 'doctor' ? 'border-2 border-[#426f63] bg-[#f4faf7]' : 'border-[#e2e8e5] bg-white hover:border-[#b0b8b5]'}`}
                onClick={() => setRole('doctor')}
              >
                <span className="text-xl">▣</span>
                <strong className="text-[13px]">Doctor</strong>
                <small className="text-[11px] opacity-60">Patient care</small>
              </button>
            </div>
          </fieldset>

          <div className="grid gap-4">
            <label className="grid gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase text-[#1b342e]">
              Full Name
              <input
                name="name"
                value={form.name}
                onChange={update}
                placeholder="e.g. Riya Sharma"
                className="h-12 px-4 rounded-xl border border-[#d5dbd8] bg-white text-[15px] font-sans text-[#1b342e] w-full"
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase text-[#1b342e]">
              Phone Number
              <input
                name="phone"
                type="tel"
                value={form.phone}
                onChange={update}
                placeholder="10-digit mobile number"
                inputMode="numeric"
                maxLength={10}
                className="h-12 px-4 rounded-xl border border-[#d5dbd8] bg-white text-[15px] font-sans text-[#1b342e] w-full"
              />
            </label>
            <label className="grid gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase text-[#1b342e]">
              <div>Email address <span className="opacity-50 text-[0.8em] lowercase normal-case font-normal">(optional)</span></div>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={update}
                placeholder="name@example.com"
                className="h-12 px-4 rounded-xl border border-[#d5dbd8] bg-white text-[15px] font-sans text-[#1b342e] w-full"
              />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="grid gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase text-[#1b342e]">
                Password
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={update}
                    placeholder="Create password"
                    className="h-12 px-4 pr-12 rounded-xl border border-[#d5dbd8] bg-white text-[15px] font-sans text-[#1b342e] w-full"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-lg text-[#1b342e] opacity-50 cursor-pointer hover:opacity-100"
                  >
                    {showPassword ? '◉' : '◌'}
                  </button>
                </div>
              </label>
              <label className="grid gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase text-[#1b342e]">
                Confirm Password
                <div className="relative">
                  <input
                    name="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={update}
                    placeholder="Repeat password"
                    className="h-12 px-4 pr-12 rounded-xl border border-[#d5dbd8] bg-white text-[15px] font-sans text-[#1b342e] w-full"
                  />
                  <button
                    type="button"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-transparent border-none text-lg text-[#1b342e] opacity-50 cursor-pointer hover:opacity-100"
                  >
                    {showConfirm ? '◉' : '◌'}
                  </button>
                </div>
              </label>
            </div>
            <label className="grid gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase text-[#1b342e]">
              Preferred Language
              <select
                name="preferred_language"
                value={form.preferred_language}
                onChange={update}
                className="block w-full h-12 px-4 rounded-xl border border-[#d5dbd8] bg-white text-[14.5px] font-sans text-[#1b342e] cursor-pointer mt-1"
              >
                {LANGUAGES.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="flex gap-3 items-start p-4 rounded-xl bg-[#f5fbf7] border border-[#d5dbd8] cursor-pointer text-sm leading-snug">
            <input
              name="consent"
              type="checkbox"
              checked={form.consent}
              onChange={update}
              className="mt-0.5 w-5 h-5 rounded accent-[#29574b] cursor-pointer shrink-0"
            />
            <span className="opacity-80">
              I agree to the SwasthyaSahay <u className="font-semibold cursor-pointer text-[#1b342e]">Terms of Service</u>, <u className="font-semibold cursor-pointer text-[#1b342e]">Privacy Policy</u>, and ABHA Data Consent.
            </span>
          </label>

          {error && (
            <p className="bg-[#fff0f0] text-[#ba1a1a] p-3 rounded-lg text-sm font-medium border border-[#ffdbdb]" role="alert">
              {error}
            </p>
          )}

          <button className="w-full h-12 rounded-full text-white bg-[#426f63] hover:bg-[#29574b] text-base font-bold cursor-pointer transition-all flex items-center justify-center gap-2 mt-2" type="submit" disabled={loading}>
            {loading ? 'Creating account…' : <>Create account <span>→</span></>}
          </button>

          <div className="flex items-center text-center my-2 opacity-40 text-[11px] font-bold tracking-widest before:content-[''] before:flex-1 before:border-b before:border-current before:mr-4 after:content-[''] after:flex-1 after:border-b after:border-current after:ml-4">
            <span>OR CONTINUE WITH</span>
          </div>

          <button
            className="w-full h-[46px] rounded-full border border-[#d5dbd8] bg-white text-[#1b342e] text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-3 hover:-translate-y-0.5"
            type="button"
            onClick={() => alert('Google Sign-In requires a Google Client ID. Contact your developer to enable this.')}
          >
            <strong className="text-lg">G</strong> Google
          </button>

          <p className="mt-2 text-center text-sm opacity-80">
            Already have an account? <button type="button" onClick={goLogin} className="font-semibold underline bg-transparent border-none cursor-pointer text-inherit p-0 ml-1">Log in</button>
          </p>
          <p className="text-center text-xs opacity-50 font-medium tracking-wide mt-2">
            ♡ &nbsp;256-Bit Clinical Encryption &nbsp; · &nbsp; ABHA / NDHM Compliant
          </p>
        </form>
      </section>
    </main>
  )
}