import { OVERPASS_ALL_ENDPOINTS, OVERPASS_TIMEOUT_MS } from './constants.js'

/**
 * Executes an Overpass QL query against the primary endpoint and
 * automatically falls back through mirror endpoints in case of timeouts or high load.
 *
 * @param {string} query - Overpass QL query string
 * @param {number} timeoutMs - Timeout in milliseconds per endpoint attempt
 * @returns {Promise<Array>} Array of raw OSM elements
 */
export async function executeOverpassQuery(query, timeoutMs = OVERPASS_TIMEOUT_MS) {
  let lastError = null

  for (const endpoint of OVERPASS_ALL_ENDPOINTS) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const headers = {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      }
      if (typeof window === 'undefined') {
        headers['User-Agent'] = 'SwasthyaSahay/1.0 (Healthcare OSM Client)'
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText || 'Error'}`)
      }

      const data = await res.json()
      if (data && Array.isArray(data.elements)) {
        return data.elements
      }
    } catch (err) {
      clearTimeout(timer)
      lastError = err
      console.warn(`[OverpassClient] Mirror ${endpoint} failed: ${err.message}. Trying fallback mirror...`)
    }
  }

  throw new Error(`All Overpass API endpoints exhausted. Last error: ${lastError?.message || 'Network error'}`)
}
