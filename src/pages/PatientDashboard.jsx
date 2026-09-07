import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import {
  Heart,
  Activity,
  Droplets,
  Wind,
  TrendingUp,
  Building2,
  ShoppingBag,
  Calendar,
  PlusCircle,
  Sparkles,
  Clock,
  CheckCircle2,
  Bell,
  ArrowUpRight,
  BarChart3,
  Stethoscope,
  User,
  LogOut,
  AlertCircle,
  Video,
  MessageSquare,
} from 'lucide-react'
import { getStoredUser, logout } from '../api/apiClient.js'
import { getVitals } from '../api/patientApi.js'
import { getAppointments } from '../api/appointmentApi.js'
import ChatModal from '../components/ChatModal.jsx'
import VideoCallModal from '../components/VideoCallModal.jsx'
import IncomingCallModal from '../components/IncomingCallModal.jsx'
import { useCallListener } from '../hooks/useDoctorCallListener.js'

const navItems = [
  [BarChart3,    'Dashboard'],
  [Sparkles,     'Health Assistant'],
  [Stethoscope,  'Doctors'],
  [Building2,    'Hospitals'],
  [ShoppingBag,  'Stores'],
  [Calendar,     'Records'],
  [User,         'My Profile'],
]

const aiAssistantRobotIcon = 'https://www.figma.com/api/mcp/asset/bb9f184c-e1eb-46d6-be83-b9c84347fa7d.svg'

const journey = [
  ['Screening', 'Oct 12'],
  ['Referral', 'Oct 15'],
  ['Appointment', 'Nov 2'],
  ['Consultation', 'Pending'],
  ['Diagnostics', '—'],
  ['Treatment', '—'],
  ['Follow-up', '—'],
]

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatRecordDate(isoString) {
  if (!isoString) return 'Recently'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return 'Recently'

  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${dateStr}, ${timeStr}`
}

function formatFullRecordDate(isoString) {
  if (!isoString) return 'Recorded Recently'
  const d = new Date(isoString)
  if (isNaN(d.getTime())) return 'Recorded Recently'

  const dateStr = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} at ${timeStr}`
}

function formatSlot(slot) {
  if (!slot) return 'Scheduled Time'
  const d = new Date(slot)
  if (isNaN(d.getTime())) return 'Scheduled Time'
  return d.toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function getMergedVitalsList(backendList) {
  const localList = JSON.parse(window.localStorage.getItem('medimate-vitals-history') || '[]')
  const combined = [...localList, ...(backendList || [])]

  const seen = new Set()
  const unique = []

  for (const item of combined) {
    if (!item) continue
    const timestampKey = item.created_at ? new Date(item.created_at).getTime() : 0
    const valKey = `${timestampKey}_${item.bp}_${item.sugar}_${item.spo2}_${item.hr}`
    if (!seen.has(valKey)) {
      seen.add(valKey)
      unique.push(item)
    }
  }

  unique.sort((a, b) => {
    const timeA = a.created_at ? new Date(a.created_at).getTime() : 0
    const timeB = b.created_at ? new Date(b.created_at).getTime() : 0
    return timeB - timeA
  })

  return unique
}

function buildChartPoints(uniqueVitals) {
  if (!uniqueVitals || uniqueVitals.length === 0) return []

  const reversed = [...uniqueVitals].reverse()

  return reversed.map((item, index) => {
    let systolic = 118
    let diastolic = 76
    if (item.bp && typeof item.bp === 'string' && item.bp.includes('/')) {
      const parts = item.bp.split('/')
      systolic = parseInt(parts[0], 10) || 118
      diastolic = parseInt(parts[1], 10) || 76
    }

    const xAxisLabel = formatRecordDate(item.created_at)
    const fullDateLabel = formatFullRecordDate(item.created_at)

    return {
      id: item.id || `entry_${index}`,
      date: xAxisLabel,
      fullDate: fullDateLabel,
      rawDate: item.created_at,
      systolic,
      diastolic,
      sugar: item.sugar != null ? Number(item.sugar) : 92,
      spo2: item.spo2 != null ? Number(item.spo2) : 98,
      hr: item.hr != null ? Number(item.hr) : 72,
      bpStr: item.bp || `${systolic}/${diastolic}`,
      riskLevel: item.risk_level || 'low',
      notes: item.notes || '',
    }
  })
}

function CustomTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    const pointData = payload[0].payload
    return (
      <div style={{
        background: '#1b342e',
        color: '#fff',
        padding: '14px 18px',
        borderRadius: '16px',
        boxShadow: '0 12px 30px rgba(0,0,0,0.3)',
        border: '1px solid #426f63',
        fontSize: '0.95rem'
      }}>
        <div style={{ fontWeight: 800, marginBottom: '8px', color: '#00ff88', borderBottom: '1px solid rgba(255,255,255,0.15)', paddingBottom: '6px' }}>
          📅 {pointData.fullDate || pointData.date}
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginTop: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: entry.color }} />
              <span style={{ color: '#d1fae5', textTransform: 'capitalize' }}>{entry.name}:</span>
            </div>
            <strong style={{ color: '#fff', fontWeight: 800 }}>{entry.value}</strong>
          </div>
        ))}
        {pointData.notes && (
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', color: '#a7f3d0' }}>
            📝 <em>Note: {pointData.notes}</em>
          </div>
        )}
      </div>
    )
  }
  return null
}

