import { useState } from "react"
import { TopBar, Sidebar } from "./PatientDashboard"
import { getStoredUser } from "../api/apiClient.js"
import {
  Siren,
  MapPin,
  Phone,
  Navigation2,
  AlertTriangle,
  Loader2,
  Stethoscope,
  Building2,
  HeartPulse,
  RefreshCcw,
  Info,
  Activity,
} from "lucide-react"

const BODY_AREAS = [
  {
    id: "heart",
    label: "Heart",
    icon: "🫀",
    symptomText: "Severe chest pain, heavy pressure, radiating arm pain or sudden cardiac distress (Heart emergency)",
  },
  {
    id: "lungs",
    label: "Lungs",
    icon: "🫁",
    symptomText: "Acute shortness of breath, severe breathing difficulty, wheezing or respiratory failure (Lungs emergency)",
  },
  {
    id: "liver",
    label: "Liver",
    icon: "🩺",
    symptomText: "Severe acute upper right abdominal pain, sudden jaundice or hepatic distress (Liver emergency)",
  },
  {
    id: "shoulder",
    label: "Shoulder",
    icon: "🦴",
    symptomText: "Acute shoulder dislocation, severe fracture, joint trauma or intense shoulder pain (Shoulder emergency)",
  },
]

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || "https://sih-otuc.onrender.com"

async function fetchNearbyMedicalHelp(symptoms, latitude, longitude) {
  const res = await fetch(`${BACKEND_URL}/emergency/find-help`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: symptoms, lat: latitude, lng: longitude }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || "Failed to locate nearby emergency facilities")
  return data
}

function UrgencyBanner({ urgency, specialty, needs }) {
  const isHigh = urgency === "high"
  return (
    <div
      className={`flex items-center justify-between gap-4 flex-wrap px-6 py-5 rounded-2xl mb-6 border-2 ${
        isHigh
          ? 'bg-[rgba(186,26,26,0.07)] border-[#f9b8b8]'
          : 'bg-[rgba(183,155,8,0.07)] border-[#f5d97a]'
      }`}
    >
      <div className="flex items-center gap-3.5">
        <div
          className={`w-12 h-12 rounded-xl grid place-items-center shrink-0 ${isHigh ? 'bg-[#ba1a1a]' : 'bg-[#8a6d00]'}`}
        >
          <AlertTriangle size={22} color="#fff" />
        </div>
        <div>
          <div
            className={`text-xs font-extrabold tracking-widest uppercase mb-1 ${isHigh ? 'text-[#ba1a1a]' : 'text-[#7a5f00]'}`}
          >
            {isHigh ? "🔴 High Urgency — Seek Immediate Help" : "🟡 Normal Urgency — Clinic Visit Advised"}
          </div>
          <div className="text-base font-bold text-[#171d1b]">
            Recommended Department:{" "}
            <span className={`font-extrabold ${isHigh ? 'text-[#ba1a1a]' : 'text-[#5a4300]'}`}>{specialty}</span>
          </div>
        </div>
      </div>
      <span
        className={`px-4 py-1.5 rounded-full text-white text-sm font-bold tracking-wide shrink-0 ${isHigh ? 'bg-[#ba1a1a]' : 'bg-[#8a6d00]'}`}
      >
        {needs === "hospital" ? "🏥 Hospital Required" : "🩺 Doctor / Clinic"}
      </span>
    </div>
  )
}

