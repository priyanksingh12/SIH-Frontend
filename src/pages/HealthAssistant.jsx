import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Paperclip, Send, X, Globe, FileText, Plus, Trash2, Pencil, Check, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import { getStoredUser } from '../api/apiClient.js'
import {
  triageChat, triageReport, getTriageSessions, getTriageSession,
  createNewTriageSession, renameTriageSession, deleteTriageSession,
} from '../api/triageApi.js'
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
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0, margin: '0 2px' }}>
      <button
        type="button"
        className="assistant-lang-btn"
        onClick={() => setOpen((o) => !o)}
        title="Select reply language"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '8px 14px', borderRadius: 999,
          border: '1px solid #c4dcd3', background: '#f5fbf7',
          color: '#29574b', fontWeight: 700, fontSize: 13,
          cursor: 'pointer', fontFamily: 'Manrope, sans-serif',
          whiteSpace: 'nowrap', width: 'auto', height: 'auto', flex: '0 0 auto',
          boxSizing: 'border-box',
        }}
      >
        <Globe size={15} style={{ flexShrink: 0 }} />
        <span>{current.native}</span>
        <span style={{ opacity: 0.5, fontSize: 10, marginLeft: 2 }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 8px)', right: 0,
          minWidth: 170, borderRadius: 14,
          background: '#fff', border: '1px solid #d5e5dd',
          boxShadow: '0 8px 32px rgba(41,87,75,.14)',
          zIndex: 9999, overflow: 'hidden', padding: '4px 0',
        }}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              className="assistant-lang-option"
              onClick={() => { onChange(lang.code); setOpen(false) }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '10px 16px', border: 0, cursor: 'pointer',
                background: lang.code === value ? '#eaf3ee' : 'transparent',
                color: '#171d1b', fontFamily: 'Manrope, sans-serif',
                fontSize: 13, fontWeight: lang.code === value ? 700 : 500,
                display: 'flex', alignItems: 'center', gap: 10,
                height: 'auto', borderRadius: 0,
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

// ─── Zone badge helper ────────────────────────────────────────────────────────
function ZoneBadge({ zone }) {
  if (!zone) return null
  const colors = {
    green:  { bg: '#d1fae5', color: '#065f46', border: '#6ee7b7' },
    yellow: { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
    red:    { bg: '#fee2e2', color: '#991b1b', border: '#fca5a5' },
  }
  const c = colors[zone] || colors.green
  return (
    <span style={{
      display: 'inline-block', padding: '1px 8px', borderRadius: 999,
      fontSize: 10, fontWeight: 800, letterSpacing: '.08em',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      textTransform: 'uppercase',
    }}>{zone}</span>
  )
}

// ─── Chat History Sidebar ─────────────────────────────────────────────────────
function ChatHistorySidebar({ sessions, activeSessionId, onNew, onSelect, onRename, onDelete, loading, collapsed, onToggle }) {
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const renameInputRef = useRef(null)

  useEffect(() => {
    if (renamingId && renameInputRef.current) renameInputRef.current.focus()
  }, [renamingId])

  const startRename = (session, e) => {
    e.stopPropagation()
    setRenamingId(session.id)
    setRenameValue(session.title || '')
  }

  const confirmRename = (e) => {
    e?.stopPropagation()
    if (renameValue.trim() && renamingId) {
      onRename(renamingId, renameValue.trim())
    }
    setRenamingId(null)
  }

  return (
    <aside style={{
      width: collapsed ? 48 : 260,
      minWidth: collapsed ? 48 : 260,
      maxWidth: collapsed ? 48 : 260,
      height: '100%',
      background: '#1a2e28',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s, max-width 0.22s',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: collapsed ? '14px 8px' : '14px 12px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {!collapsed && (
          <span style={{ color: '#bff0e1', fontWeight: 800, fontSize: 13, letterSpacing: '.04em' }}>CHAT HISTORY</span>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#bff0e1', display: 'flex', alignItems: 'center', padding: 4, borderRadius: 6 }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* New Chat button */}
      <div style={{ padding: collapsed ? '8px 6px' : '8px 10px' }}>
        <button
          onClick={onNew}
          disabled={loading}
          title="New Chat"
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 8,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? '8px' : '9px 12px',
            borderRadius: 10, border: '1px solid rgba(0,255,136,0.25)',
            background: 'rgba(0,255,136,0.07)', color: '#00ff88',
            fontWeight: 800, fontSize: 13, cursor: 'pointer',
            transition: 'background .15s',
          }}
        >
          <Plus size={15} />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Session list */}
      {!collapsed && (
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px 12px' }}>
          {sessions.length === 0 && (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center', padding: '24px 8px' }}>
              No past conversations
            </div>
          )}
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId
            const isRenaming = renamingId === session.id
            return (
              <div
                key={session.id}
                onClick={() => !isRenaming && onSelect(session.id)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '9px 10px', borderRadius: 10, marginBottom: 2,
                  cursor: 'pointer', background: isActive ? 'rgba(0,255,136,0.1)' : 'transparent',
                  border: isActive ? '1px solid rgba(0,255,136,0.2)' : '1px solid transparent',
                  transition: 'background .13s',
                }}
              >
                <MessageSquare size={13} style={{ flexShrink: 0, marginTop: 2, color: isActive ? '#00ff88' : 'rgba(255,255,255,0.4)' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isRenaming ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmRename(); if (e.key === 'Escape') setRenamingId(null) }}
                        style={{ flex: 1, background: '#0e1f1a', border: '1px solid #00ff88', borderRadius: 6, color: '#fff', fontSize: 12, padding: '2px 6px', outline: 'none' }}
                      />
                      <button onClick={confirmRename} style={{ background: 'transparent', border: 0, cursor: 'pointer', color: '#00ff88', padding: 2 }}><Check size={13} /></button>
                    </div>
                  ) : (
                    <div style={{ color: isActive ? '#ffffff' : 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: isActive ? 700 : 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {session.title || 'Untitled Chat'}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <ZoneBadge zone={session.zone_result} />
                    {session.message_count > 0 && (
                      <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>{session.message_count} msg</span>
                    )}
                  </div>
                  {session.preview && !isRenaming && (
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {session.preview}
                    </div>
                  )}
                </div>
                {!isRenaming && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                    <button
                      title="Rename"
                      onClick={(e) => startRename(session, e)}
                      style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.35)', padding: 2, borderRadius: 4 }}
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      title="Delete"
                      onClick={(e) => { e.stopPropagation(); onDelete(session.id) }}
                      style={{ background: 'transparent', border: 0, cursor: 'pointer', color: 'rgba(255,100,100,0.5)', padding: 2, borderRadius: 4 }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </aside>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function HealthAssistant() {
  const navigate = useNavigate()
  const user = getStoredUser()
  const userName = user?.name || window.localStorage.getItem('medimate-account-name') || 'there'

  const defaultLang = (() => {
    const pref = user?.preferred_language || 'en'
    const byFull = LANGUAGES.find((l) => LANG_FULL[l.code] === pref)
    if (byFull) return byFull.code
    return LANGUAGES.find((l) => l.code === pref) ? pref : 'en'
  })()

  // ─── State ─────────────────────────────────────────────────────────────────
  const [messages, setMessages] = useState([initialGreeting])
  const [inputMessage, setInputMessage] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [reportLoading, setReportLoading] = useState(false)
  const [error, setError] = useState('')
  const [language, setLanguage] = useState(defaultLang)
  const [pendingAttachments, setPendingAttachments] = useState([])
  const [sessions, setSessions] = useState([])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const chatEndRef = useRef(null)
  const fileInputRef = useRef(null)

  // ─── Scroll to bottom ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // ─── Load sessions list ────────────────────────────────────────────────────
  const loadSessions = useCallback(async () => {
    try {
      const data = await getTriageSessions()
      setSessions(data || [])
      return data || []
    } catch {
      return []
    }
  }, [])

  // ─── Load a session's messages into chat ──────────────────────────────────
  const loadSessionMessages = useCallback(async (sid) => {
    try {
      const detail = await getTriageSession(sid)
      if (detail?.session?.messages?.length > 0) {
        const formatted = detail.session.messages.map((m, idx) => ({
          id: 'hist_' + idx,
          sender: m.role === 'user' ? 'user' : 'system',
          content: m.role === 'user' ? m.content : undefined,
          reply: m.role !== 'user' ? m.content : undefined,
          zone: m.zone || detail.session.zone_result || null,
          is_final: m.is_final || false,
          remedy_suggestion: m.remedy_suggestion || null,
          follow_up_question: m.follow_up_question || null,
        }))
        setMessages([initialGreeting, ...formatted])
      } else {
        setMessages([initialGreeting])
      }
    } catch {
      setMessages([initialGreeting])
    }
  }, [])

  // ─── Mount: load sessions, open most recent ────────────────────────────────
  useEffect(() => {
    setSessionsLoading(true)
    loadSessions().then((data) => {
      if (data && data.length > 0) {
        const latest = data[0]
        setSessionId(latest.id)
        loadSessionMessages(latest.id)
      }
    }).finally(() => setSessionsLoading(false))
  }, [])

  // ─── New Chat ──────────────────────────────────────────────────────────────
  const handleNewChat = async () => {
    setLoading(true)
    try {
      const res = await createNewTriageSession()
      const newId = res?.session_id || res?.id
      if (newId) {
        setSessionId(newId)
        setMessages([initialGreeting])
        setInputMessage('')
        setPendingAttachments([])
        setError('')
        // Add to top of sidebar list immediately
        const newSession = {
          id: newId,
          title: res?.title || `Chat - ${new Date().toLocaleDateString('en-IN')}`,
          preview: null,
          message_count: 0,
          zone_result: null,
          created_at: res?.created_at || new Date().toISOString(),
          updated_at: res?.created_at || new Date().toISOString(),
          healthReports: [],
        }
        setSessions((prev) => [newSession, ...prev.filter((s) => s.id !== newId)])
      }
    } catch {
      // Fallback: just clear the chat
      setSessionId(null)
      setMessages([initialGreeting])
      setError('')
    } finally {
      setLoading(false)
    }
  }

  // ─── Select session from sidebar ──────────────────────────────────────────
  const handleSelectSession = async (sid) => {
    if (sid === sessionId) return
    setSessionId(sid)
    setMessages([initialGreeting])
    setInputMessage('')
    setPendingAttachments([])
    setError('')
    await loadSessionMessages(sid)
  }

  // ─── Rename session ────────────────────────────────────────────────────────
  const handleRenameSession = async (sid, title) => {
    try {
      await renameTriageSession(sid, title)
      setSessions((prev) => prev.map((s) => s.id === sid ? { ...s, title } : s))
    } catch {
      // silently fail
    }
  }

  // ─── Delete session ────────────────────────────────────────────────────────
  const handleDeleteSession = async (sid) => {
    if (!window.confirm('Delete this chat session and its reports?')) return
    try {
      await deleteTriageSession(sid)
      const remaining = sessions.filter((s) => s.id !== sid)
      setSessions(remaining)
      if (sid === sessionId) {
        if (remaining.length > 0) {
          setSessionId(remaining[0].id)
          loadSessionMessages(remaining[0].id)
        } else {
          setSessionId(null)
          setMessages([initialGreeting])
        }
      }
    } catch {
      alert('Failed to delete session.')
    }
  }

  // ─── File picking ──────────────────────────────────────────────────────────
  function handleFileSelect(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const valid = files.filter((f) => {
      if (f.size > MAX_FILE_MB * 1024 * 1024) {
        alert(`"${f.name}" exceeds the ${MAX_FILE_MB} MB size limit.`)
        return false
      }
      return true
    })
    const newAtts = valid.map((file) => ({
      file, name: file.name, type: file.type, size: file.size,
      previewUrl: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }))
    setPendingAttachments((prev) => [...prev, ...newAtts])
    e.target.value = ''
  }

  function removePending(index) {
    setPendingAttachments((prev) => {
      const next = [...prev]
      if (next[index]?.previewUrl) URL.revokeObjectURL(next[index].previewUrl)
      next.splice(index, 1)
      return next
    })
  }

  function attachmentContext(atts) {
    if (!atts.length) return ''
    return '\n\n' + atts.map((a) =>
      a.type?.startsWith('image/') ? `[Attached image: ${a.name}]` : `[Attached file: ${a.name} (${a.type || 'document'})]`
    ).join('\n')
  }

  // ─── Send message ──────────────────────────────────────────────────────────
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

      // If backend auto-created a new session, persist it
      if (res?.session_id) {
        const newSid = res.session_id
        setSessionId(newSid)
        setSessions((prev) => {
          const exists = prev.find((s) => s.id === newSid)
          if (exists) {
            return prev.map((s) => s.id === newSid ? { ...s, title: res.title || s.title, updated_at: new Date().toISOString() } : s)
          }
          return [{
            id: newSid, title: res.title || `Chat - ${new Date().toLocaleDateString('en-IN')}`,
            preview: apiMessage.slice(0, 80), message_count: 1,
            zone_result: res.zone || null, created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(), healthReports: [],
          }, ...prev]
        })
      }

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

      // Update session in sidebar with new zone
      if (res?.session_id && res?.zone) {
        setSessions((prev) => prev.map((s) =>
          s.id === res.session_id ? { ...s, zone_result: res.zone, updated_at: new Date().toISOString() } : s
        ))
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to AI triage. Please try again.')
      setMessages((prev) => [
        ...prev,
        { id: 'err_' + Date.now(), sender: 'system', reply: 'I had trouble evaluating symptoms right now. Please check your connection or try again.' },
      ])
    } finally {
      setLoading(false)
      snapshot.forEach((a) => { if (a.previewUrl) URL.revokeObjectURL(a.previewUrl) })
    }
  }

  const sendMessage = (e) => { e.preventDefault(); handleSend() }
  const handleSuggestionClick = (label) => handleSend(label)

  // ─── Download report ───────────────────────────────────────────────────────
  const handleDownloadReport = async () => {
    if (!sessionId) return
    setReportLoading(true)
    try {
      const res = await triageReport(sessionId)
      const BACKEND_URL = 'https://sih-otuc.onrender.com'
      const resolveUrl = (val) => {
        if (!val || typeof val !== 'string') return val
        if (val.startsWith('/')) return `${BACKEND_URL}${val}`
        return val
      }
      const rawPdfData =
        res?.report_base64 || res?.pdf_base64 || res?.pdf || res?.report ||
        res?.report_url || res?.file_url || res?.url || res?.base64 ||
        res?.data || res?.content || (typeof res === 'string' ? res : null)
      const pdfData = resolveUrl(rawPdfData)
      if (pdfData) {
        const filename = `MediMate_Clinical_Report_${new Date().toISOString().slice(0, 10)}.pdf`
        downloadPdfFile(pdfData, filename)
        const existingReports = JSON.parse(window.localStorage.getItem('medimate-clinical-reports') || '[]')
        const newReport = {
          id: res?.report_id || `rep_${Date.now()}`,
          pdf_url: pdfData, session_id: sessionId,
          generated_at: res?.generated_at || new Date().toISOString(),
          title: 'AI Triage Clinical PDF Summary',
        }
        const updatedReports = [newReport, ...existingReports.filter((r) => r.id !== newReport.id)]
        window.localStorage.setItem('medimate-clinical-reports', JSON.stringify(updatedReports))
        // Update sidebar to show healthReport badge
        setSessions((prev) => prev.map((s) => s.id === sessionId ? {
          ...s, healthReports: [{ id: newReport.id, pdf_url: pdfData, generated_at: newReport.generated_at }, ...s.healthReports],
        } : s))
        alert('Clinical report downloaded and saved to your Patient Profile!')
      } else {
        alert('Report was generated but no PDF data was returned by the server.')
      }
    } catch (err) {
      alert(err.message || 'Failed to generate clinical PDF report.')
    } finally {
      setReportLoading(false)
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────
  const canSend = !loading && (inputMessage.trim().length > 0 || pendingAttachments.length > 0)

  return (
    <div className="assistant-page">
      <Sidebar userName={userName} activeLabel="Health Assistant" />
      <main className="assistant-main" style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', overflow: 'hidden' }}>

        {/* ── Chat History Sidebar ── */}
        <ChatHistorySidebar
          sessions={sessions}
          activeSessionId={sessionId}
          onNew={handleNewChat}
          onSelect={handleSelectSession}
          onRename={handleRenameSession}
          onDelete={handleDeleteSession}
          loading={loading || sessionsLoading}
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed((c) => !c)}
        />

        {/* ── Main Chat Area ── */}
        <div className="assistant-canvas" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
          <div className="assistant-decoration" />
          <div className="assistant-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0 }}>
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
                        {msg.attachments?.length > 0 && <MessageAttachments attachments={msg.attachments} />}
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
                              onClick={() => { window.sessionStorage.setItem('medimate-doctors-entry', 'true'); navigate('/doctors') }}
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
            {pendingAttachments.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', width: 'min(100%, 768px)', marginBottom: 10, padding: '12px 16px', borderRadius: 16, background: '#29574b', boxSizing: 'border-box' }}>
                <span style={{ color: '#bff0e1', fontSize: 12, fontWeight: 700, marginRight: 4 }}>
                  {pendingAttachments.length} file{pendingAttachments.length > 1 ? 's' : ''} selected
                </span>
                {pendingAttachments.map((att, i) => (
                  <AttachmentChip key={i} attachment={att} onRemove={() => removePending(i)} />
                ))}
              </div>
            )}

            <form className="assistant-composer" onSubmit={sendMessage}>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple style={{ display: 'none' }} onChange={handleFileSelect} aria-hidden="true" tabIndex={-1} />
              <button
                type="button"
                aria-label="Attach photo or file"
                title="Attach photo or file"
                onClick={() => fileInputRef.current?.click()}
                style={{ position: 'relative', color: pendingAttachments.length ? '#29574b' : undefined }}
              >
                <Paperclip size={20} />
                {pendingAttachments.length > 0 && (
                  <span style={{ position: 'absolute', top: 4, right: 4, width: 15, height: 15, borderRadius: '50%', background: '#f43f5e', color: '#fff', fontSize: 9, fontWeight: 800, display: 'grid', placeItems: 'center', lineHeight: 1 }}>
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
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              />
              <LanguageSelector value={language} onChange={setLanguage} />
              <button type="submit" className="assistant-send" aria-label="Send message" disabled={!canSend}>
                <Send size={19} />
              </button>
            </form>

            {error && <p style={{ color: '#9a4638', fontWeight: 600, margin: '6px 0 0' }}>{error}</p>}
            <p>MediMate AI can make mistakes. Always consult a doctor for serious concerns.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default HealthAssistant