export function TopBar({ userName }) {
  const navigate = useNavigate()
  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'PT'
  return (
    <header className="topbar">
      <a className="brand" href="#dashboard" onClick={(e) => { e.preventDefault(); navigate('/patient-dashboard') }} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ display: 'grid', placeItems: 'center', width: '28px', height: '28px', borderRadius: '8px', background: '#00ff88', color: '#171d1b', fontWeight: '900', fontSize: '1.2rem', lineHeight: 1 }}>✚</span>
        <span>MediMate</span>
      </a>
      <div className="top-actions">
        <motion.button onClick={() => navigate('/health-assistant')} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} className="dashboard-assistant">
          <img src={aiAssistantRobotIcon} alt="" /> AI Assistant
        </motion.button>
        <button className="dashboard-notifications" aria-label="Notifications">
          <Bell size={16} />
          <span />
        </button>
        <div className="dashboard-profile" onClick={() => navigate('/patient-profile')} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: '800', fontSize: '0.95rem' }}>
            {initials}
          </div>
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#171d1b' }}>{userName}</span>
        </div>
      </div>
    </header>
  )
}

export function Sidebar({ userName, activeLabel = 'Dashboard' }) {
  const navigate = useNavigate()
  const initials = userName.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'PT'

  const handleLogout = () => {
    logout()
  }

  return (
    <aside className="sidebar">
      <div className="profile" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', fontWeight: '800', fontSize: '1.2rem', flexShrink: 0, boxShadow: '0 4px 10px rgba(41,87,75,0.2)' }}>
          {initials}
        </div>
        <div>
          <strong style={{ fontSize: '1.05rem', color: '#171d1b' }}>{userName}</strong>
          <span style={{ fontSize: '0.85rem', color: '#404845', fontWeight: 600 }}>Premium Patient</span>
        </div>
      </div>
      <nav className="side-links" aria-label="Dashboard navigation">
        {navItems.map(([Icon, label]) => {
          const isActive = label === activeLabel
          const href =
            label === 'Dashboard'      ? '/' :
            label === 'Doctors'        ? '/doctors' :
            label === 'My Profile'     ? '/patient-profile' :
            label === 'Health Assistant' ? '/health-assistant' :
            label === 'Hospitals'      ? '/hospitals' :
            label === 'Stores'         ? '/stores' :
            `#${label.toLowerCase().replaceAll(' ', '-')}`
          return (
            <a
              className={isActive ? 'active' : ''}
              href={href}
              onClick={(event) => {
                event.preventDefault()
                if (label === 'Dashboard') {
                  window.localStorage.setItem('medimate-vitals-complete', 'true')
                  navigate('/patient-dashboard')
                } else if (label === 'Doctors') {
                  window.sessionStorage.setItem('medimate-doctors-entry', 'true')
                  navigate('/doctors')
                } else if (label === 'My Profile') {
                  navigate('/patient-profile')
                } else if (label === 'Health Assistant') {
                  navigate('/health-assistant')
                } else if (label === 'Hospitals') {
                  navigate('/hospitals')
                } else if (label === 'Stores') {
                  navigate('/stores')
                }
              }}
              key={label}
              style={{ fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <Icon size={18} />
              {label}
            </a>
          )
        })}
      </nav>
      <div style={{ marginTop: 'auto', display: 'grid', gap: '12px' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            window.localStorage.removeItem('medimate-vitals-complete')
            navigate('/vitals')
          }}
          style={{ width: '100%', padding: '14px 20px', borderRadius: '999px', background: '#00ff88', color: '#171d1b', fontWeight: 800, fontSize: '1rem', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <PlusCircle size={18} /> Log New Vitals
        </motion.button>
        <button
          onClick={handleLogout}
          style={{ width: '100%', padding: '12px 20px', borderRadius: '999px', background: 'transparent', color: '#9a4638', fontWeight: 700, fontSize: '0.95rem', border: '1px solid rgba(154,70,56,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </div>
    </aside>
  )
}

function MiniSparkline({ data, dataKey, strokeColor, gradientId }) {
  if (!data || data.length === 0) return null
  return (
    <div style={{ width: '100%', height: '60px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={strokeColor} stopOpacity={0.4} />
              <stop offset="95%" stopColor={strokeColor} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={strokeColor} strokeWidth={2.5} fillOpacity={1} fill={`url(#${gradientId})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function HealthScoreGauge({ score = 85, riskLevel = 'low' }) {
  const gaugeColor = riskLevel === 'high' ? '#f43f5e' : riskLevel === 'moderate' ? '#f59e0b' : '#10b981'
  const data = [
    { name: 'Score', value: score, color: gaugeColor },
    { name: 'Remaining', value: 100 - score, color: '#e4e9e6' },
  ]

  return (
    <div style={{ position: 'relative', width: '190px', height: '190px', margin: '0 auto' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={64}
            outerRadius={84}
            startAngle={225}
            endAngle={-45}
            dataKey="value"
            stroke="none"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
      }}>
        <motion.strong
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          style={{ fontSize: '2.8rem', fontWeight: 800, color: '#29574b', lineHeight: 1 }}
        >
          {score}
        </motion.strong>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#717975', letterSpacing: '1px', marginTop: '4px' }}>SCORE</span>
      </div>
    </div>
  )
}

/* =========================================================================
 * HEALTH INDEX — clinically severity-aware, non-averaging risk calculation
 * =========================================================================
 * Each vital is classified independently into a severity level:
 *   0 = normal, 1 = moderate, 2 = high, 3 = very high/urgent, 4 = critical
 * (Blood pressure supports the full 0-4 scale; sugar/SpO2/heart rate use
 * 0,1,2,4 — they still compare correctly against BP on the same scale.)
 * The OVERALL result is driven by the single worst vital, never an average.
 * ========================================================================= */

const HEALTH_LEVEL = {
  NORMAL: 0,
  MODERATE: 1,
  HIGH: 2,
  VERY_HIGH: 3,
  CRITICAL: 4,
}

function classifyBloodPressure(sys, dia) {
  let sysLevel = HEALTH_LEVEL.NORMAL
  if (sys >= 180) sysLevel = HEALTH_LEVEL.CRITICAL
  else if (sys >= 160) sysLevel = HEALTH_LEVEL.VERY_HIGH
  else if (sys >= 140) sysLevel = HEALTH_LEVEL.HIGH
  else if (sys >= 130) sysLevel = HEALTH_LEVEL.MODERATE

  let diaLevel = HEALTH_LEVEL.NORMAL
  if (dia >= 120) diaLevel = HEALTH_LEVEL.CRITICAL
  else if (dia >= 110) diaLevel = HEALTH_LEVEL.VERY_HIGH
  else if (dia >= 90) diaLevel = HEALTH_LEVEL.HIGH
  else if (dia >= 85) diaLevel = HEALTH_LEVEL.MODERATE

  // Use whichever reading (systolic or diastolic) is more severe.
  return Math.max(sysLevel, diaLevel)
}

function classifyBloodSugar(value) {
  // NOTE: the vitals API does not currently indicate whether this reading is
  // fasting, random/post-prandial, or another measurement type. We do NOT
  // assume "fasting" — these ranges are general glucose-severity bands and
  // should be refined once the measurement context is available.
  if (value < 54 || value >= 300) return HEALTH_LEVEL.CRITICAL
  if (value < 70 || (value >= 200 && value < 300)) return HEALTH_LEVEL.HIGH
  if ((value >= 70 && value < 80) || (value >= 140 && value < 200)) return HEALTH_LEVEL.MODERATE
  return HEALTH_LEVEL.NORMAL // 80-139
}

function classifySpo2(value) {
  if (value <= 85) return HEALTH_LEVEL.CRITICAL
  if (value <= 90) return HEALTH_LEVEL.HIGH
  if (value <= 94) return HEALTH_LEVEL.MODERATE
  return HEALTH_LEVEL.NORMAL // >= 95
}

function classifyHeartRate(value) {
  if (value < 40 || value > 130) return HEALTH_LEVEL.CRITICAL
  if (value < 50 || value > 110) return HEALTH_LEVEL.HIGH
  if (value < 60 || value > 100) return HEALTH_LEVEL.MODERATE
  return HEALTH_LEVEL.NORMAL // 60-100
}

const VITAL_LABELS = {
  bp: 'Blood Pressure',
  sugar: 'Blood Sugar',
  spo2: 'SpO2',
  hr: 'Heart Rate',
}

const VITAL_MESSAGES = {
  bp: {
    [HEALTH_LEVEL.MODERATE]: 'Blood pressure is elevated — monitor and consider lifestyle changes.',
    [HEALTH_LEVEL.HIGH]: 'Blood pressure is high — please consult a doctor.',
    [HEALTH_LEVEL.VERY_HIGH]: 'Blood pressure is very high — urgent action required.',
    [HEALTH_LEVEL.CRITICAL]: 'Blood pressure is at a critical/emergency level — seek immediate medical attention.',
  },
  sugar: {
    [HEALTH_LEVEL.MODERATE]: 'Blood sugar is outside the normal range — monitor your levels.',
    [HEALTH_LEVEL.HIGH]: 'Blood sugar is significantly abnormal — please consult a doctor.',
    [HEALTH_LEVEL.CRITICAL]: 'Blood sugar is at a very high/critical level — urgent action required.',
  },
  spo2: {
    [HEALTH_LEVEL.MODERATE]: 'Oxygen saturation is mildly reduced — monitor closely.',
    [HEALTH_LEVEL.HIGH]: 'Oxygen saturation is significantly reduced — please consult a doctor.',
    [HEALTH_LEVEL.CRITICAL]: 'Oxygen saturation is critically low — urgent action required.',
  },
  hr: {
    [HEALTH_LEVEL.MODERATE]: 'Heart rate is mildly abnormal — monitor closely.',
    [HEALTH_LEVEL.HIGH]: 'Heart rate is significantly abnormal — please consult a doctor.',
    [HEALTH_LEVEL.CRITICAL]: 'Heart rate is extremely abnormal — urgent action required.',
  },
}

// Score reflects the severity of the WORST vital, not an average of all four.
const LEVEL_SCORE = {
  [HEALTH_LEVEL.NORMAL]: 92,
  [HEALTH_LEVEL.MODERATE]: 72,
  [HEALTH_LEVEL.HIGH]: 50,
  [HEALTH_LEVEL.VERY_HIGH]: 30,
  [HEALTH_LEVEL.CRITICAL]: 12,
}

function calculateHealthIndex(vitalsList) {
  if (!vitalsList || vitalsList.length === 0) {
    return {
      score: 0,
      riskLevel: 'low',
      statusText: 'No Vitals Logged',
      statusColor: '#717975',
      hasVitals: false,
    }
  }

  const latest = vitalsList[0]
  const vitalLevels = [] // { key, level }

  // 1. Blood Pressure
  if (latest.bp && typeof latest.bp === 'string' && latest.bp.includes('/')) {
    const parts = latest.bp.split('/')
    const sys = parseInt(parts[0], 10)
    const dia = parseInt(parts[1], 10)
    if (!isNaN(sys) && !isNaN(dia)) {
      vitalLevels.push({ key: 'bp', level: classifyBloodPressure(sys, dia) })
    }
  }

  // 2. Blood Sugar
  if (latest.sugar != null && !isNaN(Number(latest.sugar))) {
    vitalLevels.push({ key: 'sugar', level: classifyBloodSugar(Number(latest.sugar)) })
  }

  // 3. SpO2
  if (latest.spo2 != null && !isNaN(Number(latest.spo2))) {
    vitalLevels.push({ key: 'spo2', level: classifySpo2(Number(latest.spo2)) })
  }

  // 4. Heart Rate
  if (latest.hr != null && !isNaN(Number(latest.hr))) {
    vitalLevels.push({ key: 'hr', level: classifyHeartRate(Number(latest.hr)) })
  }

  // Severity-first: the OVERALL result is the single worst vital, never an average.
  let worst = { key: null, level: HEALTH_LEVEL.NORMAL }
  for (const v of vitalLevels) {
    if (v.level > worst.level) worst = v
  }

  // Backend-supplied risk_level can only escalate the result, never soften it
  // below what the raw vitals already indicate.
  if (latest.risk_level === 'high' && worst.level < HEALTH_LEVEL.HIGH) {
    worst = { key: worst.key, level: HEALTH_LEVEL.HIGH }
  } else if (latest.risk_level === 'moderate' && worst.level < HEALTH_LEVEL.MODERATE) {
    worst = { key: worst.key, level: HEALTH_LEVEL.MODERATE }
  }

  const score = LEVEL_SCORE[worst.level]

  // riskLevel stays constrained to the three values the existing UI
  // (HealthScoreGauge, status pills) already knows how to color.
  let riskLevel = 'low'
  if (worst.level >= HEALTH_LEVEL.HIGH) riskLevel = 'high'
  else if (worst.level === HEALTH_LEVEL.MODERATE) riskLevel = 'moderate'

  const statusColor =
    riskLevel === 'high' ? '#f43f5e' : riskLevel === 'moderate' ? '#f59e0b' : '#10b981'

  let statusText = 'Optimal / Low Risk'
  let primaryConcern = null

  if (worst.level > HEALTH_LEVEL.NORMAL && worst.key) {
    primaryConcern = VITAL_LABELS[worst.key]
    statusText = VITAL_MESSAGES[worst.key]?.[worst.level] || 'One or more vitals are outside the normal range — please consult a doctor.'
  }

  return {
    score,
    riskLevel,
    statusText,
    statusColor,
    hasVitals: true,
    // Additional internal fields (not required by existing UI, but available
    // to any consumer that wants the underlying detail):
    primaryConcern,
    worstLevel: worst.level,
    vitalLevels,
  }
}

export default function PatientDashboard() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const userName = user?.name || window.localStorage.getItem('medimate-account-name') || 'there'
  const firstName = userName.split(' ')[0]
  const patientId = user?.id

  const [vitalsList, setVitalsList] = useState([])
  const [activeTab, setActiveTab] = useState('all')
  const [appointments, setAppointments] = useState([])
  const [appointmentsLoading, setAppointmentsLoading] = useState(true)
  const [activeChatAppt, setActiveChatAppt] = useState(null)
  const [activeVideoAppt, setActiveVideoAppt] = useState(null)

  // Background incoming call listener for patient
  const { incomingCall, setIncomingCall, declineIncomingCall } = useCallListener(appointments, !!activeVideoAppt)

  const handleAcceptIncomingCall = () => {
    if (incomingCall?.appointment) {
      const appt = incomingCall.appointment
      const sdp = incomingCall.sdp
      setIncomingCall(null)
      setActiveVideoAppt({
        ...appt,
        isInitiator: false,
        autoAccept: true,
        initialOffer: sdp,
      })
    }
  }

  useEffect(() => {
    getAppointments()
      .then((data) => setAppointments(data || []))
      .catch(() => setAppointments([]))
      .finally(() => setAppointmentsLoading(false))
  }, [])

  useEffect(() => {
    if (patientId) {
      getVitals(patientId)
        .then((data) => {
          const merged = getMergedVitalsList(data || [])
          setVitalsList(merged)
        })
        .catch(() => {
          const merged = getMergedVitalsList([])
          setVitalsList(merged)
        })
    } else {
      const merged = getMergedVitalsList([])
      setVitalsList(merged)
    }
  }, [patientId])

  const chartData = buildChartPoints(vitalsList)

  const latestVitals = vitalsList[0] || null
  const prevVitals = vitalsList[1] || null

  const bpValue = latestVitals?.bp || 'Not recorded'
  const sugarValue = latestVitals?.sugar != null ? String(latestVitals.sugar) : 'Not recorded'
  const spo2Value = latestVitals?.spo2 != null ? `${latestVitals.spo2}%` : 'Not recorded'
  const hrValue = latestVitals?.hr != null ? String(latestVitals.hr) : 'Not recorded'

  const healthIndex = calculateHealthIndex(vitalsList)
  const riskLevel = healthIndex.riskLevel
  const riskScore = healthIndex.score
  const recommendation = latestVitals?.recommendation || (latestVitals ? 'All vitals within normal parameters.' : 'Please log your vitals to receive personalized AI health insights and continuous monitoring.')

  // Compute differences vs previous update
  let bpDiffText = null
  let sugarDiffText = null
  let spo2DiffText = null
  let hrDiffText = null

  if (vitalsList.length >= 2) {
    const prevDateLabel = formatRecordDate(prevVitals.created_at)

    const latestSys = latestVitals.bp?.split('/')?.[0] ? Number(latestVitals.bp.split('/')[0]) : 118
    const prevSys = prevVitals.bp?.split('/')?.[0] ? Number(prevVitals.bp.split('/')[0]) : 118
    const sysDiff = latestSys - prevSys
    if (sysDiff !== 0) {
      bpDiffText = `${sysDiff > 0 ? '↑' : '↓'} ${Math.abs(sysDiff)} mmHg vs prev (${prevDateLabel})`
    } else {
      bpDiffText = `= Same as prev (${prevDateLabel})`
    }

    const latestSugar = latestVitals.sugar != null ? Number(latestVitals.sugar) : 92
    const prevSugar = prevVitals.sugar != null ? Number(prevVitals.sugar) : 92
    const sugarDiff = latestSugar - prevSugar
    if (sugarDiff !== 0) {
      sugarDiffText = `${sugarDiff > 0 ? '↑' : '↓'} ${Math.abs(sugarDiff)} mg/dL vs prev (${prevDateLabel})`
    } else {
      sugarDiffText = `= Same as prev (${prevDateLabel})`
    }

    const latestSpo2 = latestVitals.spo2 != null ? Number(latestVitals.spo2) : 98
    const prevSpo2 = prevVitals.spo2 != null ? Number(prevVitals.spo2) : 98
    const spo2Diff = latestSpo2 - prevSpo2
    if (spo2Diff !== 0) {
      spo2DiffText = `${spo2Diff > 0 ? '↑' : '↓'} ${Math.abs(spo2Diff)}% vs prev (${prevDateLabel})`
    } else {
      spo2DiffText = `= Same as prev (${prevDateLabel})`
    }

    const latestHr = latestVitals.hr != null ? Number(latestVitals.hr) : 72
    const prevHr = prevVitals.hr != null ? Number(prevVitals.hr) : 72
    const hrDiff = latestHr - prevHr
    if (hrDiff !== 0) {
      hrDiffText = `${hrDiff > 0 ? '↑' : '↓'} ${Math.abs(hrDiff)} bpm vs prev (${prevDateLabel})`
    } else {
      hrDiffText = `= Same as prev (${prevDateLabel})`
    }
  }

  return (
    <div className="dashboard" id="dashboard">
      <TopBar userName={userName} />
      <div className="dashboard-body">
        <Sidebar userName={userName} />
        <main className="dashboard-main" style={{ paddingBottom: '60px' }}>
          {/* Header Banner */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="dashboard-header"
            style={{ marginBottom: '32px' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
              <div>
                <h1 style={{ fontSize: '3.2rem', fontWeight: 800, margin: 0 }}>{getGreeting()}, {firstName}.</h1>
                <p style={{ fontSize: '1.25rem', marginTop: '6px', color: '#404845', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 size={20} style={{ color: '#10b981' }} />
                  {vitalsList.length > 0
                    ? `Tracking ${vitalsList.length} saved vitals ${vitalsList.length === 1 ? 'entry' : 'entries'}.`
                    : 'No vitals logged yet.'}
                </p>
              </div>

              {/* Vitals Sync Status Badge */}
              <motion.div
                whileHover={{ scale: 1.02 }}
                style={{
                  background: '#eff5f1',
                  border: '1px solid #c0c8c4',
                  padding: '14px 22px',
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <Clock size={20} style={{ color: '#29574b' }} />
                <div>
                  <span style={{ fontSize: '0.85rem', color: '#717975', display: 'block', fontWeight: 600 }}>LAST UPDATED</span>
                  <strong style={{ fontSize: '1.05rem', color: '#171d1b' }}>
                    {latestVitals?.created_at ? formatRecordDate(latestVitals.created_at) : 'Not recorded'}
                  </strong>
                </div>
                <button
                  onClick={() => navigate('/vitals')}
                  style={{ background: '#29574b', color: '#00ff88', border: 0, padding: '8px 14px', borderRadius: '10px', fontWeight: 800, fontSize: '0.9rem', cursor: 'pointer', marginLeft: '8px' }}
                >
                  Update →
                </button>
              </motion.div>
            </div>

            <div className="quick-actions" style={{ marginTop: '24px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="button button-primary"
                onClick={() => navigate('/vitals')}
                style={{ background: '#29574b', color: '#00ff88', fontWeight: 800, fontSize: '1.05rem', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <PlusCircle size={18} /> Update Saved Vitals
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="button button-secondary"
                onClick={() => {
                  window.sessionStorage.setItem('medimate-doctors-entry', 'true')
                  navigate('/doctors')
                }}
                style={{ fontSize: '1.05rem', fontWeight: 700 }}
              >
                Find Doctors
              </motion.button>
            </div>
          </motion.section>

          {/* Doctor Consultations & Appointments Section */}
          <section style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, color: '#171d1b', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Stethoscope size={26} style={{ color: '#29574b' }} /> Consultations &amp; Telehealth Sessions
                </h2>
                <p style={{ margin: '4px 0 0', color: '#59756e', fontSize: '1rem' }}>
                  Track appointment approvals, live consultation chat, and direct WebRTC video calls with your doctors.
                </p>
              </div>
              <button
                onClick={() => {
                  window.sessionStorage.setItem('medimate-doctors-entry', 'true')
                  navigate('/doctors')
                }}
                style={{
                  padding: '10px 20px',
                  borderRadius: '999px',
                  background: '#eaf3ee',
                  color: '#29574b',
                  border: '1.5px solid #c4dcd3',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                + Book Consultation
              </button>
            </div>

            {appointmentsLoading ? (
              <div style={{ padding: '28px', textAlign: 'center', color: '#59756e', background: '#ffffff', borderRadius: '16px', border: '1px solid #dee4e0', fontSize: '1rem' }}>
                Loading your appointments…
              </div>
            ) : appointments.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', background: '#ffffff', borderRadius: '20px', border: '1px solid #dee4e0', boxShadow: '0 4px 14px rgba(41,87,75,0.04)' }}>
                <p style={{ color: '#59756e', fontSize: '1.05rem', margin: '0 0 16px', fontWeight: 600 }}>
                  You have no active doctor consultations or appointments booked yet.
                </p>
                <button
                  onClick={() => {
                    window.sessionStorage.setItem('medimate-doctors-entry', 'true')
                    navigate('/doctors')
                  }}
                  style={{ padding: '12px 26px', borderRadius: '999px', background: '#29574b', color: '#00ff88', fontWeight: 800, fontSize: '1rem', border: 0, cursor: 'pointer' }}
                >
                  Find Doctors &amp; Schedule Visit →
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '16px' }}>
                {appointments.map((appt) => {
                  const docName = appt.doctor?.user?.name
                    ? `Dr. ${appt.doctor.user.name}`
                    : appt.doctor?.name
                      ? `Dr. ${appt.doctor.name}`
                      : 'Consulting Specialist'
                  const isApproved = appt.status === 'approved'
                  const isPending = appt.status === 'pending'
                  const isCompleted = appt.status === 'completed'
                  const slotFormatted = appt.slot ? formatSlot(appt.slot) : 'Scheduled Time'

                  return (
                    <motion.article
                      key={appt.id}
                      whileHover={{ y: -2 }}
                      style={{
                        padding: '20px 24px',
                        borderRadius: '20px',
                        background: '#ffffff',
                        border: isApproved ? '2px solid #a7f3d0' : '1px solid #dee4e0',
                        boxShadow: isApproved ? '0 8px 24px rgba(16, 185, 129, 0.1)' : '0 4px 14px rgba(41,87,75,0.04)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div
                          style={{
                            width: '52px',
                            height: '52px',
                            borderRadius: '16px',
                            background: isApproved ? '#d1fae5' : '#eaf3ee',
                            color: '#29574b',
                            display: 'grid',
                            placeItems: 'center',
                            fontWeight: 800,
                            fontSize: '1.4rem',
                            flexShrink: 0,
                          }}
                        >
                          🩺
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '1.25rem', color: '#171d1b' }}>{docName}</strong>
                            {appt.doctor?.specialization && (
                              <span style={{ fontSize: '0.85rem', color: '#29574b', background: '#dcece5', padding: '3px 10px', borderRadius: '6px', fontWeight: 700 }}>
                                {appt.doctor.specialization}
                              </span>
                            )}
                            <span
                              style={{
                                padding: '4px 12px',
                                borderRadius: '999px',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                background: isApproved ? '#d1fae5' : isPending ? '#fef3c7' : isCompleted ? '#e0e7ff' : '#fee2e2',
                                color: isApproved ? '#065f46' : isPending ? '#92400e' : isCompleted ? '#3730a3' : '#991b1b',
                              }}
                            >
                              {isApproved ? '✓ Approved & Ready' : isPending ? '⏳ Awaiting Doctor Approval' : isCompleted ? 'Completed' : 'Declined'}
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.92rem', color: '#59756e', flexWrap: 'wrap' }}>
                            <span>🗓 <strong>{slotFormatted}</strong></span>
                            {appt.facility?.name && <span>🏥 {appt.facility.name}</span>}
                            {appt.reason && <span>📝 Reason: {appt.reason}</span>}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {isApproved && (
                          <>
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setActiveChatAppt(appt)}
                              style={{
                                padding: '10px 20px',
                                borderRadius: '999px',
                                background: '#eaf3ee',
                                color: '#29574b',
                                border: '1.5px solid #29574b',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                              }}
                            >
                              <MessageSquare size={17} /> Chat with Doctor
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.03 }}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => setActiveVideoAppt({ ...appt, isInitiator: true, autoAccept: false })}
                              style={{
                                padding: '10px 22px',
                                borderRadius: '999px',
                                background: '#29574b',
                                color: '#00ff88',
                                border: 'none',
                                fontWeight: 800,
                                fontSize: '0.95rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 4px 14px rgba(41, 87, 75, 0.25)',
                              }}
                            >
                              <Video size={17} /> Video Call Doctor
                            </motion.button>
                          </>
                        )}

                        {isPending && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '8px 16px',
                              borderRadius: '999px',
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: '0.88rem',
                              fontWeight: 700,
                            }}
                          >
                            <Clock size={16} /> Chat &amp; Video unlock upon doctor approval
                          </div>
                        )}

                        {isCompleted && (
                          <button
                            onClick={() => setActiveChatAppt(appt)}
                            style={{
                              padding: '8px 18px',
                              borderRadius: '999px',
                              background: '#eaf3ee',
                              color: '#29574b',
                              border: '1px solid #c4dcd3',
                              fontSize: '0.9rem',
                              fontWeight: 700,
                              cursor: 'pointer',
                            }}
                          >
                            View Chat History
                          </button>
                        )}
                      </div>
                    </motion.article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Vitals Metrics Cards Grid */}
          <section className="health-grid" aria-label="Health metrics">
            <div className="metrics-grid" style={{ gap: '24px' }}>
              {/* Blood Pressure Card */}
              <motion.article
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="metric-card"
                style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #dee4e0', boxShadow: '0 8px 24px rgba(41,87,75,0.06)' }}
              >
                <div className="metric-heading">
                  <div>
                    <p className="eyebrow" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#526e67', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Activity size={16} style={{ color: '#10b981' }} /> BLOOD PRESSURE
                    </p>
                    <div className="metric-value" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#171d1b', margin: '4px 0' }}>
                      {bpValue} <small style={{ fontSize: '1rem', color: '#717975', fontWeight: 600 }}>mmHg</small>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span className="status-pill" style={{ background: '#dcece5', color: '#29574b', fontWeight: 700, fontSize: '0.85rem', width: 'fit-content' }}>
                        {riskLevel === 'low' ? 'Optimal Range' : 'Monitor'}
                      </span>
                      {bpDiffText && (
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: bpDiffText.includes('↓') ? '#10b981' : '#f59e0b' }}>
                          {bpDiffText}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="metric-icon" style={{ background: '#eff5f1', color: '#29574b', width: '40px', height: '40px', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                    <Heart size={20} />
                  </span>
                </div>
                {chartData.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <MiniSparkline data={chartData} dataKey="systolic" strokeColor="#10b981" gradientId="bpGradient" />
                  </div>
                )}
              </motion.article>

              {/* Blood Sugar Card */}
              <motion.article
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="metric-card"
                style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #dee4e0', boxShadow: '0 8px 24px rgba(41,87,75,0.06)' }}
              >
                <div className="metric-heading">
                  <div>
                    <p className="eyebrow" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#526e67', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Droplets size={16} style={{ color: '#3b82f6' }} /> BLOOD SUGAR
                    </p>
                    <div className="metric-value" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#171d1b', margin: '4px 0' }}>
                      {sugarValue} <small style={{ fontSize: '1rem', color: '#717975', fontWeight: 600 }}>mg/dL</small>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span className="status-pill" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 700, fontSize: '0.85rem', width: 'fit-content' }}>
                        Fasting • Normal
                      </span>
                      {sugarDiffText && (
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: sugarDiffText.includes('↓') ? '#10b981' : '#3b82f6' }}>
                          {sugarDiffText}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="metric-icon" style={{ background: '#eff6ff', color: '#3b82f6', width: '40px', height: '40px', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                    <Droplets size={20} />
                  </span>
                </div>
                {chartData.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <MiniSparkline data={chartData} dataKey="sugar" strokeColor="#3b82f6" gradientId="sugarGradient" />
                  </div>
                )}
              </motion.article>

              {/* SpO2 Oxygen Card */}
              <motion.article
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="metric-card"
                style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #dee4e0', boxShadow: '0 8px 24px rgba(41,87,75,0.06)' }}
              >
                <div className="metric-heading">
                  <div>
                    <p className="eyebrow" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#526e67', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Wind size={16} style={{ color: '#06b6d4' }} /> SPO2 (OXYGEN)
                    </p>
                    <div className="metric-value" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#171d1b', margin: '4px 0' }}>
                      {spo2Value}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span className="status-pill" style={{ background: '#cffafe', color: '#0e7490', fontWeight: 700, fontSize: '0.85rem', width: 'fit-content' }}>
                        Optimal Saturation
                      </span>
                      {spo2DiffText && (
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#06b6d4' }}>
                          {spo2DiffText}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="metric-icon" style={{ background: '#ecfeff', color: '#06b6d4', width: '40px', height: '40px', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                    <Wind size={20} />
                  </span>
                </div>
                {chartData.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <MiniSparkline data={chartData} dataKey="spo2" strokeColor="#06b6d4" gradientId="spo2Gradient" />
                  </div>
                )}
              </motion.article>

              {/* Heart Rate Card */}
              <motion.article
                whileHover={{ y: -4 }}
                transition={{ duration: 0.2 }}
                className="metric-card"
                style={{ padding: '24px', borderRadius: '20px', background: '#ffffff', border: '1px solid #dee4e0', boxShadow: '0 8px 24px rgba(41,87,75,0.06)' }}
              >
                <div className="metric-heading">
                  <div>
                    <p className="eyebrow" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#526e67', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Heart size={16} style={{ color: '#ec4899' }} /> HEART RATE
                    </p>
                    <div className="metric-value" style={{ fontSize: '2.2rem', fontWeight: 800, color: '#171d1b', margin: '4px 0' }}>
                      {hrValue} <small style={{ fontSize: '1rem', color: '#717975', fontWeight: 600 }}>bpm</small>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                      <span className="status-pill" style={{ background: '#fce7f3', color: '#be185d', fontWeight: 700, fontSize: '0.85rem', width: 'fit-content' }}>
                        Resting • Healthy
                      </span>
                      {hrDiffText && (
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#ec4899' }}>
                          {hrDiffText}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="metric-icon" style={{ background: '#fdf2f8', color: '#ec4899', width: '40px', height: '40px', borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
                    <Activity size={20} />
                  </span>
                </div>
                {chartData.length > 0 && (
                  <div style={{ marginTop: '16px' }}>
                    <MiniSparkline data={chartData} dataKey="hr" strokeColor="#ec4899" gradientId="hrGradient" />
                  </div>
                )}
              </motion.article>
            </div>

            {/* Health Score Gauge */}
            <motion.article
              whileHover={{ y: -4 }}
              className="risk-card"
              style={{
                padding: '28px',
                borderRadius: '24px',
                background: '#fbfaf6',
                border: '1px solid #eeece5',
                boxShadow: '0 8px 24px rgba(41,87,75,0.06)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.8rem', fontWeight: 800, margin: 0, color: '#171d1b' }}>Health Index</h2>
                <p style={{ fontSize: '0.95rem', color: '#526e67', marginTop: '4px', fontWeight: 600 }}>
                  Calculated from saved vitals
                </p>
              </div>

              <HealthScoreGauge score={healthIndex.score} riskLevel={healthIndex.riskLevel} />

              <div style={{ width: '100%', textTransform: 'capitalize', textAlign: 'center', background: '#eff5f1', padding: '10px 16px', borderRadius: '12px', border: '1px solid #e2eae5' }}>
                <span style={{ fontSize: '0.9rem', color: '#717975', fontWeight: 600 }}>Status: </span>
                <strong style={{ fontSize: '1rem', color: healthIndex.statusColor }}>
                  {healthIndex.statusText}
                </strong>
              </div>
            </motion.article>
          </section>

          {/* Recharts Analytics Section */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              marginTop: '40px',
              padding: '32px',
              borderRadius: '24px',
              background: '#ffffff',
              border: '1px solid #dee4e0',
              boxShadow: '0 10px 30px rgba(41,87,75,0.06)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
              <div>
                <h2 style={{ fontSize: '2rem', fontWeight: 800, margin: 0, color: '#171d1b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <TrendingUp style={{ color: '#29574b' }} size={28} /> Vitals Trend &amp; Historical Progression
                </h2>
                <p style={{ fontSize: '1.1rem', color: '#526e67', marginTop: '6px' }}>
                  Real-time progression tracking based on exact dates &amp; times you saved your vitals.
                </p>
              </div>

              {/* Chart Metric Selectors */}
              <div style={{ display: 'flex', gap: '8px', background: '#eff5f1', padding: '6px', borderRadius: '14px', border: '1px solid #c0c8c4' }}>
                {[
                  ['all', 'All Vitals'],
                  ['bp', 'Blood Pressure'],
                  ['sugar', 'Blood Sugar'],
                  ['hr', 'Pulse & SpO2'],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: 0,
                      fontWeight: 700,
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      background: activeTab === key ? '#29574b' : 'transparent',
                      color: activeTab === key ? '#00ff88' : '#404845',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Chart Area */}
            {chartData.length > 0 ? (
              <div style={{ width: '100%', height: '360px', marginTop: '10px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBP" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#29574b" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#29574b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSugar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorSpO2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorHR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2eae5" vertical={false} />
                    <XAxis dataKey="date" stroke="#717975" fontSize={12} tickLine={false} axisLine={{ stroke: '#c0c8c4' }} />
                    <YAxis stroke="#717975" fontSize={12} tickLine={false} axisLine={false} domain={[0, 'dataMax + 20']} />
                    <Tooltip content={<CustomTooltip />} />

                    {(activeTab === 'all' || activeTab === 'bp') && (
                      <Area type="monotone" name="Systolic BP" dataKey="systolic" stroke="#29574b" strokeWidth={3} fillOpacity={1} fill="url(#colorBP)" />
                    )}
                    {(activeTab === 'all' || activeTab === 'sugar') && (
                      <Area type="monotone" name="Blood Sugar" dataKey="sugar" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorSugar)" />
                    )}
                    {(activeTab === 'all' || activeTab === 'hr') && (
                      <Area type="monotone" name="SpO2" dataKey="spo2" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSpO2)" />
                    )}
                    {(activeTab === 'all' || activeTab === 'hr') && (
                      <Area type="monotone" name="Heart Rate" dataKey="hr" stroke="#ec4899" strokeWidth={2.5} fillOpacity={1} fill="url(#colorHR)" />
                    )}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ padding: '48px', textAlign: 'center', background: '#f5fbf7', borderRadius: '16px', border: '1px border #c0c8c4' }}>
                <AlertCircle size={40} style={{ color: '#404845', marginBottom: '12px' }} />
                <h3 style={{ fontSize: '1.4rem', color: '#171d1b', margin: 0 }}>No Saved Vitals Found</h3>
                <p style={{ color: '#526e67', fontSize: '1.05rem', margin: '8px 0 20px' }}>Log your blood pressure, sugar, SpO2, and heart rate readings to generate interactive trend graphs.</p>
                <button
                  onClick={() => navigate('/vitals')}
                  style={{ padding: '12px 28px', borderRadius: '999px', background: '#29574b', color: '#00ff88', fontWeight: 800, fontSize: '1rem', border: 0, cursor: 'pointer' }}
                >
                  + Log Your First Vitals Reading
                </button>
              </div>
            )}
          </motion.section>

          {/* Clinical Insights Banner */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            style={{
              marginTop: '32px',
              padding: '24px 28px',
              borderRadius: '20px',
              background: '#eff5f1',
              border: '1px solid #c0c8c4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1, minWidth: '280px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#29574b', color: '#00ff88', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Sparkles size={24} />
              </div>
              <div>
                <b style={{ fontSize: '1.2rem', color: '#171d1b', fontWeight: 800, display: 'block' }}>Clinical Summary &amp; Next Steps</b>
                <p style={{ fontSize: '1.05rem', color: '#404845', margin: '4px 0 0', lineHeight: 1.5 }}>
                  {recommendation}
                </p>
              </div>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => {
                window.sessionStorage.setItem('medimate-doctors-entry', 'true')
                navigate('/doctors')
              }}
              style={{ padding: '14px 28px', borderRadius: '999px', background: '#29574b', color: '#ffffff', fontWeight: 800, fontSize: '1.05rem', border: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', whiteSpace: 'nowrap' }}
            >
              Consult Doctor Now <ArrowUpRight size={18} />
            </motion.button>
          </motion.section>

          {/* Care Journey Section */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <section className="timeline" id="journey" style={{ marginTop: '36px' }}>
              <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '24px' }}>Your Care Journey</h2>
              <div className="journey-track">
                <div className="track-base" />
                <div className="track-progress" />
                {journey.map(([label, date], index) => (
                  <div className={`journey-step ${index === 2 ? 'current' : ''}`} key={label}>
                    <span className="journey-dot" />
                    <strong>{label}</strong>
                    {date && <small>{date}</small>}
                  </div>
                ))}
              </div>
            </section>
          </motion.div>
        </main>
      </div>

      {/* Incoming Call Ringing Alert Dialog */}
      {incomingCall && !activeVideoAppt && (
        <IncomingCallModal
          incomingCall={incomingCall}
          onAccept={handleAcceptIncomingCall}
          onDecline={declineIncomingCall}
        />
      )}

      {/* Real-time Consultation Chat Modal */}
      {activeChatAppt && (
        <ChatModal
          appointment={activeChatAppt}
          currentUser={user}
          onClose={() => setActiveChatAppt(null)}
        />
      )}

      {/* Real-time WebRTC Video Call Modal */}
      {activeVideoAppt && (
        <VideoCallModal
          appointment={activeVideoAppt}
          currentUser={user}
          isInitiator={activeVideoAppt.autoAccept ? false : true}
          autoAccept={!!activeVideoAppt.autoAccept}
          initialOffer={activeVideoAppt.initialOffer || null}
          onClose={() => {
            setActiveVideoAppt(null)
            setIncomingCall(null)
          }}
        />
      )}
    </div>
  )
}