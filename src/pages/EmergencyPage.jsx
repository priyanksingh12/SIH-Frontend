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
} from "lucide-react"

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
            {isHigh ? "ðŸ”´ High Urgency â€” Seek Immediate Help" : "ðŸŸ¡ Normal Urgency â€” Clinic Visit Advised"}
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
        {needs === "hospital" ? "ðŸ¥ Hospital Required" : "ðŸ©º Doctor / Clinic"}
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
              #{index + 1} Â· {type}
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
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  const handleSearch = () => {
    if (!symptoms.trim()) { setError("Please describe your symptoms before searching."); return }
    if (!navigator.geolocation) { setError("Geolocation is not supported by your browser."); return }
    setLoading(true); setError(null); setResult(null)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const data = await fetchNearbyMedicalHelp(symptoms, pos.coords.latitude, pos.coords.longitude)
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

  const handleReset = () => { setSymptoms(""); setResult(null); setError(null) }

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
                Describe your symptoms â€” our AI will triage your case and find the nearest appropriate healthcare facility.
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
            <span><b>For life-threatening emergencies, call 112 immediately.</b> This tool supplements emergency planning â€” AI triage + live map data may take 15â€“25 seconds to respond.</span>
          </div>

          {/* Input Card */}
          {!result && (
            <div className="p-7 rounded-2xl bg-white border border-[#e2eae5] shadow-md mb-6">
              <label className="block text-xs font-extrabold text-[#29574b] tracking-widest uppercase mb-2.5">
                Describe Your Symptoms
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. Severe chest pain radiating to my left arm, difficulty breathing and dizziness since 20 minutes..."
                rows={4}
                className="w-full px-4 py-4 rounded-xl border-2 border-[#d0e4db] text-base text-[#171d1b] bg-[#f8fbf9] resize-y outline-none leading-relaxed focus:border-[#29574b] disabled:opacity-60 box-border"
                disabled={loading}
              />

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
                    Analyzing Symptoms &amp; Finding Facilitiesâ€¦
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
                  Our AI is triaging your symptoms and querying live map data â€” this typically takes 15â€“25 seconds.
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
