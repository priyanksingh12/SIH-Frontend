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
    green:  { bg: '#d1fae5', color: '#065f46', border: '#a7f3d0' },
    yellow: { bg: '#fef3c7', color: '#92400e', border: '#fde68a' },
    red:    { bg: '#fee2e2', color: '#991b1b', border: '#fecaca' },
  }
  const c = colors[zone] || colors.green
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px', borderRadius: 999,
      fontSize: 11.5, fontWeight: 800, letterSpacing: '.05em',
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
      textTransform: 'uppercase', lineHeight: 1.3,
    }}>
      {zone}
    </span>
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
      width: collapsed ? 64 : 280,
      minWidth: collapsed ? 64 : 280,
      maxWidth: collapsed ? 64 : 280,
      height: '100vh',
      background: '#eff5f1',
      borderRight: '1px solid #d8e5de',
      display: 'flex',
      flexDirection: 'column',
      transition: 'width 0.22s cubic-bezier(.4,0,.2,1), min-width 0.22s, max-width 0.22s',
      overflow: 'hidden',
      position: 'relative',
      flexShrink: 0,
      boxSizing: 'border-box',
      fontFamily: "'Manrope', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        padding: collapsed ? '16px 8px 12px' : '16px 14px 12px',
        borderBottom: '1px solid rgba(41, 87, 75, 0.08)',
      }}>
        {!collapsed && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MessageSquare size={18} style={{ color: '#29574b' }} />
            <span style={{ color: '#29574b', fontWeight: 800, fontSize: 15, letterSpacing: '.01em' }}>
              Chat History
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Expand history sidebar' : 'Collapse history sidebar'}
          aria-label={collapsed ? 'Expand history' : 'Collapse history'}
          style={{
            background: '#e0ece5',
            border: '1px solid #ccdcd2',
            cursor: 'pointer',
            color: '#29574b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            transition: 'background .15s',
          }}
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      {/* New Chat button */}
      <div style={{ padding: collapsed ? '10px 8px' : '12px 14px 8px' }}>
        <button
          type="button"
          onClick={onNew}
          disabled={loading}
          title="New Chat"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            justifyContent: 'center',
            padding: collapsed ? '10px' : '11px 16px',
            borderRadius: 12,
            border: 'none',
            background: '#29574b',
            color: '#00ff88',
            fontWeight: 800,
            fontSize: 14.5,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: '0 3px 10px rgba(41, 87, 75, 0.18)',
            transition: 'all .15s ease',
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Session list (Expanded) */}
      {!collapsed ? (
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {sessions.length === 0 && (
            <div style={{
              color: '#59756e',
              fontSize: 13.5,
              textAlign: 'center',
              padding: '36px 12px',
              fontWeight: 500,
              lineHeight: 1.5,
            }}>
              No previous chats yet.<br />Click <strong>New Chat</strong> to begin.
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
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '11px 13px',
                  borderRadius: 12,
                  cursor: 'pointer',
                  background: isActive ? '#ffffff' : '#f8fbf9',
                  border: isActive ? '2px solid #29574b' : '1px solid #dce6e1',
                  boxShadow: isActive ? '0 4px 14px rgba(41, 87, 75, 0.09)' : '0 1px 2px rgba(0,0,0,0.02)',
                  transition: 'all .15s ease',
                }}
              >
                <MessageSquare
                  size={16}
                  style={{
                    flexShrink: 0,
                    marginTop: 3,
                    color: isActive ? '#29574b' : '#717975',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  {isRenaming ? (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        ref={renameInputRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') confirmRename()
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        style={{
                          flex: 1,
                          background: '#ffffff',
                          border: '1.5px solid #29574b',
                          borderRadius: 6,
                          color: '#171d1b',
                          fontSize: 13.5,
                          padding: '3px 8px',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={confirmRename}
                        title="Save name"
                        style={{
                          background: '#29574b',
                          border: 0,
                          cursor: 'pointer',
                          color: '#00ff88',
                          padding: '4px 6px',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <Check size={13} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <div
                      title={session.title || 'Untitled Chat'}
                      style={{
                        color: isActive ? '#29574b' : '#171d1b',
                        fontSize: 14,
                        fontWeight: isActive ? 800 : 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.3,
                      }}
                    >
                      {session.title || 'Untitled Chat'}
                    </div>
                  )}

                  {session.preview && !isRenaming && (
                    <div
                      style={{
                        color: '#59756e',
                        fontSize: 12.5,
                        marginTop: 3,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        lineHeight: 1.35,
                      }}
                    >
                      {session.preview}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <ZoneBadge zone={session.zone_result} />
                    {session.message_count > 0 && (
                      <span
                        style={{
                          background: '#e3eee7',
                          color: '#29574b',
                          fontSize: 11,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 999,
                        }}
                      >
                        {session.message_count} msg
                      </span>
                    )}
                    {session.healthReports && session.healthReports.length > 0 && (
                      <span
                        style={{
                          background: '#bceddd',
                          color: '#174036',
                          fontSize: 10.5,
                          fontWeight: 800,
                          padding: '2px 6px',
                          borderRadius: 999,
                        }}
                      >
                        PDF
                      </span>
                    )}
                  </div>
                </div>

                {!isRenaming && (
                  <div
                    style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Rename chat"
                      onClick={(e) => startRename(session, e)}
                      style={{
                        background: 'transparent',
                        border: 0,
                        cursor: 'pointer',
                        color: '#59756e',
                        padding: 3,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Pencil size={13} />
                    </button>
                    <button
                      type="button"
                      title="Delete chat"
                      onClick={(e) => {
                        e.stopPropagation()
                        onDelete(session.id)
                      }}
                      style={{
                        background: 'transparent',
                        border: 0,
                        cursor: 'pointer',
                        color: '#9ca3af',
                        padding: 3,
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        /* Session list (Collapsed) */
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}>
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                title={session.title || 'Chat'}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  border: isActive ? '2px solid #29574b' : '1px solid #dce6e1',
                  background: isActive ? '#29574b' : '#ffffff',
                  color: isActive ? '#00ff88' : '#29574b',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transition: 'all .15s',
                }}
              >
                <MessageSquare size={16} />
              </button>
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
          <div className="assistant-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0, padding: '36px 24px 20px' }}>
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
          <div
            className="assistant-composer-wrap"
            style={{
              position: 'relative',
              width: '100%',
              left: 'auto',
              right: 'auto',
              bottom: 'auto',
              background: '#f5fbf7',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              padding: '16px 24px 24px',
              flexShrink: 0,
              boxSizing: 'border-box',
            }}
          >

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

