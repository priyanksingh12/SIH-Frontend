import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getStoredUser, logout } from '../api/apiClient.js'

function getInitials(name) { return (name || '').replace('Dr. ', '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'DR' }
const sidebarLinks = ['Dashboard', 'Patients', 'Appointments', 'Vitals & History', 'My Profile']
const sidebarIcons = ['⌂', '♧', '▣', '≋', '◎']

function DoctorSidebar({ doctorName, specialization }) {
  const navigate = useNavigate()
  return <aside className="profile-sidebar"><div className="profile-suite-brand"><span>+</span><div><strong>MediMate</strong><small>CLINICAL SUITE</small></div></div><div className="profile-doctor-mini"><div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#29574b', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '0.9rem', flexShrink: 0 }}>{getInitials(doctorName)}</div><div><b>{doctorName}</b><small>{specialization || 'Doctor'} • Attending</small></div><i /></div><button className="profile-consult" onClick={() => navigate('/doctor-patients')}>+ New Consultation</button><nav>{sidebarLinks.map((link, index) => <Link className={link === 'Dashboard' || link === 'My Profile' ? 'active' : ''} to={link === 'Patients' ? '/doctor-patients' : '/doctor-dashboard'} key={link}><span>{sidebarIcons[index]}</span>{link}</Link>)}</nav><div className="profile-sidebar-footer"><small>CLINICAL OUTLET</small><b>{window.localStorage.getItem('medimate-doctor-facility') || 'Your Facility'}</b><span>⚙</span></div></aside>
}

function CredentialCard({ licenseNumber, experienceYears }) {
  return <article className="profile-card credentials-card"><header><span>♧</span><h2>Professional<br />Credentials &amp; License</h2><b>▢</b></header><div className="credential-panel"><div className="credential-columns"><div><small>MEDICAL COUNCIL<br />LICENSE</small><strong>{licenseNumber || window.localStorage.getItem('medimate-doctor-medical-id') || 'N/A'}</strong><em>✓ Verified</em></div><div><small>CLINICAL EXPERIENCE</small><strong>{experienceYears ? `${experienceYears}+ Years Active` : 'N/A'}</strong></div></div></div></article>
}

function AccountSettings({ doctorName, email, phone }) {
  return <article className="profile-card account-card"><header><span>♙</span><h2>Account<br />Settings</h2><b>⚙</b></header><div className="setting-list"><div><small>FULL LEGAL NAME</small><strong>{doctorName}</strong></div>{email && <div><small>PRACTICE CONTACT EMAIL</small><strong>{email}</strong></div>}{phone && <div><small>CONTACT PHONE</small><strong>{phone}</strong></div>}</div></article>
}

function SpecializationCard({ specialization }) {
  return <article className="profile-card specialization-card"><header><span>♧</span><h2>Specialization &amp;<br />Clinical Focus</h2><b>A Key Focus<br />Areas</b></header><div className="specialty-tags"><span>{specialization || 'General Medicine'}</span></div><h4>CLINICAL BIOGRAPHY</h4><p>Dedicated medical professional providing quality healthcare through the MediMate Rural Health Network.</p><a href="#profile">Show Full Bio →</a></article>
}

function ScheduleCard() {
  return <article className="profile-card schedule-card"><header><span>▣</span><h2>Consultation<br />Schedule</h2><b>·</b></header><div className="schedule-list"><div><span>▣</span><p>IN-PERSON OPD TIMINGS<strong>Mon – Fri: 09:00 AM –<br />02:00 PM</strong><small>{window.localStorage.getItem('medimate-doctor-facility') || 'Your Facility'}</small></p></div><div><span>⌁</span><p>TELE-TRIAGE WINDOW<strong>Mon – Sat: 04:00 PM –<br />06:00 PM</strong><small>Prioritized rural referral queue</small></p></div></div><button>⇄ &nbsp; Adjust Practice Capacity</button></article>
}

export default function DoctorDashboard() {
  const user = getStoredUser()
  const doctorName = user?.name ? `Dr. ${user.name}` : 'Dr. Doctor'
  const email = user?.email || ''
  const phone = user?.phone || ''
  const facilityName = window.localStorage.getItem('medimate-doctor-facility') || 'Your Facility'

  // Doctor-specific info stored during DoctorInfo onboarding
  const licenseNumber = window.localStorage.getItem('medimate-doctor-medical-id') || ''
  // Specialization and experience not stored locally yet — show placeholders
  const specialization = 'General Medicine'

  return <div className="doctor-profile-page"><DoctorSidebar doctorName={doctorName} specialization={specialization} /><main className="profile-workspace"><header className="profile-topbar"><div><span>▣ &nbsp; Secure Session</span><small>Last synchronized with State Medical Registry &nbsp; ×</small></div><div><button>♧</button><div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#29574b', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '0.8rem', flexShrink: 0 }}>{getInitials(doctorName)}</div><b>{doctorName}<small>Attending Physician</small></b></div></header><div className="profile-content"><div className="profile-breadcrumb">PORTAL &nbsp;/&nbsp; PHYSICIAN WORKSPACE &nbsp;/&nbsp; DOCTOR PROFILE</div><div className="profile-title-row"><div><h1>Doctor Profile &amp;<br />Practice</h1><p>Manage your verified clinical credentials, public facility affiliations, and realtime consultation telemetry availability.</p></div><div><button>⊙ &nbsp; Export Dossier</button><button className="profile-edit">↗ &nbsp; Edit Profile</button><button onClick={logout} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '0.85rem' }}>⎋ Logout</button></div></div><section className="profile-hero-card"><div style={{ width: '80px', height: '80px', borderRadius: '50%', background: '#29574b', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 'bold', fontSize: '1.8rem', flexShrink: 0 }}>{getInitials(doctorName)}</div><div><h2>{doctorName}</h2><span>Attending Physician</span><p>Medical Professional · MediMate Rural Health Network</p><small>⌖ {facilityName} &nbsp; ◉ Registry ID: {licenseNumber || 'Pending Verification'}</small></div><div className="hero-status"><b>✓ VERIFIED CLINICIAN</b><strong>↗ AVAILABLE FOR<br />TELE-TRIAGE &amp; OPD</strong></div></section><section className="affiliation-card"><span>▣</span><div><small>PRIMARY AFFILIATION &nbsp;•&nbsp; Public Health Network</small><h2>{facilityName}</h2><p>Cardiology Department · MediMate Network</p></div><button>View Facility Overview →</button></section><div className="profile-grid"><CredentialCard licenseNumber={licenseNumber} /><AccountSettings doctorName={doctorName} email={email} phone={phone} /><SpecializationCard specialization={specialization} /><ScheduleCard /></div><blockquote className="profile-quote">"Precision diagnostics paired<br />with rural accessibility defines<br />modern cardiology."<small>MEDIMATE CLINICIAN NETWORK • 2026</small></blockquote></div></main></div>
}