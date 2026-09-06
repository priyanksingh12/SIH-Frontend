import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paperclip, Send, X, Globe, FileText } from 'lucide-react'
import { getStoredUser } from '../api/apiClient.js'
import { triageChat, triageReport, getTriageSessions, getTriageSession } from '../api/triageApi.js'
import { downloadPdfFile } from '../utils/pdfHelper.js'
import { Sidebar } from './PatientDashboard.jsx'

const assistantIcon = 'https://www.figma.com/api/mcp/asset/994e13d4-7d88-414f-8eb7-6178685843b7.svg'
const waterIcon = 'https://www.figma.com/api/mcp/asset/c0f5cab4-dc21-49ec-9890-c2c106e5c1ea.svg'
const screenIcon = 'https://www.figma.com/api/mcp/asset/7ed11f52-9514-4c8a-9b41-e49dce3e977a.svg'
const feverIcon = 'https://www.figma.com/api/mcp/asset/1e395f71-58ba-43ed-aaaa-3d44cf01cd56.svg'
const infoIcon = 'https://www.figma.com/api/mcp/asset/e40a5634-f265-4fa6-bce4-9010a7c9be10.svg'
const arrowIcon = 'https://www.figma.com/api/mcp/asset/049cb2e8-8852-4a4c-bccd-973971ab012a.svg'

// ─── Language config ───────────────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'en', label: 'English',  native: 'English'  },
  { code: 'hi', label: 'Hindi',    native: 'हिन्दी'     },
  { code: 'pa', label: 'Punjabi',  native: 'ਪੰਜਾਬੀ'    },
  { code: 'gu', label: 'Gujarati', native: 'ગુજરાતી'   },
  { code: 'mr', label: 'Marathi',  native: 'मराठी'     },
]

const LANG_FULL = {
  en: 'english', hi: 'hindi', pa: 'punjabi', gu: 'gujarati', mr: 'marathi',
}

// Accepted file MIME types / extensions
const ACCEPTED_TYPES = 'image/*,application/pdf,.doc,.docx,.txt,.csv'
const MAX_FILE_MB = 10

const suggestions = [
  [waterIcon, 'Did you drink enough water?'],
  [screenIcon, 'Excessive screen time?'],
  [feverIcon, 'Any fever?'],
]

const initialGreeting = {
  id: 'welcome',
  sender: 'system',
  reply: 'Hello. I am MediMate, your health assistant. Please describe how you are feeling today, including any specific symptoms or discomforts.',
}

// ─── Helper sub-components ────────────────────────────────────────────────────

function MessageIcon({ src, fallback }) {
  return <span className="assistant-message-icon">{src ? <img src={src} alt="" /> : fallback}</span>
}

