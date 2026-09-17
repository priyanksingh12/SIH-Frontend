import { useState, useEffect, useRef } from 'react'
import { Globe, Search } from 'lucide-react'

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'EN', name: 'English', native: 'English' },
  { code: 'hi', label: 'HI', name: 'Hindi', native: 'हिन्दी' },
  { code: 'mr', label: 'MR', name: 'Marathi', native: 'मराठी' },
  { code: 'bn', label: 'BN', name: 'Bengali', native: 'বাংলা' },
  { code: 'gu', label: 'GU', name: 'Gujarati', native: 'ગુજરાતી' },
  { code: 'ta', label: 'TA', name: 'Tamil', native: 'தமிழ்' },
  { code: 'te', label: 'TE', name: 'Telugu', native: 'తెలుగు' },
  { code: 'kn', label: 'KN', name: 'Kannada', native: 'ಕನ್ನಡ' },
  { code: 'ml', label: 'ML', name: 'Malayalam', native: 'മലയാളം' },
  { code: 'pa', label: 'PA', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
  { code: 'or', label: 'OR', name: 'Odia', native: 'ଓଡ଼ିଆ' },
  { code: 'as', label: 'AS', name: 'Assamese', native: 'অসমীয়া' },
  { code: 'ur', label: 'UR', name: 'Urdu', native: 'اردو' },
  { code: 'sa', label: 'SA', name: 'Sanskrit', native: 'संस्कृत' },
  { code: 'ne', label: 'NE', name: 'Nepali', native: 'नेपाली' },
  { code: 'si', label: 'SI', name: 'Sinhala', native: 'සිංහල' },
  { code: 'ks', label: 'KS', name: 'Kashmiri', native: 'کٲشُر' },
  { code: 'doi', label: 'DOI', name: 'Dogri', native: 'डोगरी' },
  { code: 'mai', label: 'MAI', name: 'Maithili', native: 'मैथिली' },
  { code: 'kok', label: 'KOK', name: 'Konkani', native: 'कोंकणी' },
  { code: 'mni', label: 'MNI', name: 'Manipuri', native: 'মেইতেই' },
  { code: 'sat', label: 'SAT', name: 'Santali', native: 'ᱥᱟᱱᱛᱟᱲᱤ' },
  { code: 'sd', label: 'SD', name: 'Sindhi', native: 'سنڌي' },
  { code: 'bo', label: 'BO', name: 'Bodo', native: 'बर' },
]

export default function LanguageSelector({ className = '', dropUp = false }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeLang, setActiveLang] = useState(
    () => localStorage.getItem('bhashini_website_lang') || 'en'
  )
  const [translating, setTranslating] = useState(false)
  const wrapRef = useRef(null)

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === activeLang) || SUPPORTED_LANGUAGES[0]

  useEffect(() => {
    function onOutside(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setSearch('')
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  useEffect(() => {
    function onLangChange(e) {
      if (e.detail?.language) {
        setActiveLang(e.detail.language)
      }
    }
    window.addEventListener('bhashini:languageChange', onLangChange)
    return () => window.removeEventListener('bhashini:languageChange', onLangChange)
  }, [])

  const filtered = search.trim()
    ? SUPPORTED_LANGUAGES.filter(
        (l) =>
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          l.native.toLowerCase().includes(search.toLowerCase()) ||
          l.label.toLowerCase().includes(search.toLowerCase())
      )
    : SUPPORTED_LANGUAGES

  const handleLangChange = async (code) => {
    setOpen(false)
    setSearch('')
    if (code === activeLang) return

    setActiveLang(code)
    localStorage.setItem('bhashini_website_lang', code)
    localStorage.setItem('SwasthyaSahay-dashboard-lang', code)
    window.dispatchEvent(new CustomEvent('bhashini:languageChange', { detail: { language: code } }))

    if (window.BhashiniTranslator) {
      setTranslating(true)
      try {
        await window.BhashiniTranslator.setLanguage(code)
      } catch (err) {
        console.error('Translation error:', err)
      } finally {
        setTranslating(false)
      }
    } else {
      window.location.reload()
    }
  }

  return (
    <div ref={wrapRef} data-no-translate="true" className={`relative shrink-0 ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={translating}
        title="Change language / भाषा बदलें"
        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[#c4dcd3] bg-[#f5fbf7] text-[#29574b] font-bold text-[13px] cursor-pointer whitespace-nowrap shadow-sm hover:bg-[#eaf3ee] transition-all"
      >
        <Globe size={15} className={`shrink-0 text-[#29574b] ${translating ? 'animate-spin' : ''}`} />
        <span className="font-bold">{translating ? 'Translating…' : current.native}</span>
        {!translating && <span className="opacity-50 text-[10px] ml-0.5">▾</span>}
      </button>

      {open && (
        <div
          className={`absolute right-0 w-[240px] max-h-[380px] flex flex-col rounded-2xl bg-white border border-[#d5e5dd] shadow-[0_12px_40px_rgba(41,87,75,0.22)] z-[99999] overflow-hidden ${
            dropUp ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
          }`}
        >
          {/* Search Header */}
          <div className="p-2.5 border-b border-[#e2ede7] bg-[#f8fbf9] shrink-0">
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-white border border-[#cddfd6]">
              <Search size={14} className="text-[#526e67] shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search 24 languages…"
                className="w-full text-xs text-[#171d1b] bg-transparent outline-none border-0 p-0 placeholder:text-[#8ba39a]"
                autoFocus
              />
            </div>
          </div>

          {/* Scrollable Language List */}
          <div className="overflow-y-auto flex-1 py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-center text-xs text-[#717975]">No language found</div>
            ) : (
              filtered.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => handleLangChange(lang.code)}
                  className={`w-full text-left px-3.5 py-2 border-0 cursor-pointer text-[#171d1b] text-[13px] flex items-center gap-2.5 transition-colors ${
                    lang.code === activeLang
                      ? 'bg-[#eaf3ee] font-bold text-[#29574b]'
                      : 'bg-transparent font-medium hover:bg-[#f5fbf7]'
                  }`}
                >
                  <span className="text-[11px] font-bold text-[#59756e] min-w-[28px]">{lang.label}</span>
                  <div className="flex flex-col min-w-0">
                    <span className="text-[13px] leading-tight text-[#171d1b] font-semibold">{lang.native}</span>
                    <span className="text-[10.5px] text-[#717975] leading-tight">{lang.name}</span>
                  </div>
                  {lang.code === activeLang && (
                    <span className="ml-auto text-[#29574b] font-extrabold text-[14px]">✓</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
