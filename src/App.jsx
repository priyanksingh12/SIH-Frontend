import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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
import './App.css'

/**
 * Decides where to send the user when they visit "/".
 * Uses <Navigate replace> so the URL actually changes and
 * the browser history is correct (no re-render loop).
 */
function HomeRoute() {
  const hasToken = !!window.localStorage.getItem('medimate-access-token')
  const role = window.localStorage.getItem('medimate-account-role') || 'patient'
  const vitalsDone = window.localStorage.getItem('medimate-vitals-complete') === 'true'
  const doctorInfoDone = window.localStorage.getItem('medimate-doctor-info-complete') === 'true'

  // Not logged in at all → show landing page
  if (!hasToken) return <Landing />

  // Logged-in doctor routing
  if (role === 'doctor') {
    return <Navigate to={doctorInfoDone ? '/doctor-patients' : '/doctor-info'} replace />
  }

  // Logged-in patient routing
  return <Navigate to={vitalsDone ? '/patient-dashboard' : '/vitals'} replace />
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
          <Route path="/patient-profile" element={<PatientProfile />} />
          <Route path="/health-assistant" element={<HealthAssistant />} />
          <Route path="/hospitals" element={<NearbyHospitals />} />
          <Route path="/stores" element={<NearbyMedicalStores />} />
          <Route path="/doctor-patients" element={<DoctorPatients />} />
          <Route path="/doctor-patient-profile" element={<DoctorPatientProfile />} />
          <Route path="/doctor-profile" element={<DoctorProfile />} />
          <Route path="/doctor-info" element={<DoctorInfo />} />
          <Route path="/doctor-dashboard" element={<DoctorDashboard />} />
          <Route path="/vitals" element={<Vitals />} />
          <Route path="/patient-dashboard" element={<PatientDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </>
  )
}

export default App