function UserInitialsAvatar({ name }) {
  const initials = (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'PT'
  return (
    <span className="assistant-message-icon" style={{ background: '#29574b', color: '#00ff88', fontWeight: '800', fontSize: '0.95rem' }}>
      {initials}
    </span>
  )
}

/** Single attachment chip — shows image thumbnail or file name */
function AttachmentChip({ attachment, onRemove }) {
  const isImage = attachment.type?.startsWith('image/')
  return (
    <div style={{
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: isImage ? 4 : '6px 12px',
      borderRadius: 12,
      background: 'rgba(255,255,255,0.15)',
      border: '1px solid rgba(255,255,255,0.3)',
      maxWidth: 220,
      flexShrink: 0,
    }}>
      {isImage ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, display: 'block' }}
        />
      ) : (
        <>
          <FileText size={18} style={{ flexShrink: 0, color: onRemove ? '#bff0e1' : 'rgba(255,255,255,0.7)' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff', wordBreak: 'break-all', lineHeight: 1.3 }}>{attachment.name}</span>
        </>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${attachment.name}`}
          style={{
            position: 'absolute', top: -8, right: -8,
            width: 20, height: 20, borderRadius: '50%',
            background: '#f43f5e', border: 0, cursor: 'pointer',
            display: 'grid', placeItems: 'center', color: '#fff', padding: 0,
          }}
        >
          <X size={11} />
        </button>
      )}
    </div>
  )
}

/** Renders attached files inside a sent message bubble */
function MessageAttachments({ attachments }) {
  if (!attachments?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
      {attachments.map((att, i) => (
        <AttachmentChip key={i} attachment={att} />
      ))}
    </div>
  )
}

// ─── Language Selector ────────────────────────────────────────────────────────

function LanguageSelector({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const current = LANGUAGES.find((l) => l.code === value) || LANGUAGES[0]

  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Select reply language"
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', borderRadius: 999,
          border: '1px solid #c4dcd3', background: '#f5fbf7',
          color: '#29574b', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
          whiteSpace: 'nowrap',
        }}
      >
        <Globe size={14} />
        {current.native}
        <span style={{ opacity: 0.45, fontSize: 9 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', left: 0,
          minWidth: 170, borderRadius: 14,
          background: '#fff', border: '1px solid #d5e5dd',
          boxShadow: '0 8px 32px rgba(41,87,75,.14)',
          zIndex: 9999, overflow: 'hidden',
        }}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => { onChange(lang.code); setOpen(false) }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 16px', border: 0, cursor: 'pointer',
                background: lang.code === value ? '#eaf3ee' : 'transparent',
                color: '#171d1b', fontFamily: 'Manrope, sans-serif',
                fontSize: 13, fontWeight: lang.code === value ? 700 : 500,
                display: 'flex', alignItems: 'center', gap: 10,
              }}
            >
              <span style={{ opacity: 0.5, fontSize: 11, minWidth: 52 }}>{lang.label}</span>
              <span>{lang.native}</span>
              {lang.code === value && <span style={{ marginLeft: 'auto', color: '#29574b', fontSize: 14 }}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function HealthAssistant() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const userName = user?.name || window.localStorage.getItem('medimate-account-name') || 'there'

  // Derive initial language code from stored user preference
  const defaultLang = (() => {
    const pref = user?.preferred_language || 'en'
    // If stored as full name (e.g. "hindi"), convert to code
    const byFull = LANGUAGES.find((l) => LANG_FULL[l.code] === pref)
    if (byFull) return byFull.code
    return LANGUAGES.find((l) => l.code === pref) ? pref : 'en'
  })()

  const [messages, setMessages] = useState([initialGreeting])
  const [inputMessage, setInputMessage] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState(defaultLang)
  const [pendingAttachments, setPendingAttachments] = useState([])

  const chatEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Load latest triage session on mount
  useEffect(() => {
    getTriageSessions()
      .then(async (sessions) => {
        if (sessions && sessions.length > 0) {
          const latestSession = sessions[0]
          setSessionId(latestSession.id)
          try {
            const detail = await getTriageSession(latestSession.id)
            if (detail?.session?.messages && detail.session.messages.length > 0) {
              const formatted = detail.session.messages.map((m, idx) => ({
                id: 'hist_' + idx,
                sender: m.role === 'user' ? 'user' : 'system',
                content: m.role === 'user' ? m.content : undefined,
                reply: m.role !== 'user' ? m.content : undefined,
                zone: m.zone || detail.session.zone_result,
              }))
              setMessages([initialGreeting, ...formatted])
            }
          } catch {
            // keep default welcome message
          }
        }
      })
      .catch(() => {})
  }, [])

  // ─── File picking ───────────────────────────────────────────────────────────

  function handleFileSelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const valid = files.filter((f) => {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        alert(`"${f.name}" exceeds the ${MAX_FILE_MB} MB size limit and was not added.`)
        return false
      }
      return true
    })

    const newAtts = valid.map((file) => ({
      file,
      name: file.name,
      type: file.type,
      size: file.size,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))

    setPendingAttachments((prev) => [...prev, ...newAtts])
    e.target.value = '' // allow re-selecting the same file
  }

  function removePending(index) {
    setPendingAttachments((prev) => {
      const next = [...prev]
      if (next[index]?.previewUrl) URL.revokeObjectURL(next[index].previewUrl)
      next.splice(index, 1)
      return next
    })
  }

  /** Build extra context text from attachments to append to the API message */
  function attachmentContext(atts) {
    if (!atts.length) return ''
    const lines = atts.map((a) =>
      a.type?.startsWith('image/') ? `[Attached image: ${a.name}]` : `[Attached file: ${a.name} (${a.type || 'document'})]`
    )
    return '\n\n' + lines.join('\n')
  }

  // ─── Send ───────────────────────────────────────────────────────────────────

  const handleSend = async (textToSend) => {
    const rawText = textToSend !== undefined ? textToSend : inputMessage
    const hasText = rawText.trim().length > 0
    const hasFiles = pendingAttachments.length > 0
    if ((!hasText && !hasFiles) || loading) return

    const snapshot = [...pendingAttachments]
    const displayText = rawText.trim() || '📎 Shared attachment(s) for your review.'

    const userMsg = {
      id: 'user_' + Date.now(),
      sender: 'user',
      content: displayText,
      attachments: snapshot,
    }

    setMessages((prev) => [...prev, userMsg])
    setInputMessage('')
    setPendingAttachments([])
    setError('')
    setLoading(true)

    const apiMessage = (rawText.trim() || 'I have attached a file/image for your review.') + attachmentContext(snapshot)

    try {
      const res = await triageChat({
        message: apiMessage,
        language: LANG_FULL[language] || 'english',
        session_id: sessionId || undefined,
      })

      if (res?.session_id) setSessionId(res.session_id)

      const sysMsg = {
        id: 'sys_' + Date.now(),
        sender: 'system',
        reply: res.reply || 'Thank you for sharing your symptoms.',
        zone: res.zone || null,
        is_final: res.is_final || false,
        remedy_suggestion: res.remedy_suggestion || null,
        follow_up_question: res.follow_up_question || null,
      }

      setMessages((prev) => [...prev, sysMsg])
    } catch (err) {
      setError(err.message || 'Failed to connect to AI triage. Please try again.')
      setMessages((prev) => [
        ...prev,
        {
          id: 'err_' + Date.now(),
          sender: 'system',
          reply: 'I had trouble evaluating symptoms right now. Please check your connection or try again.',
        },
      ])
    } finally {
      setLoading(false)
      snapshot.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl) })
    }
  }

  const sendMessage = (e) => { e.preventDefault(); handleSend() }
  const handleSuggestionClick = (label) => handleSend(label)

  // ─── Download report ────────────────────────────────────────────────────────

  const handleDownloadReport = async () => {
    if (!sessionId) return
    setReportLoading(true)
    try {
      const res = await triageReport(sessionId)

      const BACKEND_URL = 'https://sih-otuc.onrender.com'

      // Resolve relative paths (e.g. /uploads/reports/...) to full URLs
      const resolveUrl = (val) => {
        if (!val || typeof val !== 'string') return val
        if (val.startsWith('/')) return `${BACKEND_URL}${val}`
        return val
      }

      const rawPdfData =
        res?.report_base64 ||
        res?.pdf_base64 ||
        res?.pdf ||
        res?.report ||
        res?.report_url ||
        res?.file_url ||
        res?.url ||
        res?.base64 ||
        res?.data ||
        res?.content ||
        (typeof res === 'string' ? res : null)

      const pdfData = resolveUrl(rawPdfData)

      if (pdfData) {
        // 1. Download the PDF file (handles both full URLs and base64)
        const filename = `MediMate_Clinical_Report_${new Date().toISOString().slice(0, 10)}.pdf`
        downloadPdfFile(pdfData, filename)

        // 2. Store report in localStorage for Patient Profile
        const existingReports = JSON.parse(window.localStorage.getItem('medimate-clinical-reports') || '[]')
        const newReport = {
          id: res?.report_id || `rep_${Date.now()}`,
          pdf_url: pdfData,
          session_id: sessionId,
          generated_at: res?.generated_at || new Date().toISOString(),
          title: 'AI Triage Clinical PDF Summary',
        }
        const updatedReports = [newReport, ...existingReports.filter((r) => r.id !== newReport.id)]
        window.localStorage.setItem('medimate-clinical-reports', JSON.stringify(updatedReports))
        alert('Clinical report downloaded to your computer and saved to your Patient Profile!')
      } else {
        alert('Report was generated but no PDF data was returned by the server.')
      }
    } catch (err) {
      alert(err.message || 'Failed to generate clinical PDF report.')
    } finally {
      setReportLoading(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const canSend = !loading && (inputMessage.trim().length > 0 || pendingAttachments.length > 0)

  return (
    <div className="assistant-page">
      <Sidebar userName={userName} activeLabel="Health Assistant" />
      <main className="assistant-main">
        <div className="assistant-canvas">
          <div className="assistant-decoration" />
          <div className="assistant-content">
            <header className="assistant-header">
              <p>AI Health Assistant</p>
              <h1>Tell me what&apos;s bothering you.</h1>
            </header>

            <section className="assistant-chat">
              {messages.map((msg) => {
                if (msg.sender === 'user') {
                  return (
                    <div className="assistant-message assistant-message-user" key={msg.id}>
                      <UserInitialsAvatar name={userName} />
                      <div className="assistant-bubble assistant-bubble-dark">
                        {msg.attachments?.length > 0 && (
                          <MessageAttachments attachments={msg.attachments} />
                        )}
                        {msg.content}
                      </div>
                    </div>
                  )
                }

                const hasRiskCard = Boolean(msg.zone)

                return (
                  <div className="assistant-message assistant-message-system" key={msg.id}>
                    <MessageIcon src={assistantIcon} />
                    {hasRiskCard ? (
                      <div className="assistant-analysis">
                        <div className="assistant-bubble assistant-bubble-light">
                          {msg.reply}
                          {msg.remedy_suggestion && (
                            <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', color: '#171d1b', lineHeight: 1.5 }}>
                              <strong>💡 Self-Care Recommendation:</strong> {msg.remedy_suggestion}
                            </div>
                          )}
                          {msg.follow_up_question && (
                            <div style={{ marginTop: '10px', fontWeight: 600, color: '#29574b' }}>
                              ❓ {msg.follow_up_question}
                            </div>
                          )}
                          <div className="assistant-suggestions">
                            {suggestions.map(([icon, label]) => (
                              <button type="button" key={label} onClick={() => handleSuggestionClick(label)} disabled={loading}>
                                <img src={icon} alt="" />{label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="assistant-risk-card" style={{ borderColor: msg.zone === 'red' ? '#f43f5e' : msg.zone === 'yellow' ? '#f59e0b' : '#10b981' }}>
                          <div className="assistant-risk-heading">
                            <img src={infoIcon} alt="" />
                            <h2 style={{ color: msg.zone === 'red' ? '#991b1b' : msg.zone === 'yellow' ? '#92400e' : '#065f46' }}>
                              Your check-in: {msg.zone.toUpperCase()} Risk.
                            </h2>
                          </div>
                          <p>
                            {msg.zone === 'red'
                              ? 'Critical emergency symptoms detected! Nearby emergency services have been alerted automatically.'
                              : msg.remedy_suggestion || 'Your symptoms suggest that speaking with a healthcare professional would be a good next step.'}
                          </p>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
                            <button
                              type="button"
                              className="assistant-care-link"
                              onClick={() => {
                                window.sessionStorage.setItem('medimate-doctors-entry', 'true')
                                navigate('/doctors')
                              }}
                              style={{ margin: 0 }}
                            >
                              Find nearby care <img src={arrowIcon} alt="" />
                            </button>
                            {sessionId && (
                              <button
                                type="button"
                                onClick={handleDownloadReport}
                                disabled={reportLoading}
                                style={{ padding: '8px 16px', borderRadius: '999px', background: '#29574b', color: '#00ff88', fontWeight: 800, border: 0, cursor: 'pointer', fontSize: '0.85rem' }}
                              >
                                {reportLoading ? 'Generating Report…' : '📄 Download Clinical PDF Report'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="assistant-bubble assistant-bubble-light">
                        {msg.reply}
                        {msg.remedy_suggestion && (
                          <div style={{ marginTop: '12px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', color: '#171d1b', lineHeight: 1.5 }}>
                            <strong>💡 Self-Care Recommendation:</strong> {msg.remedy_suggestion}
                          </div>
                        )}
                        {msg.follow_up_question && (
                          <div style={{ marginTop: '10px', fontWeight: 600, color: '#29574b' }}>
                            ❓ {msg.follow_up_question}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {loading && (
                <div className="assistant-message assistant-message-system assistant-typing-row">
                  <MessageIcon src={assistantIcon} />
                  <div className="assistant-typing"><i /><i /><i /></div>
                </div>
              )}
              <div ref={chatEndRef} />
            </section>
          </div>

          {/* ── Composer ── */}
          <div className="assistant-composer-wrap">

            {/* Pending attachment tray */}
            {pendingAttachments.length > 0 && (
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
                width: 'min(100%, 768px)', marginBottom: 10,
                padding: '12px 16px', borderRadius: 16,
                background: '#29574b', boxSizing: 'border-box',
              }}>
                <span style={{ color: '#bff0e1', fontSize: 12, fontWeight: 700, marginRight: 4 }}>
                  {pendingAttachments.length} file{pendingAttachments.length > 1 ? 's' : ''} selected
                </span>
                {pendingAttachments.map((att, i) => (
                  <AttachmentChip key={i} attachment={att} onRemove={() => removePending(i)} />
                ))}
              </div>
            )}

            <form className="assistant-composer" onSubmit={sendMessage}>
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                multiple
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                aria-hidden="true"
                tabIndex={-1}
              />

              {/* Paperclip — opens file picker */}
              <button
                type="button"
                aria-label="Attach photo or file"
                title="Attach photo or file"
                onClick={() => fileInputRef.current?.click()}
                style={{ position: 'relative', color: pendingAttachments.length ? '#29574b' : undefined }}
              >
                <Paperclip size={20} />
                {pendingAttachments.length > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 15, height: 15, borderRadius: '50%',
                    background: '#f43f5e', color: '#fff',
                    fontSize: 9, fontWeight: 800,
                    display: 'grid', placeItems: 'center', lineHeight: 1,
                  }}>
                    {pendingAttachments.length}
                  </span>
                )}
              </button>

              <input
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Describe your symptoms naturally…"
                aria-label="Describe your symptoms"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
                }}
              />

              {/* Language selector */}
              <LanguageSelector value={language} onChange={setLanguage} />

              <button
                type="submit"
                className="assistant-send"
                aria-label="Send message"
                disabled={!canSend}
              >
                <Send size={19} />
              </button>
            </form>

            {error && (
              <p style={{ color: '#9a4638', fontWeight: 600, margin: '6px 0 0' }}>{error}</p>
            )}
            <p>MediMate AI can make mistakes. Always consult a doctor for serious concerns.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default HealthAssistant
