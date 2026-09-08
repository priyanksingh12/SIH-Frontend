import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import MedicalShaderBg from './components/MedicalShaderBg'
import PatientDashboard from './pages/PatientDashboard'
import HealthAssistant from './pages/HealthAssistant'
import Landing from './pages/Landing'
import Login from './pages/Login'
import AccountCreated from './pages/AccountCreated'
import DoctorInfo from './pages/DoctorInfo'
import DoctorDashboard from './pages/DoctorDashboard'
import DoctorProfile from './pages/DoctorProfile'
import Doctors from './pages/Doctors'
import PatientProfile from './pages/PatientProfile'
import DoctorPatients from './pages/DoctorPatients'
import DoctorPatientProfile from './pages/DoctorPatientProfile'
import SignUp from './pages/SignUp'
import Vitals from './pages/Vitals'
import NearbyHospitals from './pages/NearbyHospitals'
import NearbyMedicalStores from './pages/NearbyMedicalStores'
import EmergencyPage from './pages/EmergencyPage'
import ChildMaternalCare from './pages/ChildMaternalCare'
import './App.css'

/**
 * Decides where to send the user when they visit "/".
 * For doctors, calls GET /doctors/profile/me to determine whether they have
 * completed onboarding — so the check works across all devices/browsers.
 */
function HomeRoute() {
  const hasToken = !!window.localStorage.getItem('medimate-access-token')
  const role = window.localStorage.getItem('medimate-account-role') || 'patient'
  const vitalsDone = window.localStorage.getItem('medimate-vitals-complete') === 'true'
  const doctorInfoDoneLocal = window.localStorage.getItem('medimate-doctor-info-complete') === 'true'

  const [doctorChecked, setDoctorChecked] = useState(doctorInfoDoneLocal)
  const [doctorProfileExists, setDoctorProfileExists] = useState(doctorInfoDoneLocal)

  useEffect(() => {
    // Only run the API check when the user is a logged-in doctor and we're not
    // already certain from localStorage that they've completed onboarding.
    if (!hasToken || role !== 'doctor' || doctorInfoDoneLocal) return

    import('./api/doctorApi.js').then(({ getDoctorProfile }) => {
      getDoctorProfile()
        .then((res) => {
          const exists = !!(res?.doctor?.license_number)
          if (exists) {
            window.localStorage.setItem('medimate-doctor-info-complete', 'true')
            if (res.doctor.facility?.name) {
              window.localStorage.setItem('medimate-doctor-facility', res.doctor.facility.name)
            }
          }
          setDoctorProfileExists(exists)
        })
        .catch(() => {
          // If API fails, trust the localStorage flag (already false here)
          setDoctorProfileExists(false)
        })
        .finally(() => setDoctorChecked(true))
    })
  }, [])

  // Not logged in at all → show landing page
  if (!hasToken) return <Landing />

  // Logged-in patient routing
  if (role !== 'doctor') {
    return <Navigate to={vitalsDone ? '/patient-dashboard' : '/vitals'} replace />
  }

  // Doctor: wait for API check before redirecting (avoids flash to wrong page)
  if (!doctorChecked) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: '#426f63', fontSize: '1rem', fontWeight: 600 }}>
        Loading…
      </div>
    )
  }

  return <Navigate to={doctorProfileExists ? '/doctor-dashboard' : '/doctor-info'} replace />
}

function ProtectedRoute({ children }) {
  const hasToken = !!window.localStorage.getItem('medimate-access-token')
  if (!hasToken) {
    return <Navigate to="/" replace />
  }
  return children
}

function App() {
  return (
    <>
      <MedicalShaderBg />
      <Router>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/account-created" element={<AccountCreated />} />
          <Route path="/doctors" element={<Doctors />} />
          <Route path="/patient-profile" element={<ProtectedRoute><PatientProfile /></ProtectedRoute>} />
          <Route path="/health-assistant" element={<ProtectedRoute><HealthAssistant /></ProtectedRoute>} />
          <Route path="/hospitals" element={<NearbyHospitals />} />
          <Route path="/stores" element={<NearbyMedicalStores />} />
          <Route path="/emergency" element={<ProtectedRoute><EmergencyPage /></ProtectedRoute>} />
          <Route path="/child-maternal-care" element={<ProtectedRoute><ChildMaternalCare /></ProtectedRoute>} />
          <Route path="/doctor-patients" element={<ProtectedRoute><DoctorPatients /></ProtectedRoute>} />
          <Route path="/doctor-patient-profile" element={<ProtectedRoute><DoctorPatientProfile /></ProtectedRoute>} />
          <Route path="/doctor-profile" element={<ProtectedRoute><DoctorProfile /></ProtectedRoute>} />
          <Route path="/doctor-info" element={<ProtectedRoute><DoctorInfo /></ProtectedRoute>} />
          <Route path="/doctor-dashboard" element={<ProtectedRoute><DoctorDashboard /></ProtectedRoute>} />
          <Route path="/vitals" element={<ProtectedRoute><Vitals /></ProtectedRoute>} />
          <Route path="/patient-dashboard" element={<ProtectedRoute><PatientDashboard /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </>
  )
}

export default App

