/**
 * Helper utility to convert Base64 PDF strings to Blobs / Blob URLs
 * and handle seamless local viewing & downloading.
 */

/** Detect if a string is likely a valid base64 PDF payload */
function looksLikeBase64(str) {
  if (!str || typeof str !== 'string') return false
  // Strip data URI prefix if present
  const raw = str.includes(',') ? str.split(',')[1] : str
  // base64 chars only + padding, min length
  return /^[A-Za-z0-9+/=\r\n]+$/.test(raw.trim()) && raw.trim().length > 20
}

/** Strip whitespace / line-breaks that can appear in some base64 payloads */
function cleanBase64(str) {
  const raw = str.includes(',') ? str.split(',')[1] : str
  return raw.replace(/[\r\n\s]/g, '')
}

export function convertBase64ToPdfBlobUrl(pdfSource) {
  if (!pdfSource) return null

  // Already a blob: URL
  if (typeof pdfSource === 'string' && pdfSource.startsWith('blob:')) {
    return pdfSource
  }

  // Relative path — resolve to full backend URL
  if (typeof pdfSource === 'string' && pdfSource.startsWith('/')) {
    return `https://sih-otuc.onrender.com${pdfSource}`
  }

  // HTTP/HTTPS URL — return as-is so caller can open/embed it directly
  if (
    typeof pdfSource === 'string' &&
    (pdfSource.startsWith('http://') || pdfSource.startsWith('https://'))
  ) {
    return pdfSource
  }

  // data URI already (data:application/pdf;base64,...)
  if (typeof pdfSource === 'string' && pdfSource.startsWith('data:')) {
    try {
      const b64 = cleanBase64(pdfSource)
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      return URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
    } catch {
      return pdfSource // pass through, browser may handle it
    }
  }

  // Raw base64 string
  if (looksLikeBase64(pdfSource)) {
    try {
      const b64 = cleanBase64(pdfSource)
      const binary = atob(b64)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      const blob = new Blob([bytes], { type: 'application/pdf' })
      return URL.createObjectURL(blob)
    } catch (err) {
      console.error('[pdfHelper] base64 → Blob conversion failed:', err)
      // Fallback: wrap into a data URI and let browser handle it
      return `data:application/pdf;base64,${cleanBase64(pdfSource)}`
    }
  }

  console.warn('[pdfHelper] Unrecognised PDF source format:', typeof pdfSource, String(pdfSource).slice(0, 80))
  return null
}

export function downloadPdfFile(pdfSource, filename = 'MediMate_Clinical_Report.pdf') {
  if (!pdfSource) return

  const cleanFilename = filename.endsWith('.pdf') ? filename : `${filename}.pdf`

  // Resolve relative paths to full URL
  const BACKEND_URL = 'https://sih-otuc.onrender.com'
  if (typeof pdfSource === 'string' && pdfSource.startsWith('/')) {
    pdfSource = `${BACKEND_URL}${pdfSource}`
  }

  const triggerDownload = (url, revoke = false) => {
    const a = document.createElement('a')
    a.href = url
    a.download = cleanFilename
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    if (revoke) setTimeout(() => URL.revokeObjectURL(url), 10000)
  }

  // HTTP/HTTPS URL — fetch then download blob
  if (
    typeof pdfSource === 'string' &&
    (pdfSource.startsWith('http://') || pdfSource.startsWith('https://'))
  ) {
    fetch(pdfSource, { mode: 'cors' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.blob()
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob)
        triggerDownload(blobUrl, true)
      })
      .catch(() => {
        // CORS blocked or network error — open in new tab as fallback
        window.open(pdfSource, '_blank')
      })
    return
  }

  // Base64 or data URI → convert to blob URL then download
  const blobUrl = convertBase64ToPdfBlobUrl(pdfSource)
  if (blobUrl) {
    if (blobUrl.startsWith('blob:')) {
      triggerDownload(blobUrl, true)
    } else if (blobUrl.startsWith('data:')) {
      // data URI fallback — open in new tab (some browsers handle the download attr)
      triggerDownload(blobUrl, false)
    } else {
      window.open(blobUrl, '_blank')
    }
  } else {
    console.error('[pdfHelper] downloadPdfFile: could not produce a valid URL from source')
  }
}

