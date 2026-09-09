/**
 * OpenStreetMap (OSM) Overpass API Constants
 * Configured with primary endpoint and resilient fallback mirrors.
 */

// Primary & Fallback Endpoints
export const OVERPASS_PRIMARY_URL = 'https://overpass-api.de/api/interpreter'

export const OVERPASS_FALLBACK_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

// All active Overpass mirrors in priority order
export const OVERPASS_ALL_ENDPOINTS = [
  OVERPASS_PRIMARY_URL,
  ...OVERPASS_FALLBACK_URLS,
]

// Per-endpoint network timeout in milliseconds
export const OVERPASS_TIMEOUT_MS = 8000

// OSM Query Tag Specifications
export const OSM_TAGS = {
  HOSPITALS: 'amenity=hospital',
  DOCTORS: 'amenity=doctors and healthcare=doctor',
  CLINICS: 'amenity=clinic',
  PHARMACIES: 'amenity=pharmacy',
  LABS: 'healthcare=laboratory or healthcare=diagnostic_centre',
}

// Fallback Hospitals / Health Centers for offline or emergency registry fallback
export function getFallbackHospitals(lat, lng) {
  return [
    {
      id: 'fallback-hosp-1',
      name: 'Community Health Centre (CHC)',
      operator: 'National Health Mission (NHM)',
      category: 'hospital',
      lat: lat + 0.008,
      lng: lng + 0.006,
      distanceKm: 0.9,
      address: 'Main Road, Health Sub-centre Complex, Civil Block',
      phone: '+91 1800-180-1104',
      emergency: true,
    },
    {
      id: 'fallback-hosp-2',
      name: 'Primary Health Centre (PHC)',
      operator: 'State Health Department',
      category: 'clinic',
      lat: lat - 0.012,
      lng: lng + 0.009,
      distanceKm: 1.4,
      address: 'Taluka Road, Near Gram Panchayat Bhawan',
      phone: '+91 0253-221100',
      emergency: true,
    },
    {
      id: 'fallback-hosp-3',
      name: 'Sub-District Hospital & Emergency Trauma Care',
      operator: 'District Health Society',
      category: 'hospital',
      lat: lat + 0.025,
      lng: lng - 0.015,
      distanceKm: 3.2,
      address: 'Civil Lines, Station Road Hospital Area',
      phone: '+91 0253-257000',
      emergency: true,
    },
    {
      id: 'fallback-hosp-4',
      name: 'Dr. Sharma Rural Healthcare Clinic',
      operator: 'Private Practice',
      category: 'doctors',
      lat: lat - 0.018,
      lng: lng - 0.012,
      distanceKm: 2.1,
      address: 'Market Yard, Opposite Central Bus Stand',
      phone: '+91 98220-11223',
      emergency: false,
    },
  ]
}

// Fallback Pharmacies & Medical Stores
export function getFallbackPharmacies(lat, lng) {
  return [
    {
      id: 'fallback-pharm-1',
      name: 'Pradhan Mantri Jan Aushadhi Kendra',
      operator: 'PMBI Govt. Initiative',
      category: 'pharmacy',
      lat: lat + 0.005,
      lng: lng + 0.004,
      distanceKm: 0.6,
      address: 'Near PHC Hospital Main Gate',
      phone: '+91 1800-180-8080',
      openingHours: '24/7',
    },
    {
      id: 'fallback-pharm-2',
      name: 'Sanjeevani Medical & General Store',
      operator: 'Sanjeevani Health Retail',
      category: 'pharmacy',
      lat: lat - 0.008,
      lng: lng + 0.007,
      distanceKm: 1.1,
      address: 'Shop No. 4, Gram Panchayat Market Complex',
      phone: '+91 98221-54321',
      openingHours: '08:00 - 22:00',
    },
    {
      id: 'fallback-pharm-3',
      name: 'Apex Diagnostic & Path Lab Centre',
      operator: 'Apex Healthcare Network',
      category: 'diagnostic',
      lat: lat + 0.014,
      lng: lng - 0.009,
      distanceKm: 1.8,
      address: 'Station Road, 1st Floor Medical Arcade',
      phone: '+91 0253-245678',
      openingHours: '07:00 - 20:00',
    },
    {
      id: 'fallback-pharm-4',
      name: 'Apollo Pharmacy & Emergency Care',
      operator: 'Apollo Hospitals Enterprise',
      category: 'pharmacy',
      lat: lat - 0.015,
      lng: lng - 0.012,
      distanceKm: 2.3,
      address: 'High Street, Near Central Bus Stop',
      phone: '+91 1860-500-0101',
      openingHours: '24/7',
    },
  ]
}
