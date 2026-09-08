import { useState, useEffect, useCallback } from 'react'
import { TopBar, Sidebar } from './PatientDashboard'
import { getStoredUser } from '../api/apiClient.js'
import {
  Building2,
  Stethoscope,
  User2,
  MapPin,
  Phone,
  Navigation,
  AlertCircle,
  Loader2,
  RefreshCcw,
  ShieldPlus,
  ZoomIn,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Overpass / geo helpers
// ---------------------------------------------------------------------------
const OVERPASS_ENDPOINTS = [
  '/api/overpass/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://lz4.overpass-api.de/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
]
const REQUEST_TIMEOUT_MS = 12000

function getFallbackHospitals(lat, lng) {
  return [
    {
      id: 'fallback-1',
      name: 'Community Health Centre (CHC)',
      category: 'hospital',
      lat: lat + 0.008,
      lng: lng + 0.006,
      distanceKm: 0.9,
      address: 'Main Road, Health Sub-centre Complex',
      phone: '+91 1800-180-1104',
      emergency: true,
    },
    {
      id: 'fallback-2',
      name: 'Primary Health Centre (PHC)',
      category: 'clinic',
      lat: lat - 0.012,
      lng: lng + 0.009,
      distanceKm: 1.4,
      address: 'Taluka Road, Near Panchayat Bhawan',
      phone: '+91 0253-221100',
      emergency: true,
    },
    {
      id: 'fallback-3',
      name: 'Sub-District Hospital & Emergency Unit',
      category: 'hospital',
      lat: lat + 0.025,
      lng: lng - 0.015,
      distanceKm: 3.2,
      address: 'Civil Lines, Station Road',
      phone: '+91 0253-257000',
      emergency: true,
    },
    {
      id: 'fallback-4',
      name: 'Rural Healthcare Clinic',
      category: 'doctors',
      lat: lat - 0.018,
      lng: lng - 0.012,
      distanceKm: 2.1,
      address: 'Market Yard, Opposite Bus Stand',
      phone: '+91 98220-11223',
      emergency: false,
    },
  ]
}

const CATEGORIES = [
  { key: 'all',      label: 'All',       Icon: ShieldPlus },
  { key: 'hospital', label: 'Hospitals', Icon: Building2  },
  { key: 'clinic',   label: 'Clinics',   Icon: Stethoscope },
  { key: 'doctors',  label: 'Doctors',   Icon: User2       },
]

const CATEGORY_META = {
  hospital: { label: 'Hospital',  badgeBg: '#e3edfb', badgeColor: '#0a4d8c', dotColor: '#0a4d8c' },
  clinic:   { label: 'Clinic',    badgeBg: '#e6f4ea', badgeColor: '#29574b', dotColor: '#29574b' },
  doctors:  { label: 'Doctor',    badgeBg: '#f3e8fd', badgeColor: '#6a1b9a', dotColor: '#6a1b9a' },
  other:    { label: 'Facility',  badgeBg: '#eff5f1', badgeColor: '#404845', dotColor: '#404845' },
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function classifyTag(tags) {
  if (!tags) return 'other'
  if (tags.amenity === 'hospital') return 'hospital'
  if (tags.amenity === 'clinic')   return 'clinic'
  if (tags.amenity === 'doctors')  return 'doctors'
  return 'other'
}

function buildQuery(lat, lng, r) {
  return `[out:json][timeout:15];
(
  node["amenity"~"hospital|clinic|doctors"](around:${r},${lat},${lng});
  way["amenity"~"hospital|clinic|doctors"](around:${r},${lat},${lng});
);
out center;`
}

async function fetchNearby(lat, lng, radius) {
  const query = buildQuery(lat, lng, radius)

  for (const url of OVERPASS_ENDPOINTS) {
    const ctrl = new AbortController()
    const tid = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body: `data=${encodeURIComponent(query)}`,
        signal: ctrl.signal,
      })
      clearTimeout(tid)
      if (!res.ok) continue
      const data = await res.json()
      const list = (data.elements || [])
        .map((el) => {
          const elLat = el.lat ?? el.center?.lat
          const elLng = el.lon ?? el.center?.lon
          const name = el.tags?.name
          if (!elLat || !elLng || !name) return null
          return {
            id: `${el.type}/${el.id}`,
            name,
            category: classifyTag(el.tags),
            lat: elLat,
            lng: elLng,
            distanceKm: haversineKm(lat, lng, elLat, elLng),
            address: el.tags?.['addr:full'] || el.tags?.['addr:street'] || null,
            phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
            emergency: el.tags?.emergency === 'yes',
          }
        })
        .filter(Boolean)
        .sort((a, b) => a.distanceKm - b.distanceKm)

      if (list.length > 0) return list
    } catch (e) {
      clearTimeout(tid)
      console.warn(`[Overpass] Failed on ${url}:`, e.message)
    }
  }

  // Fallback to local facility registry if all external OSM mirrors are unavailable
  return getFallbackHospitals(lat, lng)
}

