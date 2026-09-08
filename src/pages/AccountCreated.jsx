import { useNavigate } from 'react-router-dom'
import { getStoredUser } from '../api/apiClient.js'

const confirmationImage = 'https://www.figma.com/api/mcp/asset/b4f97d49-77dd-45a3-9dfa-6d13057bc63e.png'

export default function AccountCreated() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const role = user?.role || window.localStorage.getItem('SwasthyaSahay-account-role') || 'patient'
  const name = user?.name || window.localStorage.getItem('SwasthyaSahay-account-name') || (role === 'doctor' ? 'Doctor' : 'Patient')
  const isDoctor = role === 'doctor'
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || (isDoctor ? 'DR' : 'PT')

  const continueToSetup = () => {
    window.localStorage.removeItem('SwasthyaSahay-account-created')
    if (isDoctor) {
      const doctorInfoDone = window.localStorage.getItem('SwasthyaSahay-doctor-info-complete') === 'true'
      navigate(doctorInfoDone ? '/doctor-dashboard' : '/doctor-info')
    } else {
      // First-time signup patient -> go to vitals page first
      navigate('/vitals')
    }
  }

  return <main className="min-h-screen bg-[#fcfdfc] text-[#1b342e]">
    <section className="relative h-[240px] md:h-[320px] overflow-hidden text-white flex flex-col justify-end p-8 bg-[rgba(53,89,79,0.95)]">
      <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${confirmationImage})` }} />
      <div className="absolute inset-0 bg-[rgba(41,87,75,0.85)]" />
      <header className="absolute top-8 left-8 right-8 flex justify-between items-center z-10">
        <div>
          <div className="font-serif text-2xl font-bold tracking-tight text-white">SwasthyaSahay</div>
          <small className="text-[9px] tracking-widest opacity-80 uppercase block">WELCOME TO THE NETWORK</small>
        </div>
        <button type="button" onClick={() => navigate('/')} className="bg-transparent border-none text-white font-semibold text-sm cursor-pointer hover:underline hidden md:block">← &nbsp;Back to website</button>
      </header>
      <div className="relative z-10 max-w-[800px]">
        <blockquote className="text-xl md:text-3xl font-serif font-medium leading-tight">"Welcome to a synchronized continuum of care designed for rural clinics, specialized doctors, and empowered patients."</blockquote>
        <div className="mt-4 flex items-center gap-3 text-[10px] font-bold tracking-widest uppercase">
          <span>CARE CONTINUITY ARCHITECTURE • ABHA SYNCED</span>
          <b className="flex gap-1.5"><i className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" /><i className="w-1.5 h-1.5 rounded-full bg-white opacity-50" /><i className="w-1.5 h-1.5 rounded-full bg-white opacity-50" /><em className="w-6 h-1.5 rounded-full bg-white opacity-20 ml-1" /></b>
        </div>
      </div>
    </section>
    <section className="max-w-[640px] mx-auto p-8 md:p-16 text-center flex flex-col items-center">
      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-[#e3f2ec] text-[#29574b] text-3xl md:text-4xl flex items-center justify-center mb-6 shadow-sm">✓</div>
      <h1 className="text-3xl md:text-5xl font-serif text-[#1b342e] mb-4">Account created successfully</h1>
      <p className="text-[#59756e] text-sm md:text-base leading-relaxed mb-10 max-w-[480px]">Your SwasthyaSahay health profile and verified clinical identity have been established. You can now access appointments, digital vitals, and intelligent referrals.</p>
      <article className="w-full text-left bg-white border border-[#d5dbd8] rounded-2xl p-6 shadow-[0_8px_24px_rgba(41,87,75,0.04)] mb-8">
        <div className="flex items-center gap-5 pb-5 border-b border-[#f0f4f2]">
          <div className="relative w-14 h-14 rounded-full bg-[#1b342e] text-white text-lg font-bold flex items-center justify-center shrink-0">
            {initials}
            <i className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00ff88] border-2 border-white rounded-full" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-3 flex-wrap">
              <strong className="text-xl text-[#1b342e]">{name}</strong>
              <span className="text-[10px] font-bold tracking-widest text-[#29574b] bg-[#e3f2ec] px-2 py-0.5 rounded uppercase">{isDoctor ? 'Doctor Profile Active' : 'Patient Profile Active'}</span>
            </div>
            <small className="text-sm text-[#59756e] mt-0.5">{isDoctor ? 'Clinical Doctor Profile' : 'Personal Health Profile'}</small>
          </div>
        </div>
        <div className="pt-4 flex justify-between items-center text-xs">
          <span className="text-[#59756e] font-medium">Digital Registry</span>
          <b className="text-[#1b342e] flex items-center gap-1.5"><span className="text-[#00ff88] text-[8px]">●</span> #{user?.id?.slice(0, 8).toUpperCase() || 'MED-XXXXX'} · Synced</b>
        </div>
      </article>
      <button className="w-full md:w-auto px-8 h-14 rounded-full bg-[#29574b] hover:bg-[#1b342e] text-white font-bold text-base cursor-pointer transition-all flex items-center justify-center gap-3 shadow-md" onClick={continueToSetup}>{isDoctor ? 'Continue to doctor setup' : 'Continue to SwasthyaSahay'} <span>→</span></button>
      <p className="mt-8 text-sm text-[#59756e]">Need help setting up your {isDoctor ? 'facility or clinical records' : 'health profile'}? <a className="font-semibold text-[#29574b] underline hover:text-[#1b342e]" href="mailto:support@SwasthyaSahay.org">Contact SwasthyaSahay Support</a></p>
      <div className="mt-12 text-[11px] font-bold tracking-widest uppercase text-[#59756e] opacity-60">♧ &nbsp; End-to-end encrypted clinical compliance &amp; ISO 27001 standard</div>
    </section>
  </main>
}