import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { signup, googleLogin } from '../api/authApi.js'
import LanguageSelector from '../components/LanguageSelector.jsx'
import signupImage from '../assets/Signup.png'

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1081901212648-e0hsse3c5fmjjaatqcadj39pr27614gt.apps.googleusercontent.com'

const clinicImage = signupImage

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

  const roleRef = useRef(role)
  const langRef = useRef(form.preferred_language)

  useEffect(() => {
    roleRef.current = role
  }, [role])

  useEffect(() => {
    langRef.current = form.preferred_language
  }, [form.preferred_language])

  const googleBtnRef = useRef(null)
  const [googleReady, setGoogleReady] = useState(false)

  const handleGoogleSuccess = async (response) => {
    if (!response?.credential) {
      setError('Google Sign-In was cancelled or failed.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const data = await googleLogin({
        id_token: response.credential,
        role: roleRef.current || 'patient',
        preferred_language: langRef.current || 'en',
      })
      const user = data.user
      window.localStorage.setItem('SwasthyaSahay-signup-complete', 'true')
      window.localStorage.setItem('SwasthyaSahay-account-role', user.role || roleRef.current || 'patient')
      window.localStorage.setItem('SwasthyaSahay-account-name', user.name || '')
      window.localStorage.setItem('SwasthyaSahay-account-email', user.email || '')
      window.localStorage.removeItem('SwasthyaSahay-auth-mode')
      if (user.role === 'doctor') {
        navigate('/doctor-info')
      } else {
        navigate('/account-created')
      }
    } catch (err) {
      setError(err.message || 'Google signup failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const initGoogle = () => {
      if (window.google?.accounts?.id && googleBtnRef.current) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSuccess,
          })
          googleBtnRef.current.innerHTML = ''
          window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'outline',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            width: googleBtnRef.current.offsetWidth || 340,
          })
          setGoogleReady(true)
        } catch (e) {
          console.error('Google button render error:', e)
        }
      }
    }

    if (window.google?.accounts?.id) {
      initGoogle()
    } else {
      const timer = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(timer)
          initGoogle()
        }
      }, 300)
      return () => clearInterval(timer)
    }
  }, [])

  return (
    <main className="min-h-screen grid place-items-center p-6 bg-transparent text-[#1b342e]">
      <section className="w-full max-w-[1440px] min-h-[640px] flex flex-col md:flex-row overflow-hidden border border-[rgba(229,235,231,0.8)] rounded-[28px]">
        {/* ── Left hero panel ── */}
        <section className="relative md:flex-1 flex flex-col justify-between p-8 md:p-14 overflow-hidden text-white min-h-[300px] order-1 md:order-none">
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${clinicImage})` }} />
          <div className="absolute inset-0 bg-[rgba(41,87,75,0.85)]" />
          <header className="relative z-10 flex items-center justify-between gap-4">
            <div>
              <div className="font-serif text-2xl font-bold tracking-tight text-white">SwasthyaSahay</div>
              <small className="block text-[10px] tracking-widest opacity-80 uppercase">CONNECTED HEALTHCARE ECOSYSTEM</small>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={backToLanding} className="bg-transparent border-none text-white text-sm font-semibold cursor-pointer hover:underline flex items-center gap-2">
                Back to website <span>→</span>
              </button>
            </div>
          </header>
          <div className="relative z-10 mt-12 md:mt-0">
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
        <section className="relative w-full md:w-1/2 flex flex-col justify-between p-8 md:p-12 overflow-auto bg-[rgba(252,253,252,0.92)] order-2 md:order-none">
          <div className="absolute top-4 right-4 sm:top-6 sm:right-8 z-20">
            <LanguageSelector />
          </div>
          <form className="w-full max-w-[480px] mx-auto grid gap-5" onSubmit={submit}>
          <header className="mb-2">
            <h1 className="text-3xl md:text-4xl font-serif text-[#1b342e]">Create your account</h1>
            <p className="text-[#59756e] mt-2 text-[15px]">Personalize your healthcare experience.</p>
          </header>

          <fieldset className="m-0 p-0 border-none grid gap-3">
            <legend className="text-[11px] font-bold tracking-[0.08em] text-[#59756e] mb-2 uppercase">SELECT YOUR ROLE</legend>
            <div className="flex gap-4">
              <button
                type="button"
                className={`flex-1 relative grid justify-items-center gap-1 min-h-[82px] p-3.5 border rounded-2xl transition-all cursor-pointer ${
                  role === 'patient'
                    ? 'border-2 border-[#29574b] bg-[#daf3e4] text-[#17382f] shadow-sm ring-2 ring-[#29574b]/25 font-semibold scale-[1.02]'
                    : 'border border-[#d5dbd8] bg-white text-[#59756e] hover:border-[#29574b]/50 hover:bg-[#f9fbf9]'
                }`}
                onClick={() => setRole('patient')}
              >
                {role === 'patient' && (
                  <span className="absolute top-2 right-2.5 w-4 h-4 rounded-full bg-[#29574b] text-[#00ff88] text-[10px] font-extrabold grid place-items-center">✓</span>
                )}
                <span className={`text-xl ${role === 'patient' ? 'text-[#29574b] font-bold' : ''}`}>♙</span>
                <strong className={`text-[14px] ${role === 'patient' ? 'text-[#17382f] font-bold' : 'text-[#1b342e]'}`}>Patient</strong>
                <small className={`text-[11px] ${role === 'patient' ? 'text-[#29574b] font-medium' : 'opacity-60'}`}>Personal health</small>
              </button>
              <button
                type="button"
                className={`flex-1 relative grid justify-items-center gap-1 min-h-[82px] p-3.5 border rounded-2xl transition-all cursor-pointer ${
                  role === 'doctor'
                    ? 'border-2 border-[#29574b] bg-[#daf3e4] text-[#17382f] shadow-sm ring-2 ring-[#29574b]/25 font-semibold scale-[1.02]'
                    : 'border border-[#d5dbd8] bg-white text-[#59756e] hover:border-[#29574b]/50 hover:bg-[#f9fbf9]'
                }`}
                onClick={() => setRole('doctor')}
              >
                {role === 'doctor' && (
                  <span className="absolute top-2 right-2.5 w-4 h-4 rounded-full bg-[#29574b] text-[#00ff88] text-[10px] font-extrabold grid place-items-center">✓</span>
                )}
                <span className={`text-xl ${role === 'doctor' ? 'text-[#29574b] font-bold' : ''}`}>▣</span>
                <strong className={`text-[14px] ${role === 'doctor' ? 'text-[#17382f] font-bold' : 'text-[#1b342e]'}`}>Doctor</strong>
                <small className={`text-[11px] ${role === 'doctor' ? 'text-[#29574b] font-medium' : 'opacity-60'}`}>Patient care</small>
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-[#59756e] hover:text-[#1b342e] cursor-pointer flex items-center justify-center p-1 transition-colors"
                  >
                    {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
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
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 bg-transparent border-none text-[#59756e] hover:text-[#1b342e] cursor-pointer flex items-center justify-center p-1 transition-colors"
                  >
                    {showConfirm ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
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

          <div className="w-full flex flex-col items-center justify-center">
            <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
            {!googleReady && (
              <button
                className="w-full h-[46px] rounded-full border border-[#d5dbd8] bg-white text-[#1b342e] text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-3 hover:-translate-y-0.5 shadow-sm"
                type="button"
                onClick={() => {
                  if (window.google?.accounts?.id) {
                    window.google.accounts.id.prompt()
                  } else {
                    setError('Google Sign-In is initializing. Please try again in a moment.')
                  }
                }}
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                </svg>
                Continue with Google
              </button>
            )}
          </div>

          <p className="mt-2 text-center text-sm opacity-80">
            Already have an account? <button type="button" onClick={goLogin} className="font-semibold underline bg-transparent border-none cursor-pointer text-inherit p-0 ml-1">Log in</button>
          </p>
          <p className="text-center text-xs opacity-50 font-medium tracking-wide mt-2">
            ♡ &nbsp;256-Bit Clinical Encryption &nbsp; · &nbsp; ABHA / NDHM Compliant
          </p>
        </form>
      </section>
    </section>
  </main>
  )
}