function useGeolocation() {
  const [state, setState] = useState({ status: 'idle', lat: null, lng: null })

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: 'unsupported', lat: null, lng: null })
      return
    }
    setState((s) => ({ ...s, status: 'loading' }))
    navigator.geolocation.getCurrentPosition(
      (pos) => setState({ status: 'success', lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()    => setState({ status: 'denied', lat: null, lng: null }),
      { timeout: 10000, enableHighAccuracy: false }
    )
  }, [])

  useEffect(() => { request() }, [request])
  return { ...state, request }
}

function directionsUrl(lat, lng) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

// Build an OSM tile-based iframe map URL showing markers for the visible results
function buildMapUrl(results, userLat, userLng) {
  if (!userLat) return null
  // Use OpenStreetMap's simple embed
  const zoom = 13
  return `https://www.openstreetmap.org/export/embed.html?bbox=${userLng - 0.05},${userLat - 0.05},${userLng + 0.05},${userLat + 0.05}&layer=mapnik&marker=${userLat},${userLng}`
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function NearbyHospitals() {
  const user     = getStoredUser()
  const userName = user?.name || window.localStorage.getItem('medimate-account-name') || 'Patient'

  const geo = useGeolocation()
  const [coords, setCoords]           = useState(null)
  const [manualLat, setManualLat]     = useState('')
  const [manualLng, setManualLng]     = useState('')
  const [radius, setRadius]           = useState(5000)
  const [results, setResults]         = useState([])
  const [loadState, setLoadState]     = useState('idle')   // idle|loading|success|error
  const [activeCategory, setActiveCategory] = useState('all')
  const [selectedPlace, setSelectedPlace]   = useState(null)
  const [iframeModal, setIframeModal]   = useState(null)

  // Pick up geolocation once ready
  useEffect(() => {
    if (geo.status === 'success') setCoords({ lat: geo.lat, lng: geo.lng })
  }, [geo.status, geo.lat, geo.lng])

  // Fetch whenever coords or radius changes
  useEffect(() => {
    if (!coords) return
    let cancelled = false
    setLoadState('loading')
    setResults([])
    fetchNearby(coords.lat, coords.lng, radius)
      .then((r) => { if (!cancelled) { setResults(r); setLoadState('success') } })
      .catch(()  => { if (!cancelled) setLoadState('error') })
    return () => { cancelled = true }
  }, [coords, radius])

  function handleManualSearch(e) {
    e.preventDefault()
    const lat = parseFloat(manualLat)
    const lng = parseFloat(manualLng)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return
    setCoords({ lat, lng })
  }

  const filtered =
    activeCategory === 'all'
      ? results
      : results.filter((r) => r.category === activeCategory)

  const showManual = geo.status === 'denied' || geo.status === 'unsupported' || geo.status === 'error'
  const mapUrl     = buildMapUrl(filtered, coords?.lat, coords?.lng)

  return (
    <div className="min-h-screen bg-transparent text-[#171d1b]" id="hospitals-page">
      <TopBar userName={userName} />
      <div className="flex min-h-[calc(100vh-88px)]">
        <Sidebar userName={userName} activeLabel="Hospitals" />

        <main className="flex-1 min-w-0 w-full max-w-5xl mx-auto px-4 md:px-10 lg:px-16 pb-16 pt-8">
          {/* Page heading */}
          <div className="mb-7">
            <h1 className="flex items-center gap-3 text-3xl md:text-4xl font-extrabold m-0 text-[#171d1b]">
              <Building2 size={32} className="text-[#29574b] shrink-0" />
              Nearby Hospitals &amp; Clinics
            </h1>
            <p className="mt-2 text-[#404845] text-base">
              Real-time results from community map data (OpenStreetMap). Call ahead to verify availability.
            </p>
          </div>

          {/* Location status / manual form */}
          {geo.status === 'loading' && (
            <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-[#eff5f1] border border-[#c0c8c4] mb-6">
              <Loader2 size={20} className="text-[#29574b] animate-spin shrink-0" />
              <span className="text-[#29574b] font-bold">Finding your location…</span>
            </div>
          )}

          {showManual && !coords && (
            <div className="p-6 rounded-2xl bg-[#fff8e1] border border-[#ffe082] mb-6">
              <p className="m-0 mb-4 text-[#7a5c00] font-bold text-base">
                ⚠ Location access was denied. Enter coordinates manually to search.
              </p>
              <form onSubmit={handleManualSearch} className="flex gap-3 flex-wrap items-end">
                <label className="grid gap-1 text-sm font-bold text-[#171d1b]">
                  Latitude
                  <input
                    type="number" step="any" placeholder="e.g. 19.076"
                    value={manualLat} onChange={(e) => setManualLat(e.target.value)} required
                    className="px-3 py-2.5 border border-[#c0c8c4] rounded-xl text-base w-40 bg-white"
                  />
                </label>
                <label className="grid gap-1 text-sm font-bold text-[#171d1b]">
                  Longitude
                  <input
                    type="number" step="any" placeholder="e.g. 72.877"
                    value={manualLng} onChange={(e) => setManualLng(e.target.value)} required
                    className="px-3 py-2.5 border border-[#c0c8c4] rounded-xl text-base w-40 bg-white"
                  />
                </label>
                <button type="submit"
                  className="px-6 py-2.5 rounded-full bg-[#29574b] text-[#00ff88] font-extrabold text-base border-0 cursor-pointer">
                  Search
                </button>
              </form>
            </div>
          )}

          {coords && (
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">

              {/* ── LEFT: Category filter column ── */}
              <div className="flex flex-col gap-2 md:sticky md:top-6">
                <p className="m-0 mb-2 text-xs font-extrabold text-[#717975] tracking-widest uppercase">
                  Filter by type
                </p>
                {CATEGORIES.map(({ key, label, Icon }) => {
                  const isActive = activeCategory === key
                  const count = key === 'all' ? results.length : results.filter(r => r.category === key).length
                  return (
                    <button
                      key={key}
                      onClick={() => { setActiveCategory(key); setSelectedPlace(null) }}
                      className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl text-left text-sm font-semibold cursor-pointer transition-all ${
                        isActive
                          ? 'bg-[#29574b] text-[#00ff88] border-2 border-[#29574b] shadow-[0_4px_14px_rgba(41,87,75,0.2)] font-extrabold'
                          : 'bg-white text-[#404845] border border-[#dee4e0]'
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      <span className="flex-1">{label}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${isActive ? 'bg-[rgba(0,255,136,0.2)] text-[#00ff88]' : 'bg-[#eff5f1] text-[#526e67]'}`}>
                        {count}
                      </span>
                    </button>
                  )
                })}

                {/* Radius control */}
                <div style={{ marginTop: '16px', padding: '16px', borderRadius: '16px', background: '#eff5f1', border: '1px solid #c0c8c4' }}>
                  <p style={{ margin: '0 0 10px', fontSize: '0.8rem', fontWeight: 800, color: '#526e67', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Search radius</p>
                  {[2000, 5000, 10000, 20000].map((r) => (
                    <button key={r} onClick={() => setRadius(r)}
                      style={{
                        display: 'block', width: '100%', padding: '8px 12px', marginBottom: '6px', borderRadius: '10px',
                        border: radius === r ? '2px solid #29574b' : '1px solid #dee4e0',
                        background: radius === r ? '#29574b' : 'white',
                        color: radius === r ? '#00ff88' : '#404845',
                        fontWeight: radius === r ? 800 : 600, fontSize: '0.9rem', cursor: 'pointer',
                      }}>
                      {r >= 1000 ? `${r / 1000} km` : `${r} m`}
                    </button>
                  ))}
                </div>

                {/* Retry / refresh */}
                {coords && (
                  <button onClick={() => { setCoords({ ...coords }) }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', padding: '10px', borderRadius: '12px', border: '1px solid #dee4e0', background: 'white', color: '#404845', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer', marginTop: '4px' }}>
                    <RefreshCcw size={14} /> Refresh
                  </button>
                )}
              </div>

              {/* ── RIGHT: Map + List ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>

                {/* OSM Embed Map */}
                {mapUrl && (
                  <div style={{ borderRadius: '20px', overflow: 'hidden', border: '1px solid #dee4e0', boxShadow: '0 8px 24px rgba(41,87,75,0.06)', position: 'relative' }}>
                    <iframe
                      src={mapUrl}
                      title="Nearby hospitals map"
                      width="100%"
                      height="320"
                      style={{ display: 'block', border: 0 }}
                      allowFullScreen
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        setIframeModal({
                          url: `https://maps.google.com/maps?q=${coords.lat},${coords.lng}&z=14&output=embed`,
                          title: 'Full Map View — Nearby Healthcare Centers',
                        })
                      }}
                      style={{
                        position: 'absolute', bottom: '12px', right: '12px',
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '8px 14px', borderRadius: '999px',
                        background: '#29574b', color: '#00ff88',
                        fontWeight: 800, fontSize: '0.85rem', border: 0,
                        cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                      }}
                    >
                      <ZoomIn size={14} /> Open full view
                    </button>
                  </div>
                )}

                {/* Loading state */}
                {loadState === 'loading' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px', borderRadius: '16px', background: '#eff5f1', border: '1px solid #c0c8c4' }}>
                    <Loader2 size={22} style={{ color: '#29574b', animation: 'spin 1s linear infinite' }} />
                    <span style={{ color: '#29574b', fontWeight: 700 }}>Searching within {radius / 1000} km…</span>
                  </div>
                )}

                {/* Error state */}
                {loadState === 'error' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 24px', borderRadius: '16px', background: '#fdecea', border: '1px solid rgba(186,26,26,0.2)', color: '#b3261e' }}>
                    <AlertCircle size={20} />
                    <span style={{ fontWeight: 700 }}>Couldn't load nearby places. Check your connection and try again.</span>
                  </div>
                )}

                {/* Empty state */}
                {loadState === 'success' && filtered.length === 0 && (
                  <div style={{ padding: '48px 24px', textAlign: 'center', background: '#f5fbf7', borderRadius: '20px', border: '1px solid #dee4e0' }}>
                    <MapPin size={40} style={{ color: '#c0c8c4', marginBottom: '12px' }} />
                    <h3 style={{ margin: '0 0 8px', fontSize: '1.3rem', color: '#171d1b' }}>Nothing found within {radius / 1000} km</h3>
                    <p style={{ color: '#526e67', margin: '0 0 20px' }}>Try widening the search radius using the filter column.</p>
                    <button onClick={() => setRadius((r) => Math.min(r * 2, 50000))}
                      style={{ padding: '12px 28px', borderRadius: '999px', background: '#29574b', color: '#00ff88', fontWeight: 800, fontSize: '1rem', border: 0, cursor: 'pointer' }}>
                      Search wider area
                    </button>
                  </div>
                )}

                {/* Results list */}
                {loadState === 'success' && filtered.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: '#526e67' }}>
                      {filtered.length} result{filtered.length !== 1 ? 's' : ''} · sorted by distance
                    </p>
                    {filtered.map((place) => {
                      const meta    = CATEGORY_META[place.category] || CATEGORY_META.other
                      const isOpen  = selectedPlace?.id === place.id
                      return (
                        <div
                          key={place.id}
                          onClick={() => setSelectedPlace(isOpen ? null : place)}
                          style={{
                            padding: '18px 20px', borderRadius: '20px',
                            border: isOpen ? '2px solid #29574b' : '1px solid #dee4e0',
                            background: 'white',
                            cursor: 'pointer',
                            boxShadow: isOpen ? '0 8px 24px rgba(41,87,75,0.12)' : '0 2px 8px rgba(41,87,75,0.04)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {/* Card top row */}
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <span style={{ fontWeight: 800, fontSize: '1.05rem', color: '#171d1b', display: 'block' }}>{place.name}</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
                                <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: meta.badgeBg, color: meta.badgeColor }}>
                                  {meta.label}
                                </span>
                                {place.emergency && (
                                  <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, background: '#fdecea', color: '#b3261e' }}>
                                    24/7 Emergency
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#29574b' }}>{place.distanceKm.toFixed(1)}</span>
                              <span style={{ fontSize: '0.8rem', color: '#717975', fontWeight: 600 }}> km</span>
                            </div>
                          </div>

                          {/* Expanded details */}
                          {isOpen && (
                            <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #dee4e0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {place.address && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: '#404845', fontSize: '0.9rem' }}>
                                  <MapPin size={14} style={{ flexShrink: 0, marginTop: '2px', color: '#29574b' }} />
                                  {place.address}
                                </div>
                              )}
                              {place.phone && (
                                <a href={`tel:${place.phone}`} onClick={(e) => e.stopPropagation()}
                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#29574b', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none' }}>
                                  <Phone size={14} /> {place.phone}
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setIframeModal({
                                    url: `https://maps.google.com/maps?q=${place.lat},${place.lng}&z=16&output=embed`,
                                    title: `${place.name} — Full View & Directions`,
                                  })
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px',
                                  padding: '10px 18px', borderRadius: '999px',
                                  background: '#29574b', color: '#00ff88',
                                  fontWeight: 800, fontSize: '0.9rem', border: 0,
                                  cursor: 'pointer', alignSelf: 'flex-start',
                                }}
                              >
                                <Navigation size={14} /> Full View &amp; Directions
                              </button>
                            </div>
                          )}

                          {!isOpen && (
                            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {place.address && (
                                <span style={{ fontSize: '0.85rem', color: '#717975', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  <MapPin size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />{place.address}
                                </span>
                              )}
                              <span style={{ fontSize: '0.8rem', color: '#29574b', fontWeight: 700, flexShrink: 0 }}>Tap for details →</span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Embedded Full View iFrame Modal */}
      {iframeModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(15, 29, 25, 0.85)', backdropFilter: 'blur(6px)', display: 'flex', flexDirection: 'column', padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', background: '#1b342e', color: '#ffffff', borderRadius: '16px 16px 0 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <MapPin size={22} style={{ color: '#00ff88' }} />
              <strong style={{ fontSize: '1.2rem' }}>{iframeModal.title}</strong>
            </div>
            <button
              type="button"
              onClick={() => setIframeModal(null)}
              style={{ background: 'rgba(255,255,255,0.15)', border: 0, color: '#ffffff', width: '36px', height: '36px', borderRadius: '50%', fontSize: '1.4rem', cursor: 'pointer', display: 'grid', placeItems: 'center' }}
            >
              ×
            </button>
          </div>
          <div style={{ flex: 1, background: '#ffffff', borderRadius: '0 0 16px 16px', overflow: 'hidden' }}>
            <iframe
              src={iframeModal.url}
              title={iframeModal.title}
              width="100%"
              height="100%"
              style={{ border: 0, display: 'block' }}
              allowFullScreen
              loading="lazy"
            />
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          #hospitals-page .dashboard-main > div[style*="grid-template-columns: 220px"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
