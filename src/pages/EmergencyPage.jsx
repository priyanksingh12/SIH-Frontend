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
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
        flexWrap: "wrap",
        padding: "20px 24px",
        borderRadius: "16px",
        background: isHigh ? "rgba(186,26,26,0.07)" : "rgba(183,155,8,0.07)",
        border: `1.5px solid ${isHigh ? "#f9b8b8" : "#f5d97a"}`,
        marginBottom: "24px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "12px",
            background: isHigh ? "#ba1a1a" : "#8a6d00",
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <AlertTriangle size={22} color="#fff" />
        </div>
        <div>
          <div
            style={{
              fontSize: "0.78rem",
              fontWeight: 800,
              letterSpacing: "1.2px",
              textTransform: "uppercase",
              color: isHigh ? "#ba1a1a" : "#7a5f00",
              marginBottom: "4px",
            }}
          >
            {isHigh ? "🔴 High Urgency — Seek Immediate Help" : "🟡 Normal Urgency — Clinic Visit Advised"}
          </div>
          <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "#171d1b" }}>
            Recommended Department:{" "}
            <span style={{ color: isHigh ? "#ba1a1a" : "#5a4300", fontWeight: 800 }}>{specialty}</span>
          </div>
        </div>
      </div>
      <span
        style={{
          padding: "6px 16px",
          borderRadius: "999px",
          background: isHigh ? "#ba1a1a" : "#8a6d00",
          color: "#fff",
          fontSize: "0.85rem",
          fontWeight: 700,
          letterSpacing: "0.5px",
          flexShrink: 0,
        }}
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
    <div
      style={{
        padding: "20px 24px",
        borderRadius: "16px",
        background: "#fff",
        border: "1px solid #e2eae5",
        boxShadow: "0 4px 16px rgba(41,87,75,0.06)",
        display: "flex",
        gap: "16px",
        alignItems: "flex-start",
      }}
    >
      <div
        style={{
          width: "44px",
          height: "44px",
          borderRadius: "12px",
          background: isHospital ? "#eaf3ee" : "#f0f4ff",
          display: "grid",
          placeItems: "center",
          flexShrink: 0,
          border: `1px solid ${isHospital ? "#c4dcd3" : "#c7d3f5"}`,
        }}
      >
        {isHospital ? <Building2 size={20} color="#29574b" /> : <Stethoscope size={20} color="#3a52a3" />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#59756e", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: "4px" }}>
              #{index + 1} · {type}
            </div>
            <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#171d1b", lineHeight: 1.3 }}>{name}</h3>
          </div>
          <span
            style={{
              padding: "5px 14px",
              borderRadius: "999px",
              background: "#eaf3ee",
              color: "#29574b",
              fontSize: "0.88rem",
              fontWeight: 800,
              flexShrink: 0,
              border: "1px solid #c4dcd3",
            }}
          >
            {distance_km?.toFixed ? `${distance_km.toFixed(2)} km away` : `${distance_km} km away`}
          </span>
        </div>
        {address && (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", color: "#59756e", fontSize: "0.92rem" }}>
            <MapPin size={14} color="#59756e" />
            <span>{address}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
          {phone && (
            <a
              href={`tel:${phone}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 18px",
                borderRadius: "999px",
                background: "#29574b",
                color: "#00ff88",
                fontSize: "0.9rem",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <Phone size={14} />
              {phone}
            </a>
          )}
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 18px",
              borderRadius: "999px",
              background: "#eaf3ee",
              color: "#29574b",
              fontSize: "0.9rem",
              fontWeight: 700,
              textDecoration: "none",
              border: "1px solid #c4dcd3",
            }}
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
    <div className="profile-dashboard-shell">
      <TopBar userName={userName} />
      <div className="profile-dashboard-body">
        <Sidebar userName={userName} activeLabel="Emergency" />
        <main className="profile-workspace" style={{ padding: "36px 48px 80px" }}>

          {/* Page Header */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "20px", marginBottom: "28px", flexWrap: "wrap" }}>
            <div>
              <div style={{ color: "#ba1a1a", fontSize: "0.82rem", fontWeight: 800, letterSpacing: "1.2px", textTransform: "uppercase", marginBottom: "6px" }}>
                PORTAL / PATIENT WORKSPACE / <b>EMERGENCY</b>
              </div>
              <h1 style={{ margin: 0, font: "700 2.2rem/1.15 'Playfair Display', serif", color: "#171d1b", display: "flex", alignItems: "center", gap: "12px" }}>
                <Siren size={32} color="#ba1a1a" />
                Emergency Medical Finder
              </h1>
              <p style={{ margin: "8px 0 0", color: "#59756e", fontSize: "1rem", fontWeight: 500 }}>
                Describe your symptoms — our AI will triage your case and find the nearest appropriate healthcare facility.
              </p>
            </div>
            {result && (
              <button
                onClick={handleReset}
                style={{ display: "inline-flex", alignItems: "center", gap: "7px", padding: "10px 20px", borderRadius: "999px", background: "#eaf3ee", color: "#29574b", fontSize: "0.95rem", fontWeight: 700, border: "1px solid #c4dcd3", cursor: "pointer", flexShrink: 0 }}
              >
                <RefreshCcw size={15} />
                New Search
              </button>
            )}
          </div>

          {/* Disclaimer */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "14px 18px", borderRadius: "12px", background: "#fffbea", border: "1px solid #f5e19a", marginBottom: "28px", fontSize: "0.92rem", color: "#7a5f00", fontWeight: 500 }}>
            <Info size={17} style={{ flexShrink: 0, marginTop: "2px" }} />
            <span><b>For life-threatening emergencies, call 112 immediately.</b> This tool supplements emergency planning — AI triage + live map data may take 15–25 seconds to respond.</span>
          </div>

          {/* Input Card */}
          {!result && (
            <div style={{ padding: "28px", borderRadius: "20px", background: "#fff", border: "1px solid #e2eae5", boxShadow: "0 8px 24px rgba(41,87,75,0.06)", marginBottom: "24px" }}>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 800, color: "#29574b", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "10px" }}>
                Describe Your Symptoms
              </label>
              <textarea
                value={symptoms}
                onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. Severe chest pain radiating to my left arm, difficulty breathing and dizziness since 20 minutes..."
                rows={4}
                style={{ width: "100%", padding: "16px 18px", borderRadius: "12px", border: "1.5px solid #d0e4db", fontSize: "1rem", fontFamily: "Manrope, sans-serif", color: "#171d1b", background: "#f8fbf9", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.6 }}
                onFocus={(e) => (e.target.style.borderColor = "#29574b")}
                onBlur={(e) => (e.target.style.borderColor = "#d0e4db")}
                disabled={loading}
              />

              {error && (
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", marginTop: "14px", padding: "12px 16px", borderRadius: "10px", background: "rgba(186,26,26,0.07)", border: "1px solid #f9b8b8", color: "#ba1a1a", fontSize: "0.95rem", fontWeight: 600 }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
                  {error}
                </div>
              )}

              <button
                onClick={handleSearch}
                disabled={loading}
                style={{ marginTop: "18px", width: "100%", padding: "16px", borderRadius: "12px", background: loading ? "#a0b5ae" : "#ba1a1a", color: "#fff", fontSize: "1.05rem", fontWeight: 800, border: "none", cursor: loading ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", letterSpacing: "0.3px" }}
              >
                {loading ? (
                  <>
                    <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                    Analyzing Symptoms &amp; Finding Facilities…
                  </>
                ) : (
                  <>
                    <Siren size={20} />
                    Find Nearest Medical Help Now
                  </>
                )}
              </button>

              {loading && (
                <p style={{ textAlign: "center", marginTop: "12px", color: "#59756e", fontSize: "0.9rem", fontWeight: 500 }}>
                  Our AI is triaging your symptoms and querying live map data — this typically takes 15–25 seconds.
                </p>
              )}
            </div>
          )}

          {/* Results */}
          {result && (
            <div>
              <UrgencyBanner urgency={result.urgency} specialty={result.specialty} needs={result.needs} />

              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <HeartPulse size={20} color="#29574b" />
                <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "#171d1b" }}>
                  Nearest Facilities ({result.results?.length || 0} found)
                </h2>
              </div>

              {result.results && result.results.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {result.results.map((facility, idx) => (
                    <FacilityCard key={facility.name + idx} facility={facility} index={idx} />
                  ))}
                </div>
              ) : (
                <div style={{ padding: "32px", borderRadius: "16px", background: "#fff", border: "1px solid #e2eae5", textAlign: "center", color: "#59756e", fontSize: "1rem", fontWeight: 600 }}>
                  No facilities found nearby. Please try again or call 112.
                </div>
              )}

              <div style={{ marginTop: "24px", padding: "16px 20px", borderRadius: "12px", background: "#f5fbf7", border: "1px solid #e2eae5", fontSize: "0.92rem", color: "#59756e", fontWeight: 500 }}>
                <b style={{ color: "#29574b" }}>Your reported symptoms:</b> {symptoms}
              </div>
            </div>
          )}
        </main>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
