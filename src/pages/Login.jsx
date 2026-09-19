import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
import { login, googleLogin } from '../api/authApi.js'
import LanguageSelector from '../components/LanguageSelector.jsx'
import loginImage from '../assets/Login.png'

const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  '1081901212648-e0hsse3c5fmjjaatqcadj39pr27614gt.apps.googleusercontent.com'

const clinicImage = loginImage

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
      window.localStorage.setItem('SwasthyaSahay-signup-complete', 'true')
      window.localStorage.setItem('SwasthyaSahay-account-role', user.role || 'patient')
      window.localStorage.setItem('SwasthyaSahay-account-name', user.name || '')
      window.localStorage.removeItem('SwasthyaSahay-account-created')
      window.localStorage.removeItem('SwasthyaSahay-auth-mode')
      if (user.role === 'doctor') {
        // Check via API if the doctor has already completed onboarding.
        // This works across devices/browsers unlike the localStorage flag.
        try {
          const { getDoctorProfile } = await import('../api/doctorApi.js')
          const profileRes = await getDoctorProfile()
          if (profileRes?.doctor?.license_number) {
            // Doctor profile already registered — go straight to dashboard
            window.localStorage.setItem('SwasthyaSahay-doctor-info-complete', 'true')
            if (profileRes.doctor.facility?.name) {
              window.localStorage.setItem('SwasthyaSahay-doctor-facility', profileRes.doctor.facility.name)
            }
            navigate('/doctor-dashboard')
          } else {
            navigate('/doctor-info')
          }
        } catch {
          // API call failed — fall back to localStorage flag
          const doctorInfoDone = window.localStorage.getItem('SwasthyaSahay-doctor-info-complete') === 'true'
          navigate(doctorInfoDone ? '/doctor-dashboard' : '/doctor-info')
        }
      } else {
        // Returning patient logging in -> directly navigate to patient dashboard
        window.localStorage.setItem('SwasthyaSahay-vitals-complete', 'true')
        navigate('/patient-dashboard')
      }
    } catch (err) {
      setError(err.message || 'Login failed. Check your credentials and try again.')
    } finally {
      setLoading(false)
    }
  }

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
      const data = await googleLogin({ id_token: response.credential })
      const user = data.user
      window.localStorage.setItem('SwasthyaSahay-signup-complete', 'true')
      window.localStorage.setItem('SwasthyaSahay-account-role', user.role || 'patient')
      window.localStorage.setItem('SwasthyaSahay-account-name', user.name || '')
      window.localStorage.removeItem('SwasthyaSahay-account-created')
      window.localStorage.removeItem('SwasthyaSahay-auth-mode')
      if (user.role === 'doctor') {
        try {
          const { getDoctorProfile } = await import('../api/doctorApi.js')
          const profileRes = await getDoctorProfile()
          if (profileRes?.doctor?.license_number) {
            window.localStorage.setItem('SwasthyaSahay-doctor-info-complete', 'true')
            if (profileRes.doctor.facility?.name) {
              window.localStorage.setItem('SwasthyaSahay-doctor-facility', profileRes.doctor.facility.name)
            }
            navigate('/doctor-dashboard')
          } else {
            navigate('/doctor-info')
          }
        } catch {
          const doctorInfoDone = window.localStorage.getItem('SwasthyaSahay-doctor-info-complete') === 'true'
          navigate(doctorInfoDone ? '/doctor-dashboard' : '/doctor-info')
        }
      } else {
        window.localStorage.setItem('SwasthyaSahay-vitals-complete', 'true')
        navigate('/patient-dashboard')
      }
    } catch (err) {
      setError(err.message || 'Google login failed. Please try again.')
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
              <small className="block text-[10px] tracking-widest opacity-80 uppercase">CLINICAL HEALTH NETWORK</small>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <button type="button" onClick={backToLanding} className="bg-transparent border-none text-white text-sm font-semibold cursor-pointer hover:underline flex items-center gap-2">
                Back to website <span>→</span>
              </button>
            </div>
          </header>
          <div className="relative z-10 mt-12 md:mt-0">
            <blockquote className="text-2xl md:text-4xl font-serif leading-tight font-medium max-w-[500px]">
              "Longitudinal, compassionate healthcare continuity across primary care facilities and
              specialty hubs."
            </blockquote>
            <p className="mt-8 text-[11px] font-bold tracking-widest flex items-center gap-3">
              <i className="w-2 h-2 rounded-full bg-[#00ff88]" /> SwasthyaSahay CLINICAL PLATFORM • AYUSHMAN BHARAT / ABHA CONNECTED
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
              <h1 className="text-3xl md:text-4xl font-serif text-[#1b342e]">Welcome back</h1>
              <p className="text-[#59756e] mt-2 text-[15px]">Continue your journey to better care.</p>
            </header>

            <div className="grid gap-4">
              <label className="grid gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase text-[#1b342e] relative">
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
                <span className="absolute right-4 top-[36px] text-lg opacity-40">☎</span>
              </label>
              <label className="grid gap-1.5 text-[13px] font-bold tracking-[0.04em] uppercase text-[#1b342e]">
                Password
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={update}
                    placeholder="••••••••••••"
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
            </div>

            <div className="flex justify-between items-center text-[13px] font-bold text-[#1b342e] mt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input name="remember" type="checkbox" checked={form.remember} onChange={update} className="w-[18px] h-[18px] rounded cursor-pointer accent-[#29574b]" />
                {' '}Remember this workstation
              </label>
              <button type="button" className="bg-transparent border-none text-[#1b342e] font-bold underline cursor-pointer hover:text-[#426f63]">Forgot password?</button>
            </div>

            {error && (
              <p className="bg-[#fff0f0] text-[#ba1a1a] p-3 rounded-lg text-sm font-medium border border-[#ffdbdb]" role="alert">
                {error}
              </p>
            )}

            <button className="w-full h-[46px] rounded-full text-white bg-[#426f63] hover:bg-[#29574b] text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-2" type="submit" disabled={loading}>
              {loading ? 'Logging in…' : <>Log in to Clinical Portal <span>→</span></>}
            </button>

            <div className="flex items-center text-center my-4 opacity-40 text-[11px] font-bold tracking-widest before:content-[''] before:flex-1 before:border-b before:border-current before:mr-4 after:content-[''] after:flex-1 after:border-b after:border-current after:ml-4">
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

            {/* ── Sign up prompt ── */}
            <p className="mt-5 text-center text-sm opacity-80">
              Creating an account for the first time?{' '}
              <button
                type="button"
                onClick={goSignUp}
                className="font-semibold underline bg-transparent border-none cursor-pointer text-inherit p-0"
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