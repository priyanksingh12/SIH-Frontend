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
  return <span className="grid place-items-center w-11 h-11 rounded-full bg-[#e4e9e6] shrink-0 shadow-sm">{src ? <img src={src} alt="" /> : fallback}</span>
}

function UserInitialsAvatar({ name }) {
  const initials = (name || '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'PT'
  return (
    <span className="grid place-items-center w-11 h-11 rounded-full shrink-0 shadow-sm bg-[#29574b] text-[#00ff88] font-[800] text-[0.95rem]">
      {initials}
    </span>
  )
}

/** Single attachment chip — shows image thumbnail or file name */
function AttachmentChip({ attachment, onRemove }) {
  const isImage = attachment.type?.startsWith('image/')
  return (
    <div className={`relative inline-flex items-center gap-2 rounded-xl bg-[rgba(255,255,255,0.15)] border border-[rgba(255,255,255,0.3)] max-w-[220px] shrink-0 ${isImage ? 'p-1' : 'px-3 py-1.5'}`}>
      {isImage ? (
        <img
          src={attachment.previewUrl}
          alt={attachment.name}
          className="w-16 h-16 object-cover rounded-lg block"
        />
      ) : (
        <>
          <FileText size={18} className={`shrink-0 ${onRemove ? 'text-[#bff0e1]' : 'text-[rgba(255,255,255,0.7)]'}`} />
          <span className="text-xs font-semibold text-white break-all leading-tight">{attachment.name}</span>
        </>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${attachment.name}`}
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-[#f43f5e] border-0 cursor-pointer grid place-items-center text-white p-0"
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
    <div className="flex flex-wrap gap-2 mb-2">
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
    <div ref={wrapRef} className="relative shrink-0 mx-0.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Select reply language"
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-[#c4dcd3] bg-[#f5fbf7] text-[#29574b] font-bold text-[13px] cursor-pointer whitespace-nowrap w-auto h-auto shrink-0 box-border"
      >
        <Globe size={15} className="shrink-0" />
        <span>{current.native}</span>
        <span className="opacity-50 text-[10px] ml-0.5">▾</span>
      </button>

      {open && (
        <div className="absolute bottom-[calc(100%+8px)] right-0 min-w-[170px] rounded-2xl bg-white border border-[#d5e5dd] shadow-[0_8px_32px_rgba(41,87,75,0.14)] z-[9999] overflow-hidden py-1">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => { onChange(lang.code); setOpen(false) }}
              className={`w-full text-left px-4 py-2.5 border-0 cursor-pointer text-[#171d1b] text-[13px] flex items-center gap-2.5 h-auto rounded-none ${lang.code === value ? 'bg-[#eaf3ee] font-bold' : 'bg-transparent font-medium'}`}
            >
              <span className="opacity-50 text-[11px] min-w-[52px]">{lang.label}</span>
              <span>{lang.native}</span>
              {lang.code === value && <span className="ml-auto text-[#29574b] text-[14px]">✓</span>}
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
    green:  'bg-[#d1fae5] text-[#065f46] border-[#a7f3d0]',
    yellow: 'bg-[#fef3c7] text-[#92400e] border-[#fde68a]',
    red:    'bg-[#fee2e2] text-[#991b1b] border-[#fecaca]',
  }
  const c = colors[zone] || colors.green
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11.5px] font-extrabold tracking-wider border uppercase leading-tight ${c}`}>
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
    <aside className={`hidden md:flex h-screen bg-[#eff5f1] border-r border-[#d8e5de] flex-col transition-all duration-200 overflow-hidden relative shrink-0 box-border ${collapsed ? 'w-16 min-w-[64px] max-w-[64px]' : 'w-[280px] min-w-[280px] max-w-[280px]'}`}>
      {/* Header */}
      <div className={`flex items-center border-b border-[rgba(41,87,75,0.08)] ${collapsed ? 'justify-center px-2 pt-4 pb-3' : 'justify-between px-3.5 pt-4 pb-3'}`}>
        {!collapsed && (
          <div className="flex items-center gap-2">
            <MessageSquare size={18} className="text-[#29574b]" />
            <span className="text-[#29574b] font-extrabold text-[15px] tracking-[0.01em]">
              Chat History
            </span>
          </div>
        )}
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Expand history sidebar' : 'Collapse history sidebar'}
          aria-label={collapsed ? 'Expand history' : 'Collapse history'}
          className="bg-[#e0ece5] border border-[#ccdcd2] cursor-pointer text-[#29574b] flex items-center justify-center w-8 h-8 rounded-lg transition-colors duration-150"
        >
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
        </button>
      </div>

      {/* New Chat button */}
      <div className={collapsed ? 'px-2 py-2.5' : 'px-3.5 pt-3 pb-2'}>
        <button
          type="button"
          onClick={onNew}
          disabled={loading}
          title="New Chat"
          className={`w-full flex items-center gap-2 justify-center rounded-xl border-0 bg-[#29574b] text-[#00ff88] font-extrabold text-[14.5px] cursor-pointer shadow-[0_3px_10px_rgba(41,87,75,0.18)] transition-all duration-150 ${loading ? 'cursor-not-allowed' : ''} ${collapsed ? 'p-2.5' : 'px-4 py-2.5'}`}
        >
          <Plus size={18} strokeWidth={2.5} />
          {!collapsed && <span>New Chat</span>}
        </button>
      </div>

      {/* Session list (Expanded) */}
      {!collapsed ? (
        <div className="flex-1 overflow-y-auto px-3 pt-1.5 pb-4 flex flex-col gap-2">
          {sessions.length === 0 && (
            <div className="text-[#59756e] text-[13.5px] text-center py-9 px-3 font-medium leading-relaxed">
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
                className={`flex items-start gap-2.5 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-150 ${isActive ? 'bg-white border-2 border-[#29574b] shadow-[0_4px_14px_rgba(41,87,75,0.09)]' : 'bg-[#f8fbf9] border border-[#dce6e1] shadow-[0_1px_2px_rgba(0,0,0,0.02)]'}`}
              >
                <MessageSquare
                  size={16}
                  className={`shrink-0 mt-1 ${isActive ? 'text-[#29574b]' : 'text-[#717975]'}`}
                />
                <div className="flex-1 min-w-0">
                  {isRenaming ? (
                    <div
                      className="flex items-center gap-1.5"
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
                        className="flex-1 bg-white border-[1.5px] border-[#29574b] rounded-md text-[#171d1b] text-[13.5px] px-2 py-1 outline-none"
                      />
                      <button
                        type="button"
                        onClick={confirmRename}
                        title="Save name"
                        className="bg-[#29574b] border-0 cursor-pointer text-[#00ff88] px-1.5 py-1 rounded-md flex items-center"
                      >
                        <Check size={13} strokeWidth={3} />
                      </button>
                    </div>
                  ) : (
                    <div
                      title={session.title || 'Untitled Chat'}
                      className={`text-[14px] overflow-hidden text-ellipsis whitespace-nowrap leading-snug ${isActive ? 'text-[#29574b] font-extrabold' : 'text-[#171d1b] font-semibold'}`}
                    >
                      {session.title || 'Untitled Chat'}
                    </div>
                  )}

                  {session.preview && !isRenaming && (
                    <div className="text-[#59756e] text-[12.5px] mt-1 overflow-hidden text-ellipsis whitespace-nowrap leading-snug">
                      {session.preview}
                    </div>
                  )}

                  <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                    <ZoneBadge zone={session.zone_result} />
                    {session.message_count > 0 && (
                      <span className="bg-[#e3eee7] text-[#29574b] text-[11px] font-bold px-2 py-0.5 rounded-full">
                        {session.message_count} msg
                      </span>
                    )}
                    {session.healthReports && session.healthReports.length > 0 && (
                      <span className="bg-[#bceddd] text-[#174036] text-[10.5px] font-extrabold px-1.5 py-0.5 rounded-full">
                        PDF
                      </span>
                    )}
                  </div>
                </div>

                {!isRenaming && (
                  <div
                    className="flex flex-col gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      title="Rename chat"
                      onClick={(e) => startRename(session, e)}
                      className="bg-transparent border-0 cursor-pointer text-[#59756e] p-1 rounded-md flex items-center"
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
                      className="bg-transparent border-0 cursor-pointer text-[#9ca3af] p-1 rounded-md flex items-center"
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
        <div className="flex-1 overflow-y-auto px-1.5 py-2 flex flex-col items-center gap-2">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => onSelect(session.id)}
                title={session.title || 'Chat'}
                className={`w-10 h-10 rounded-lg cursor-pointer flex items-center justify-center p-0 transition-all duration-150 ${isActive ? 'border-2 border-[#29574b] bg-[#29574b] text-[#00ff88]' : 'border border-[#dce6e1] bg-white text-[#29574b]'}`}
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
    <div className="min-h-screen flex flex-col md:flex-row bg-transparent text-[#171d1b]">
      <Sidebar userName={userName} activeLabel="Health Assistant" />
      <main className="flex-1 min-w-0 flex flex-row min-h-screen overflow-hidden">
        
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
        <div className="relative min-h-screen overflow-hidden bg-[#f5fbf7] flex-1 flex flex-col">
          <div className="absolute -top-48 -right-32 w-96 h-96 rounded-full bg-[rgba(66,111,99,0.05)] blur-3xl pointer-events-none" />
          <div className="w-full max-w-[820px] px-4 md:px-6 py-6 md:py-10 mx-auto flex-1 flex flex-col overflow-y-auto min-h-0 z-10">
            <header className="pb-8 text-center">
              <p className="mb-2 text-[#29574b] font-bold text-base tracking-wide uppercase">AI Health Assistant</p>
              <h1 className="text-[#171d1b] text-3xl font-bold font-serif">Tell me what&apos;s bothering you.</h1>
            </header>

            <section className="flex flex-col gap-9 mt-7 w-full">
              {messages.map((msg) => {
                if (msg.sender === 'user') {
                  return (
                    <div className="flex items-start gap-3 w-full flex-row-reverse justify-start pl-10 md:pl-20" key={msg.id}>
                      <UserInitialsAvatar name={userName} />
                      <div className="max-w-[580px] w-full md:w-auto px-6 py-4 text-base leading-relaxed font-medium text-white bg-[#29574b] rounded-[20px_4px_20px_20px] shadow-lg break-words">
                        {msg.attachments?.length > 0 && <MessageAttachments attachments={msg.attachments} />}
                        {msg.content}
                      </div>
                    </div>
                  )
                }

                const hasRiskCard = Boolean(msg.zone)

                return (
                  <div className="flex items-start gap-3 w-full justify-start pr-10 md:pr-15" key={msg.id}>
                    <MessageIcon src={assistantIcon} />
                    {hasRiskCard ? (
                      <div className="flex flex-col gap-4 w-full">
                        <div className="max-w-[580px] w-full md:w-auto px-6 py-4 text-base leading-relaxed font-medium text-[#171d1b] bg-white border border-[#d5e5dd] rounded-[4px_20px_20px_20px] shadow-md break-words">
                          {msg.reply}
                          {msg.remedy_suggestion && (
                            <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-[rgba(255,255,255,0.7)] text-[0.95rem] text-[#171d1b] leading-relaxed">
                              <strong>💡 Self-Care Recommendation:</strong> {msg.remedy_suggestion}
                            </div>
                          )}
                          {msg.follow_up_question && (
                            <div className="mt-2.5 font-semibold text-[#29574b]">
                              ❓ {msg.follow_up_question}
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2 mt-4">
                            {suggestions.map(([icon, label]) => (
                              <button type="button" key={label} onClick={() => handleSuggestionClick(label)} disabled={loading} className="flex items-center gap-1 px-4 py-2 border border-[#c4dcd3] rounded-full text-[#29574b] bg-[#f5fbf7] text-xs font-bold cursor-pointer">
                                <img src={icon} alt="" />{label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className={`relative overflow-hidden p-6 md:p-8 border rounded-3xl bg-[#fcf8f2] shadow-sm ${msg.zone === 'red' ? 'border-[#f43f5e]' : msg.zone === 'yellow' ? 'border-[#f59e0b]' : 'border-[#10b981]'}`}>
                          <div className="flex items-center gap-2 mb-2">
                            <img src={infoIcon} alt="" />
                            <h2 className={`text-lg font-bold ${msg.zone === 'red' ? 'text-[#991b1b]' : msg.zone === 'yellow' ? 'text-[#92400e]' : 'text-[#065f46]'}`}>
                              Your check-in: {msg.zone.toUpperCase()} Risk.
                            </h2>
                          </div>
                          <p className="text-sm md:text-base">
                            {msg.zone === 'red'
                              ? 'Critical emergency symptoms detected! Nearby emergency services have been alerted automatically.'
                              : msg.remedy_suggestion || 'Your symptoms suggest that speaking with a healthcare professional would be a good next step.'}
                          </p>
                          <div className="flex items-center gap-4 flex-wrap mt-4">
                            <button
                              type="button"
                              onClick={() => { window.sessionStorage.setItem('medimate-doctors-entry', 'true'); navigate('/doctors') }}
                              className="flex items-center gap-2 m-0 bg-transparent border-0 text-[#29574b] font-bold cursor-pointer underline hover:no-underline"
                            >
                              Find nearby care <img src={arrowIcon} alt="" />
                            </button>
                            {sessionId && (
                              <button
                                type="button"
                                onClick={handleDownloadReport}
                                disabled={reportLoading}
                                className="px-4 py-2 rounded-full bg-[#29574b] text-[#00ff88] font-extrabold border-0 cursor-pointer text-[0.85rem]"
                              >
                                {reportLoading ? 'Generating Report…' : '📄 Download Clinical PDF Report'}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-[580px] w-full md:w-auto px-6 py-4 text-base leading-relaxed font-medium text-[#171d1b] bg-white border border-[#d5e5dd] rounded-[4px_20px_20px_20px] shadow-md break-words">
                        {msg.reply}
                        {msg.remedy_suggestion && (
                          <div className="mt-3 px-3.5 py-2.5 rounded-lg bg-[rgba(255,255,255,0.7)] text-[0.95rem] text-[#171d1b] leading-relaxed">
                            <strong>💡 Self-Care Recommendation:</strong> {msg.remedy_suggestion}
                          </div>
                        )}
                        {msg.follow_up_question && (
                          <div className="mt-2.5 font-semibold text-[#29574b]">
                            ❓ {msg.follow_up_question}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}

              {loading && (
                <div className="flex items-start gap-3 w-full justify-start pr-10 md:pr-15">
                  <MessageIcon src={assistantIcon} />
                  <div className="flex items-center gap-1 w-24 h-12 p-4 border border-[rgba(192,200,196,0.5)] rounded-[16px_16px_16px_2px] bg-[#eff5f1]">
                     <div className="w-2 h-2 bg-[#8ca39a] rounded-full animate-bounce" />
                     <div className="w-2 h-2 bg-[#8ca39a] rounded-full animate-bounce [animation-delay:-0.15s]" />
                     <div className="w-2 h-2 bg-[#8ca39a] rounded-full animate-bounce [animation-delay:-0.3s]" />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </section>
          </div>

          {/* ── Composer ── */}
          <div className="relative w-full flex flex-col items-center px-4 md:px-8 py-4 md:py-6 bg-[#f5fbf7] z-20 shrink-0">
            {pendingAttachments.length > 0 && (
              <div className="flex flex-wrap gap-2.5 items-center w-full max-w-[768px] mb-2.5 px-4 py-3 rounded-2xl bg-[#29574b] box-border">
                <span className="text-[#bff0e1] text-xs font-bold mr-1">
                  {pendingAttachments.length} file{pendingAttachments.length > 1 ? 's' : ''} selected
                </span>
                {pendingAttachments.map((att, i) => (
                  <AttachmentChip key={i} attachment={att} onRemove={() => removePending(i)} />
                ))}
              </div>
            )}

            <form className="flex items-center gap-2 w-full max-w-[768px] px-3 py-2 border border-[#d5e5dd] rounded-full bg-white shadow-lg" onSubmit={sendMessage}>
              <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES} multiple className="hidden" onChange={handleFileSelect} aria-hidden="true" tabIndex={-1} />
              <button
                type="button"
                aria-label="Attach photo or file"
                title="Attach photo or file"
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex items-center justify-center cursor-pointer border-0 bg-transparent p-1 ${pendingAttachments.length ? 'text-[#29574b]' : 'text-gray-500'}`}
              >
                <Paperclip size={20} />
                {pendingAttachments.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-[15px] h-[15px] rounded-full bg-[#f43f5e] text-white text-[9px] font-extrabold grid place-items-center leading-none">
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
                className="flex-1 min-w-0 h-[52px] px-2 py-3 border-0 outline-none text-[#171d1b] bg-transparent text-base"
              />
              <LanguageSelector value={language} onChange={setLanguage} />
              <button type="submit" aria-label="Send message" disabled={!canSend} className={`text-white bg-[#29574b] rounded-full shadow w-10 h-10 flex items-center justify-center shrink-0 border-0 ${!canSend ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-[#1f4239]'}`}>
                <Send size={19} className="-ml-0.5" />
              </button>
            </form>

            {error && <p className="text-[#9a4638] font-semibold mt-1.5 mb-0">{error}</p>}
            <p className="mt-2 text-xs text-gray-500 text-center">MediMate AI can make mistakes. Always consult a doctor for serious concerns.</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default HealthAssistant
