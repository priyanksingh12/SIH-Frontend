import { executeOverpassQuery } from './overpassClient.js'
import { getFallbackHospitals, getFallbackPharmacies } from './constants.js'

/**
 * Calculates distance between two coordinates in kilometers using Haversine formula.
 */
export function haversineKm(lat1, lng1, lat2, lng2) {
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

/**
 * Extracts address components (street, housenumber, city, postcode, etc.)
 */
export function extractAddress(tags) {
  if (!tags) return null
  if (tags['addr:full']) return tags['addr:full']

  const streetPart = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ')
  const locality = tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:district']
  const city = tags['addr:city'] || tags['addr:town'] || tags['addr:village']
  const state = tags['addr:state']
  const postcode = tags['addr:postcode']

  const parts = [
    streetPart,
    locality,
    city,
    state ? (postcode ? `${state} - ${postcode}` : state) : postcode,
  ].filter(Boolean)

  if (parts.length > 0) return parts.join(', ')
  if (tags['addr:place']) return tags['addr:place']
  return null
}

/**
 * Classifies hospital and doctor elements by OSM tags.
 * Hospitals: amenity=hospital
 * Doctors: amenity=doctors and healthcare=doctor
 */
export function classifyHospitalTag(tags) {
  if (!tags) return 'other'
  if (tags.amenity === 'hospital' || tags.healthcare === 'hospital') return 'hospital'
  if (tags.amenity === 'clinic' || tags.healthcare === 'clinic') return 'clinic'
  if (tags.amenity === 'doctors' || tags.healthcare === 'doctor') return 'doctors'
  return 'other'
}

/**
 * Classifies pharmacy, medical store, and diagnostic lab elements.
 */
export function classifyStoreTag(tags) {
  if (!tags) return 'other'
  if (tags.amenity === 'pharmacy') return 'pharmacy'
  if (tags.healthcare === 'laboratory' || tags.healthcare === 'diagnostic_centre') return 'diagnostic'
  if (tags.amenity === 'clinic') return 'diagnostic'
  return 'other'
}

/**
 * Parses raw OSM element into standardized facility object.
 */
export function parseOsmElement(el, userLat, userLng, isStore = false) {
  const elLat = el.lat ?? el.center?.lat
  const elLng = el.lon ?? el.center?.lon

  // Facility Name (name, operator)
  const name = el.tags?.name || el.tags?.operator || el.tags?.['name:en'] || el.tags?.official_name
  if (!elLat || !elLng || !name) return null

  const category = isStore ? classifyStoreTag(el.tags) : classifyHospitalTag(el.tags)

  return {
    id: `${el.type}/${el.id}`,
    name,
    operator: el.tags?.operator || null,
    category,
    lat: elLat,
    lng: elLng,
    distanceKm: haversineKm(userLat, userLng, elLat, elLng),
    address: extractAddress(el.tags),
    phone: el.tags?.phone || el.tags?.['contact:phone'] || el.tags?.['phone:mobile'] || null,
    emergency: el.tags?.emergency === 'yes',
    openingHours: el.tags?.opening_hours || null,
  }
}

/**
 * Builds Overpass QL query for Hospitals and Doctors:
 * Hospitals: amenity=hospital
 * Doctors: amenity=doctors and healthcare=doctor
 */
export function buildHospitalsQuery(lat, lng, radius) {
  return `[out:json][timeout:15];
(
  node["amenity"="hospital"](around:${radius},${lat},${lng});
  way["amenity"="hospital"](around:${radius},${lat},${lng});
  relation["amenity"="hospital"](around:${radius},${lat},${lng});
  node["amenity"="clinic"](around:${radius},${lat},${lng});
  way["amenity"="clinic"](around:${radius},${lat},${lng});
  node["amenity"="doctors"](around:${radius},${lat},${lng});
  way["amenity"="doctors"](around:${radius},${lat},${lng});
  node["healthcare"="doctor"](around:${radius},${lat},${lng});
  way["healthcare"="doctor"](around:${radius},${lat},${lng});
);
out center;`
}

/**
 * Builds Overpass QL query for Pharmacies, Medical Stores, and Labs.
 */
export function buildStoresQuery(lat, lng, radius) {
  return `[out:json][timeout:15];
(
  node["amenity"="pharmacy"](around:${radius},${lat},${lng});
  way["amenity"="pharmacy"](around:${radius},${lat},${lng});
  node["healthcare"~"laboratory|diagnostic_centre"](around:${radius},${lat},${lng});
  way["healthcare"~"laboratory|diagnostic_centre"](around:${radius},${lat},${lng});
  node["amenity"="clinic"](around:${radius},${lat},${lng});
  way["amenity"="clinic"](around:${radius},${lat},${lng});
);
out center;`
}

/**
 * Fetches nearby hospitals and doctors via Overpass API with mirror failover.
 */
export async function fetchNearbyHospitals(lat, lng, radius = 5000) {
  const query = buildHospitalsQuery(lat, lng, radius)
  try {
    const rawElements = await executeOverpassQuery(query)
    const facilities = rawElements
      .map((el) => parseOsmElement(el, lat, lng, false))
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)

    if (facilities.length > 0) {
      return facilities
    }
  } catch (err) {
    console.warn('[OSM Service] Failed to fetch live hospital data, using fallback:', err.message)
  }

  // Graceful fallback to verified health centers
  return getFallbackHospitals(lat, lng)
}

/**
 * Fetches nearby pharmacies, medical stores, and diagnostics via Overpass API.
 */
export async function fetchNearbyMedicalStores(lat, lng, radius = 5000) {
  const query = buildStoresQuery(lat, lng, radius)
  try {
    const rawElements = await executeOverpassQuery(query)
    const stores = rawElements
      .map((el) => parseOsmElement(el, lat, lng, true))
      .filter(Boolean)
      .sort((a, b) => a.distanceKm - b.distanceKm)

    if (stores.length > 0) {
      return stores
    }
  } catch (err) {
    console.warn('[OSM Service] Failed to fetch live medical store data, using fallback:', err.message)
  }

  // Graceful fallback to verified pharmacies
  return getFallbackPharmacies(lat, lng)
}
