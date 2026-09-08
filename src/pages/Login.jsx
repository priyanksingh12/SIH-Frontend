import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FaEye, FaEyeSlash } from 'react-icons/fa'
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
            <button type="button" onClick={backToLanding} className="ml-auto bg-transparent border-none text-white text-sm font-semibold cursor-pointer hover:underline flex items-center gap-2">
              Back to website <span>→</span>
            </button>
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
          <div className="absolute top-6 right-8 text-xs font-bold tracking-widest border border-[#d5dbd8] rounded-full px-4 py-2 cursor-pointer bg-white hidden md:block text-[#1b342e]">◎ &nbsp; English (IN) &nbsp;⌄</div>
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

            <button
              className="w-full h-[46px] rounded-full border border-[#d5dbd8] bg-white text-[#1b342e] text-sm font-bold cursor-pointer transition-all flex items-center justify-center gap-3 hover:-translate-y-0.5"
              type="button"
              onClick={() => alert('Google Sign-In requires a Google Client ID. Contact your developer to enable this.')}
            >
              <strong className="text-lg">G</strong> Google
            </button>

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