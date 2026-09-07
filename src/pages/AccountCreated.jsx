import { useNavigate } from 'react-router-dom'
import { getStoredUser } from '../api/apiClient.js'

const confirmationImage = 'https://www.figma.com/api/mcp/asset/b4f97d49-77dd-45a3-9dfa-6d13057bc63e.png'

export default function AccountCreated() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const role = user?.role || window.localStorage.getItem('medimate-account-role') || 'patient'
  const name = user?.name || window.localStorage.getItem('medimate-account-name') || (role === 'doctor' ? 'Doctor' : 'Patient')
  const isDoctor = role === 'doctor'
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || (isDoctor ? 'DR' : 'PT')

  const continueToSetup = () => {
    window.localStorage.removeItem('medimate-account-created')
    if (isDoctor) {
      const doctorInfoDone = window.localStorage.getItem('medimate-doctor-info-complete') === 'true'
      navigate(doctorInfoDone ? '/doctor-dashboard' : '/doctor-info')
    } else {
      // First-time signup patient -> go to vitals page first
      navigate('/vitals')
    }
  }

  return <main className="account-created-page">
    <section className="account-created-hero">
      <div className="account-created-image" style={{ backgroundImage: `url(${confirmationImage})` }} />
      <div className="account-created-overlay" />
      <header className="account-created-brand"><div><span>＋</span><section><strong>MediMate</strong><small>WELCOME TO THE NETWORK</small></section></div><button type="button" onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontWeight: 600, fontSize: '14px' }}>← &nbsp;Back to website</button></header>
      <div className="account-created-quote"><blockquote>"Welcome to a synchronized continuum of care designed for rural clinics, specialized doctors, and empowered patients."</blockquote><div><span>CARE CONTINUITY ARCHITECTURE • ABHA SYNCED</span><b><i /><i /><i /><em /></b></div></div>
    </section>
    <section className="account-created-content">
      <div className="success-mark">✓</div>
      <h1>Account created successfully</h1>
      <p className="success-copy">Your MediMate health profile and verified clinical identity have been established. You can now access appointments, digital vitals, and intelligent referrals.</p>
      <article className="profile-preview"><div className="profile-row"><div className="profile-avatar">{initials}<i /></div><div className="profile-details"><div><strong>{name}</strong><span>{isDoctor ? 'Doctor Profile Active' : 'Patient Profile Active'}</span></div><small>{isDoctor ? 'Clinical Doctor Profile' : 'Personal Health Profile'}</small></div></div><div className="profile-registry"><span>Digital Registry</span><b>● #{user?.id?.slice(0, 8).toUpperCase() || 'MED-XXXXX'} · Synced</b></div></article>
      <button className="continue-account" onClick={continueToSetup}>{isDoctor ? 'Continue to doctor setup' : 'Continue to MediMate'} <span>→</span></button>
      <p className="account-help">Need help setting up your {isDoctor ? 'facility or clinical records' : 'health profile'}? <a href="mailto:support@medimate.org">Contact MediMate Support</a></p>
      <div className="account-security">♧ &nbsp; End-to-end encrypted clinical compliance &amp; ISO 27001 standard</div>
    </section>
  </main>
}