/**
 * Bhashini API client for SwasthyaSahay.
 * All endpoints live on the same backend as apiClient (VITE_API_BASE_URL).
 * Uses the same apiGet / apiPost helpers so JWT auth is included automatically.
 */

import { apiGet, apiPost, BASE_URL } from './apiClient.js'

// ─── 1. Get supported languages ───────────────────────────────────────────────
export const getBhashiniLanguages = () => apiGet('/api/bhashini/languages')

// ─── 2. Translate text ────────────────────────────────────────────────────────
export const bhashiniTranslate = ({ text, sourceLanguage, targetLanguage }) =>
  apiPost('/api/bhashini/translate', { text, sourceLanguage, targetLanguage })

// ─── 3. Speech-to-Text (ASR) ─────────────────────────────────────────────────
// `audio` = base64-encoded audio string, `language` = BCP-47 code e.g. "hi"
export const bhashiniSpeechToText = ({ audio, language }) =>
  apiPost('/api/bhashini/speech-to-text', { audio, language })

// ─── 4. Text-to-Speech (TTS) ─────────────────────────────────────────────────
// Returns { audioContent: "<base64 wav/mp3>" }
export const bhashiniTextToSpeech = ({ text, language, gender = 'female' }) =>
  apiPost('/api/bhashini/text-to-speech', { text, language, gender })

// ─── 5. Voice-to-Voice chat ───────────────────────────────────────────────────
export const bhashiniVoiceChat = ({ audio, language, session_id }) =>
  apiPost('/api/bhashini/voice-chat', { audio, language, session_id })

// ─── 6. Batch translate (full-page) ──────────────────────────────────────────
export const bhashiniTranslateBatch = ({ texts, targetLanguage, sourceLanguage = 'en' }) =>
  apiPost('/api/bhashini/translate-batch', { texts, sourceLanguage, targetLanguage })

// ─── Helper: play base64 audio in browser ────────────────────────────────────
export function playBase64Audio(base64, mimeType = 'audio/wav') {
  const dataUrl = base64.startsWith('data:')
    ? base64
    : `data:${mimeType};base64,${base64}`
  const audio = new Audio(dataUrl)
  audio.play().catch(() => {})
  return audio
}

// ─── Helper: record mic → base64 webm/ogg ────────────────────────────────────
/**
 * Starts microphone recording.
 * Returns a stop() function. When called, it resolves a Promise<string> of
 * base64-encoded audio that you can send to /api/bhashini/speech-to-text.
 *
 * Usage:
 *   const { stop, promise } = await startMicRecording()
 *   // ... user talks ...
 *   stop()
 *   const base64Audio = await promise
 */
export async function startMicRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
  const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
  const recorder = new MediaRecorder(stream, { mimeType })
  const chunks = []

  recorder.addEventListener('dataavailable', (e) => { if (e.data.size > 0) chunks.push(e.data) })

  const promise = new Promise((resolve, reject) => {
    recorder.addEventListener('stop', () => {
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunks, { type: mimeType })
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result.split(',')[1]) // strip data:... prefix
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
    recorder.addEventListener('error', reject)
  })

  recorder.start()

  return {
    stop: () => recorder.stop(),
    promise,
    mimeType,
  }
}