function FacilityCard({ facility, index }) {
  const { name, type, distance_km, address, phone, lat, lng } = facility
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
  const isHospital = type === "hospital"
  return (
    <div className="p-5 rounded-2xl bg-white border border-[#e2eae5] shadow-sm flex gap-4 items-start">
      <div
        className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 border ${
          isHospital ? 'bg-[#eaf3ee] border-[#c4dcd3]' : 'bg-[#f0f4ff] border-[#c7d3f5]'
        }`}
      >
        {isHospital ? <Building2 size={20} color="#29574b" /> : <Stethoscope size={20} color="#3a52a3" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-start gap-3 flex-wrap">
          <div>
            <div className="text-xs font-bold text-[#59756e] uppercase tracking-widest mb-1">
              #{index + 1} · {type}
            </div>
            <h3 className="m-0 text-lg font-bold text-[#171d1b] leading-snug">{name}</h3>
          </div>
          <span className="px-3.5 py-1 rounded-full bg-[#eaf3ee] text-[#29574b] text-sm font-extrabold shrink-0 border border-[#c4dcd3]">
            {distance_km?.toFixed ? `${distance_km.toFixed(2)} km away` : `${distance_km} km away`}
          </span>
        </div>
        {address && (
          <div className="flex items-center gap-1.5 mt-2 text-[#59756e] text-sm">
            <MapPin size={14} color="#59756e" />
            <span>{address}</span>
          </div>
        )}
        <div className="flex gap-2.5 mt-3.5 flex-wrap">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#29574b] text-[#00ff88] text-sm font-bold no-underline"
            >
              <Phone size={14} />
              {phone}
            </a>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#eaf3ee] text-[#29574b] text-sm font-bold no-underline border border-[#c4dcd3]"
          >
            <Navigation2 size={14} />
            Get Directions
          </a>
        </div>
      </div>
    </div>
  )
}

export default function EmergencyPage() {
  const user = getStoredUser()
  const userName = user?.name || "Patient"
  const [symptoms, setSymptoms] = useState("")
  const [selectedArea, setSelectedArea] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const triggerSearch = (queryText) => {
    const textToSearch = (queryText !== undefined ? queryText : symptoms).trim()
    if (!textToSearch) {
      setError("Please describe your symptoms or select an affected area before searching.")
      return
    }
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.")
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await fetchNearbyMedicalHelp(textToSearch, pos.coords.latitude, pos.coords.longitude)
          setResult(data)
        } catch (err) {
          setError(err.message || "Something went wrong. Please try again.")
        } finally {
          setLoading(false)
        }
      },
      (err) => {
        setError("Location access required to find nearby facilities. Please allow location and try again. (" + err.message + ")")
        setLoading(false)
      },
      { timeout: 10000 }
    )
  }

  const handleSelectArea = (area) => {
    setSelectedArea(area.id)
    setSymptoms(area.symptomText)
    triggerSearch(area.symptomText)
  }

  const handleSearch = () => {
    triggerSearch()
  }

  const handleReset = () => {
    setSymptoms("")
    setSelectedArea(null)
    setResult(null)
    setError(null)
  }

  return (
    <div className="min-h-screen bg-transparent text-[#171d1b]">
      <TopBar userName={userName} />
      <div className="flex min-h-[calc(100vh-88px)]">
        <Sidebar userName={userName} activeLabel="Emergency" />
        <main className="flex-1 min-w-0 w-full max-w-4xl mx-auto px-4 md:px-10 lg:px-12 pt-9 pb-20">

          {/* Page Header */}
          <div className="flex items-start justify-between gap-5 mb-7 flex-wrap">
            <div>
              <div className="text-[#ba1a1a] text-xs font-extrabold tracking-widest uppercase mb-1.5">
                PORTAL / PATIENT WORKSPACE / <b>EMERGENCY</b>
              </div>
              <h1 className="m-0 text-3xl md:text-4xl font-bold font-serif text-[#171d1b] flex items-center gap-3">
                <Siren size={32} color="#ba1a1a" className="shrink-0" />
                Emergency Medical Finder
              </h1>
              <p className="mt-2 text-[#59756e] text-base font-medium">
                Describe your symptoms — our AI will triage your case and find the nearest appropriate healthcare facility.
              </p>
            </div>
            {result && (
              <button
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full bg-[#eaf3ee] text-[#29574b] text-base font-bold border border-[#c4dcd3] cursor-pointer shrink-0"
              >
                <RefreshCcw size={15} />
                New Search
              </button>
            )}
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-2.5 px-4 py-3.5 rounded-xl bg-[#fffbea] border border-[#f5e19a] mb-7 text-sm text-[#7a5f00] font-medium">
            <Info size={17} className="shrink-0 mt-0.5" />
            <span><b>For life-threatening emergencies, call 112 immediately.</b> This tool supplements emergency planning — AI triage + live map data may take 15–25 seconds to respond.</span>
          </div>

          {/* Input Card */}
          {!result && (
            <div className="p-7 rounded-2xl bg-white border border-[#e2eae5] shadow-md mb-6">
              {/* Quick Select by Affected Organ / Body Area */}
              <div className="mb-6">
                <label className="block text-xs font-extrabold text-[#ba1a1a] tracking-widest uppercase mb-1.5 flex items-center gap-1.5">
                  <Activity size={16} /> Quick Select Affected Organ / Body Area
                </label>
                <p className="text-xs text-[#59756e] font-semibold mb-3">
                  Click any organ below to immediately triage and find the nearest emergency medical facility:
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {BODY_AREAS.map((area) => {
                    const isSelected = selectedArea === area.id
                    return (
                      <label
                        key={area.id}
                        className={`flex items-center gap-2.5 p-3.5 rounded-xl border-2 cursor-pointer transition-all select-none ${
                          isSelected
                            ? "border-[#ba1a1a] bg-[#fff5f5] text-[#ba1a1a] shadow-sm ring-2 ring-[#ba1a1a]/20"
                            : "border-[#d0e4db] bg-[#f8fbf9] text-[#171d1b] hover:border-[#29574b]/60 hover:bg-white"
                        }`}
                      >
                        <input
                          type="radio"
                          name="emergency-body-area"
                          value={area.id}
                          checked={isSelected}
                          onChange={() => handleSelectArea(area)}
                          disabled={loading}
                          className="accent-[#ba1a1a] w-4 h-4 cursor-pointer shrink-0"
                        />
                        <span className="font-bold text-sm flex items-center gap-2">
                          <span className="text-lg">{area.icon}</span>
                          <span>{area.label}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="border-t border-[#e2eae5] pt-5">
                <label className="block text-xs font-extrabold text-[#29574b] tracking-widest uppercase mb-2.5">
                  Describe Your Symptoms
                </label>
                <textarea
                  value={symptoms}
                  onChange={(e) => {
                    setSymptoms(e.target.value)
                    if (selectedArea) setSelectedArea(null)
                  }}
                  placeholder="e.g. Severe chest pain radiating to my left arm, difficulty breathing and dizziness since 20 minutes..."
                  rows={4}
                  className="w-full px-4 py-4 rounded-xl border-2 border-[#d0e4db] text-base text-[#171d1b] bg-[#f8fbf9] resize-y outline-none leading-relaxed focus:border-[#29574b] disabled:opacity-60 box-border"
                  disabled={loading}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 mt-3.5 px-4 py-3 rounded-xl bg-[rgba(186,26,26,0.07)] border border-[#f9b8b8] text-[#ba1a1a] text-sm font-semibold">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <button
                onClick={handleSearch}
                disabled={loading}
                className={`mt-4 w-full py-4 rounded-xl text-white text-base font-extrabold border-0 flex items-center justify-center gap-2.5 tracking-wide transition-colors ${
                  loading ? 'bg-[#a0b5ae] cursor-not-allowed' : 'bg-[#ba1a1a] cursor-pointer hover:bg-[#991b1b]'
                }`}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    Analyzing Symptoms &amp; Finding Facilities...
                  </>
                ) : (
                  <>
                    <Siren size={20} />
                    Find Nearest Medical Help Now
                  </>
                )}
              </button>

              {loading && (
                <p className="text-center mt-3 text-[#59756e] text-sm font-medium">
                  Our AI is triaging your symptoms and querying live map data — this typically takes 15–25 seconds.
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div>
              <UrgencyBanner urgency={result.urgency} specialty={result.specialty} needs={result.needs} />

              <div className="flex items-center gap-2.5 mb-4">
                <HeartPulse size={20} color="#29574b" />
                <h2 className="m-0 text-xl font-bold text-[#171d1b]">
                  Nearest Facilities ({result.results?.length || 0} found)
                </h2>
              </div>

              {result.results && result.results.length > 0 ? (
                <div className="flex flex-col gap-3.5">
                  {result.results.map((facility, idx) => (
                    <FacilityCard key={facility.name + idx} facility={facility} index={idx} />
                  ))}
                </div>
              ) : (
                <div className="p-8 rounded-2xl bg-white border border-[#e2eae5] text-center text-[#59756e] text-base font-semibold">
                  No facilities found nearby. Please try again or call 112.
                </div>
              )}

              <div className="mt-6 px-5 py-4 rounded-xl bg-[#f5fbf7] border border-[#e2eae5] text-sm text-[#59756e] font-medium">
                <b className="text-[#29574b]">Your reported symptoms:</b> {symptoms}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
