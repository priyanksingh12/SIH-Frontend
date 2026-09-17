import { useState, useEffect, useId } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Search,
  Building2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Filter,
  CheckCircle2,
  Sparkles,
  Award,
  BookOpen,
  FileCheck,
  Landmark,
  ShieldCheck,
  Info,
  X,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react'
import { TopBar, Sidebar } from './PatientDashboard.jsx'
import MedicalShaderBg from '../components/MedicalShaderBg'
import { getStoredUser } from '../api/apiClient.js'
import { getSchemes, getSchemeBySlug, getSchemeRecommendations } from '../api/schemesApi.js'

const INDIAN_STATES = [
  'All States',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Andaman and Nicobar Islands',
  'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Jammu and Kashmir',
  'Ladakh',
  'Lakshadweep',
  'Puducherry',
]

const POPULAR_NEEDS = [
  'Hospitalization & Cashless Care',
  'Maternity & Pregnant Women',
  'Cancer & Critical Illness',
  'Surgery & Operations',
  'Generic Medicines & Jan Aushadhi',
  'Child Health & Immunization',
  'Tuberculosis (TB) Care',
  'Dialysis & Kidney Treatment',
]

export default function SchemesPage() {
  const navigate = useNavigate()
  const { slug: routeSlug } = useParams()
  const user = getStoredUser()
  const userName = user?.name || window.localStorage.getItem('SwasthyaSahay-account-name') || 'Patient'

  // Tabs: 'browse' | 'recommend'
  const [activeTab, setActiveTab] = useState('browse')

  // Browse Tab States
  const [schemes, setSchemes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [selectedState, setSelectedState] = useState('All States')
  const [selectedLevel, setSelectedLevel] = useState('All') // 'All' | 'Central' | 'State'
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  // Recommendation Tab States
  const [recState, setRecState] = useState('All States')
  const [recAge, setRecAge] = useState('')
  const [recGender, setRecGender] = useState('female')
  const [recNeed, setRecNeed] = useState('hospital')
  const [recIncome, setRecIncome] = useState('')
  const [recommendations, setRecommendations] = useState([])
  const [recLoading, setRecLoading] = useState(false)
  const [recError, setRecError] = useState(null)
  const [recHasSearched, setRecHasSearched] = useState(false)

  // Scheme Detail Modal
  const [selectedScheme, setSelectedScheme] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
      setPage(1)
    }, 350)
    return () => clearTimeout(timer)
  }, [searchQuery])

  // Fetch schemes on query / state / page change
  useEffect(() => {
    let isCancelled = false
    setLoading(true)
    setError(null)

    const isStateSelected = selectedState && selectedState !== 'All States'

    getSchemes({
      page: isStateSelected ? 1 : page,
      limit: isStateSelected ? 500 : 12,
      q: debouncedQuery,
      state: selectedState,
    })
      .then((res) => {
        if (isCancelled) return
        let list = res.data || []

        // When a state is selected, ensure schemes shown are available in that state
        // Central initiatives apply across all states; state initiatives match chosen state
        if (isStateSelected) {
          const target = selectedState.trim().toLowerCase()
          list = list.filter((s) => {
            const bState = (s.beneficiary_state || '').trim().toLowerCase()
            return bState === target || bState === 'all' || s.level?.toLowerCase() === 'central'
          })

          // Prioritize state-level schemes of the chosen state at the top
          list.sort((a, b) => {
            const aIsState = a.level?.toLowerCase() === 'state' ? 1 : 0
            const bIsState = b.level?.toLowerCase() === 'state' ? 1 : 0
            return bIsState - aIsState
          })
        }

        // Apply level filter (All / Central / State)
        if (selectedLevel !== 'All') {
          list = list.filter((s) => s.level?.toLowerCase() === selectedLevel.toLowerCase())
        }

        setSchemes(list)
        setTotalPages(isStateSelected ? 1 : (res.pages || 1))
        setTotalCount(selectedLevel !== 'All' || isStateSelected ? list.length : (res.total || list.length))
      })
      .catch((err) => {
        if (isCancelled) return
        console.error('Schemes fetch error:', err)
        setError('Unable to load government schemes at this time. Please check your internet connection or try again.')
      })
      .finally(() => {
        if (!isCancelled) setLoading(false)
      })

    return () => {
      isCancelled = true
    }
  }, [debouncedQuery, selectedState, selectedLevel, page])

  // Handle route slug if user opened `/schemes/:slug` directly
  useEffect(() => {
    if (routeSlug) {
      setDetailLoading(true)
      getSchemeBySlug(routeSlug)
        .then((res) => {
          if (res.data) setSelectedScheme(res.data)
        })
        .catch((err) => {
          console.error('Scheme detail error:', err)
        })
        .finally(() => setDetailLoading(false))
    }
  }, [routeSlug])

  const openSchemeModal = async (scheme) => {
    setSelectedScheme(scheme)
    // If brief or details are partial, fetch fresh from slug endpoint
    if (scheme.slug) {
      try {
        const full = await getSchemeBySlug(scheme.slug)
        if (full?.data) setSelectedScheme((prev) => ({ ...prev, ...full.data }))
      } catch (err) {
        console.warn('Could not fetch extra scheme details:', err)
      }
    }
  }

  const handleRecommendSubmit = (e) => {
    if (e) e.preventDefault()
    setRecLoading(true)
    setRecError(null)
    setRecHasSearched(true)

    getSchemeRecommendations({
      state: recState,
      need: recNeed,
      age: recAge,
      gender: recGender,
      income: recIncome,
    })
      .then((res) => {
        setRecommendations(res.data || [])
      })
      .catch((err) => {
        console.error('Recommendation error:', err)
        setRecError('Failed to fetch recommendations. Please try with different criteria.')
      })
      .finally(() => {
        setRecLoading(false)
      })
  }

  return (
    <div className="min-h-screen bg-transparent text-[#171d1b] relative">
      <MedicalShaderBg />
      <TopBar userName={userName} />

      <div className="flex">
        <Sidebar userName={userName} activeLabel="Government Schemes" />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 max-w-[1360px] mx-auto">
          {/* Header Banner */}
          <section className="relative overflow-hidden rounded-[28px] border border-[#c4dcd3] bg-gradient-to-br from-[#1d413b] via-[#29574b] to-[#36685a] p-6 sm:p-10 text-white shadow-[0_12px_40px_rgba(41,87,75,0.18)] mb-8">
            <div className="absolute right-0 top-0 translate-x-12 -translate-y-8 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
            <div className="relative z-10 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 text-[#a3f3d1] text-xs font-bold tracking-wide uppercase mb-4 backdrop-blur-sm">
                <Landmark size={14} /> Official Government Health Directory
              </div>
              <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight text-white mb-3">
                Government Healthcare Schemes
              </h1>
              <p className="text-white/80 text-sm sm:text-base leading-relaxed mb-6">
                Discover 280+ Central and State welfare initiatives, Ayushman Bharat packages, free maternal &amp; child care, cashless hospitalization, and subsidized generic medications.
              </p>

              {/* Quick stats pills */}
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm font-semibold">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <ShieldCheck size={16} className="text-[#a3f3d1]" /> 284+ Health Schemes
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <Building2 size={16} className="text-[#a3f3d1]" /> Central &amp; State Level
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 backdrop-blur-sm border border-white/10">
                  <Sparkles size={16} className="text-[#a3f3d1]" /> AI Eligibility Matcher
                </span>
              </div>
            </div>
          </section>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1.5 mb-8 rounded-2xl bg-[#e4ede7] w-fit border border-[#c4dcd3]">
            <button
              type="button"
              onClick={() => setActiveTab('browse')}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all flex items-center gap-2 border-0 ${
                activeTab === 'browse'
                  ? 'bg-[#29574b] text-white shadow-sm'
                  : 'bg-transparent text-[#404845] hover:text-[#171d1b]'
              }`}
            >
              <BookOpen size={16} /> Browse All Schemes ({totalCount || '280+'})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('recommend')
                if (!recHasSearched) handleRecommendSubmit()
              }}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm cursor-pointer transition-all flex items-center gap-2 border-0 ${
                activeTab === 'recommend'
                  ? 'bg-[#29574b] text-white shadow-sm'
                  : 'bg-transparent text-[#404845] hover:text-[#171d1b]'
              }`}
            >
              <Sparkles size={16} className="text-amber-500" /> Smart Recommendations
            </button>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 1: BROWSE ALL SCHEMES
             ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'browse' && (
            <div>
              {/* Search & Filter Bar */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 mb-6 p-4 rounded-2xl bg-white border border-[#c4dcd3] shadow-sm">
                {/* Search input */}
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#59756e]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by keyword, treatment, illness (e.g. cancer, delivery, surgery)..."
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-[#d5dbd8] bg-[#fbfdfc] text-sm text-[#171d1b] focus:outline-none focus:border-[#29574b] transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-transparent border-0 cursor-pointer"
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {/* State Dropdown */}
                <div className="relative min-w-[200px]">
                  <select
                    value={selectedState}
                    onChange={(e) => {
                      setSelectedState(e.target.value)
                      setPage(1)
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#d5dbd8] bg-[#fbfdfc] text-sm font-semibold text-[#171d1b] cursor-pointer focus:outline-none focus:border-[#29574b]"
                  >
                    {INDIAN_STATES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Level Toggle: All / Central / State */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#f0f5f2] border border-[#d5dbd8]">
                  {['All', 'Central', 'State'].map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => {
                        setSelectedLevel(lvl)
                        setPage(1)
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border-0 cursor-pointer transition-all ${
                        selectedLevel === lvl
                          ? 'bg-[#29574b] text-white shadow-xs'
                          : 'bg-transparent text-[#59756e] hover:text-[#171d1b]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status info bar */}
              <div className="flex items-center justify-between text-xs text-[#59756e] font-semibold mb-6 px-1">
                <span>
                  Showing {schemes.length} of {totalCount} healthcare schemes
                  {selectedState !== 'All States' && ` in ${selectedState}`}
                  {debouncedQuery && ` matching "${debouncedQuery}"`}
                </span>
                {selectedState !== 'All States' || debouncedQuery || selectedLevel !== 'All' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedState('All States')
                      setSelectedLevel('All')
                      setPage(1)
                    }}
                    className="text-[#29574b] hover:underline bg-transparent border-0 cursor-pointer font-bold"
                  >
                    Clear all filters
                  </button>
                ) : null}
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-center my-8">
                  <Info className="mx-auto mb-2 text-red-500" size={24} />
                  <p className="font-semibold text-sm mb-3">{error}</p>
                  <button
                    onClick={() => setPage(page)}
                    className="px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-xs border-0 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Loading Grid */}
              {loading && !error && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-6 rounded-2xl bg-white border border-[#c4dcd3] animate-pulse space-y-4"
                    >
                      <div className="h-5 w-24 bg-gray-200 rounded-full" />
                      <div className="h-6 w-3/4 bg-gray-200 rounded" />
                      <div className="h-4 w-1/2 bg-gray-100 rounded" />
                      <div className="h-16 w-full bg-gray-100 rounded" />
                      <div className="h-9 w-full bg-gray-200 rounded-xl" />
                    </div>
                  ))}
                </div>
              )}

              {/* Empty State */}
              {!loading && !error && schemes.length === 0 && (
                <div className="p-12 text-center bg-white rounded-2xl border border-[#c4dcd3] my-8 max-w-lg mx-auto">
                  <Building2 size={40} className="mx-auto text-gray-400 mb-3" />
                  <h3 className="font-serif text-xl font-bold text-[#171d1b] mb-1">No schemes found</h3>
                  <p className="text-sm text-[#59756e] mb-5">
                    We couldn't find any health programs matching your search criteria. Try a broader search keyword or select "All States".
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedState('All States')
                      setSelectedLevel('All')
                    }}
                    className="px-5 py-2.5 rounded-full bg-[#29574b] text-white font-bold text-xs border-0 cursor-pointer"
                  >
                    Reset Filters
                  </button>
                </div>
              )}

              {/* Scheme Cards Grid */}
              {!loading && !error && schemes.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {schemes.map((scheme) => (
                    <SchemeCard key={scheme.slug || scheme.id} scheme={scheme} onSelect={() => openSchemeModal(scheme)} />
                  ))}
                </div>
              )}

              {/* Pagination Controls */}
              {!loading && totalPages > 1 && (
                <div className="flex items-center justify-between mt-10 px-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                      page <= 1
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-[#29574b] border-[#c4dcd3] hover:bg-[#eaf3ee] cursor-pointer'
                    }`}
                  >
                    <ChevronLeft size={16} /> Previous
                  </button>

                  <span className="text-xs font-semibold text-[#59756e]">
                    Page <strong className="text-[#171d1b]">{page}</strong> of{' '}
                    <strong className="text-[#171d1b]">{totalPages}</strong>
                  </span>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
                      page >= totalPages
                        ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                        : 'bg-white text-[#29574b] border-[#c4dcd3] hover:bg-[#eaf3ee] cursor-pointer'
                    }`}
                  >
                    Next <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              TAB 2: SMART RECOMMENDATIONS
             ═══════════════════════════════════════════════════════════════════════ */}
          {activeTab === 'recommend' && (
            <div>
              {/* Mandatory User Guidelines Disclaimer */}
              <div className="p-5 rounded-2xl bg-amber-50/90 border border-amber-200/80 mb-8 flex items-start gap-3.5 shadow-xs">
                <Info size={20} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 leading-relaxed">
                  <strong className="block text-sm font-bold text-amber-950 mb-0.5">
                    Official Advisory &amp; Eligibility Guidelines
                  </strong>
                  The programs displayed below are <strong>Potentially Eligible Schemes</strong> matched according to publicly notified central and state guidelines. SwasthyaSahay does not grant approval; final eligibility, enrollment, and disbursement are subject to verification of documents by the respective nodal authority or empanelled hospital.
                </div>
              </div>

              {/* Recommendation Criteria Form */}
              <form
                onSubmit={handleRecommendSubmit}
                className="p-6 sm:p-8 rounded-3xl bg-white border border-[#c4dcd3] shadow-sm mb-10"
              >
                <h2 className="font-serif text-2xl font-bold text-[#171d1b] mb-1">
                  Tell us about your healthcare requirement
                </h2>
                <p className="text-xs text-[#59756e] mb-6">
                  Input your demographic and medical details to match with tailored central &amp; state subsidies.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  {/* State */}
                  <div>
                    <label className="block text-xs font-bold text-[#171d1b] uppercase tracking-wider mb-1.5">
                      State of Residence
                    </label>
                    <select
                      value={recState}
                      onChange={(e) => setRecState(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#d5dbd8] bg-[#fbfdfc] text-sm font-semibold text-[#171d1b] focus:border-[#29574b] focus:outline-none"
                    >
                      {INDIAN_STATES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Need / Care Type */}
                  <div>
                    <label className="block text-xs font-bold text-[#171d1b] uppercase tracking-wider mb-1.5">
                      Primary Need
                    </label>
                    <select
                      value={recNeed}
                      onChange={(e) => setRecNeed(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#d5dbd8] bg-[#fbfdfc] text-sm font-semibold text-[#171d1b] focus:border-[#29574b] focus:outline-none"
                    >
                      <option value="hospital">Hospitalization &amp; Inpatient Care</option>
                      <option value="maternity">Maternity &amp; Pregnant Women</option>
                      <option value="cancer">Cancer Treatment</option>
                      <option value="surgery">Surgery &amp; Organ Replacement</option>
                      <option value="medicine">Generic Medicines &amp; Pharmacy</option>
                      <option value="child">Child Healthcare &amp; Immunization</option>
                      <option value="tb">Tuberculosis (TB) Assistance</option>
                      <option value="disability">Disability &amp; Rehabilitation</option>
                      <option value="senior">Senior Citizens Health</option>
                    </select>
                  </div>

                  {/* Gender */}
                  <div>
                    <label className="block text-xs font-bold text-[#171d1b] uppercase tracking-wider mb-1.5">
                      Beneficiary Gender
                    </label>
                    <select
                      value={recGender}
                      onChange={(e) => setRecGender(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#d5dbd8] bg-[#fbfdfc] text-sm font-semibold text-[#171d1b] focus:border-[#29574b] focus:outline-none"
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="any">Family / Any</option>
                    </select>
                  </div>

                  {/* Age */}
                  <div>
                    <label className="block text-xs font-bold text-[#171d1b] uppercase tracking-wider mb-1.5">
                      Age (Years)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={recAge}
                      onChange={(e) => setRecAge(e.target.value)}
                      placeholder="e.g. 35"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-[#d5dbd8] bg-[#fbfdfc] text-sm text-[#171d1b] focus:border-[#29574b] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Quick Need Chips */}
                <div className="mb-6">
                  <span className="block text-[11px] font-bold text-[#59756e] uppercase tracking-wider mb-2">
                    Popular Keywords:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {POPULAR_NEEDS.map((need) => (
                      <button
                        key={need}
                        type="button"
                        onClick={() => {
                          const simpleKeyword = need.toLowerCase().split(' ')[0]
                          setRecNeed(simpleKeyword)
                        }}
                        className="px-3 py-1 rounded-full text-xs font-semibold bg-[#eff5f1] hover:bg-[#dfebe4] text-[#29574b] border border-[#c4dcd3] cursor-pointer transition-colors"
                      >
                        {need}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={recLoading}
                    className="inline-flex items-center gap-2 px-8 py-3 rounded-full bg-[#29574b] hover:bg-[#1f4239] text-white font-bold text-sm cursor-pointer shadow-md transition-all border-0"
                  >
                    {recLoading ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> Evaluating Schemes…
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} /> Find Potentially Eligible Schemes
                      </>
                    )}
                  </button>
                </div>
              </form>

              {/* Heading strictly as required */}
              <div className="mb-6">
                <h2 className="font-serif text-2xl sm:text-3xl font-bold text-[#171d1b]">
                  Potentially Eligible Schemes
                </h2>
                <p className="text-xs text-[#59756e] mt-1">
                  Ranked by applicability score based on your stated state and healthcare need.
                </p>
              </div>

              {/* Recommendations Result Grid */}
              {recLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="p-6 rounded-2xl bg-white border border-[#c4dcd3] animate-pulse h-64" />
                  ))}
                </div>
              )}

              {recError && (
                <div className="p-6 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-center my-6">
                  <p className="font-semibold text-sm">{recError}</p>
                </div>
              )}

              {!recLoading && !recError && recommendations.length === 0 && recHasSearched && (
                <div className="p-12 text-center bg-white rounded-2xl border border-[#c4dcd3] my-8 max-w-lg mx-auto">
                  <Info size={36} className="mx-auto text-amber-500 mb-3" />
                  <h3 className="font-serif text-lg font-bold text-[#171d1b] mb-1">
                    No matching recommendations found
                  </h3>
                  <p className="text-xs text-[#59756e] mb-4">
                    Try selecting "All States" or widening your primary need category to explore broader national packages.
                  </p>
                </div>
              )}

              {!recLoading && !recError && recommendations.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recommendations.map((scheme) => (
                    <RecommendedSchemeCard
                      key={scheme.slug || scheme.id}
                      scheme={scheme}
                      onSelect={() => openSchemeModal(scheme)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SCHEME DETAIL MODAL / SLUG VIEW
         ═══════════════════════════════════════════════════════════════════════ */}
      {selectedScheme && (
        <SchemeDetailModal
          scheme={selectedScheme}
          loading={detailLoading}
          onClose={() => {
            setSelectedScheme(null)
            if (routeSlug) navigate('/schemes')
          }}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Standard Scheme Card Component
   ───────────────────────────────────────────────────────────────────────────── */
function SchemeCard({ scheme, onSelect }) {
  const isCentral = scheme.level?.toLowerCase() === 'central'
  const officialUrl = scheme.official_url || scheme.source_url || `https://www.myscheme.gov.in/schemes/${scheme.slug}`
  const tagsList = (scheme.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 3)

  return (
    <article className="flex flex-col justify-between p-6 rounded-2xl bg-white border border-[#c4dcd3] hover:border-[#29574b]/50 shadow-xs hover:shadow-md transition-all group">
      <div>
        {/* Top Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-extrabold uppercase tracking-wide ${
              isCentral
                ? 'bg-[#e7f4ee] text-[#29574b] border border-[#c4dcd3]'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}
          >
            {scheme.level || 'Central'} Scheme
          </span>
          <span className="text-[11px] font-semibold text-[#59756e] truncate max-w-[150px]">
            {scheme.beneficiary_state || 'All India'}
          </span>
        </div>

        {/* Short title & Full Name */}
        <div className="mb-2">
          {scheme.short_title && (
            <span className="block text-xs font-bold text-[#29574b] uppercase tracking-wider mb-1">
              {scheme.short_title}
            </span>
          )}
          <h3
            onClick={onSelect}
            className="font-serif text-lg font-bold text-[#171d1b] group-hover:text-[#29574b] transition-colors cursor-pointer line-clamp-2 leading-snug"
          >
            {scheme.scheme_name}
          </h3>
        </div>

        {/* Ministry */}
        {scheme.ministry && (
          <p className="text-[11px] font-semibold text-[#59756e] mb-3 line-clamp-1">
            🏛️ {scheme.ministry}
          </p>
        )}

        {/* Brief */}
        <p className="text-xs text-[#404845] leading-relaxed line-clamp-3 mb-4">
          {scheme.brief || 'No summary available.'}
        </p>

        {/* Tags */}
        {tagsList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-5">
            {tagsList.map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-md bg-[#f2f6f4] text-[10px] font-semibold text-[#59756e]"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-[#eaf0ec] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="text-xs font-bold text-[#29574b] hover:underline cursor-pointer bg-transparent border-0 p-0"
        >
          View Full Details →
        </button>

        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#f2f6f4] hover:bg-[#29574b] text-[#29574b] hover:text-white text-xs font-bold no-underline transition-all"
        >
          <span>Know More</span>
          <ExternalLink size={12} />
        </a>
      </div>
    </article>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Recommended Scheme Card (Includes score, eligibility status & match reasons)
   ───────────────────────────────────────────────────────────────────────────── */
function RecommendedSchemeCard({ scheme, onSelect }) {
  const officialUrl = scheme.official_url || scheme.source_url || `https://www.myscheme.gov.in/schemes/${scheme.slug}`
  const matchReasons = scheme.match_reasons || []
  const score = scheme.recommendation_score || 70

  return (
    <article className="p-6 rounded-3xl bg-white border-2 border-[#29574b]/30 shadow-sm hover:shadow-lg transition-all flex flex-col justify-between">
      <div>
        {/* Match Header */}
        <div className="flex items-center justify-between gap-3 mb-3">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 text-xs font-extrabold">
            <CheckCircle2 size={14} className="text-emerald-700" />
            {scheme.eligibility_status || 'Potentially eligible scheme'}
          </span>

          <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-[#29574b] text-[#00ff88]">
            {score}% Match
          </span>
        </div>

        {/* Title */}
        <div className="mb-2">
          {scheme.short_title && (
            <span className="block text-xs font-bold text-[#29574b] uppercase tracking-wider mb-0.5">
              {scheme.short_title}
            </span>
          )}
          <h3
            onClick={onSelect}
            className="font-serif text-xl font-bold text-[#171d1b] hover:text-[#29574b] transition-colors cursor-pointer leading-snug"
          >
            {scheme.scheme_name}
          </h3>
        </div>

        <p className="text-xs text-[#59756e] font-semibold mb-3">
          {scheme.level} Scheme • {scheme.beneficiary_state || 'All India'} • {scheme.ministry}
        </p>

        <p className="text-xs text-[#404845] leading-relaxed mb-4 line-clamp-3">
          {scheme.brief || scheme.benefits}
        </p>

        {/* Match Reasons as Bullet Points (Strict requirement) */}
        {matchReasons.length > 0 && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#f5fbf7] border border-[#c4dcd3]">
            <strong className="block text-[11px] font-bold text-[#29574b] uppercase tracking-wide mb-1.5">
              Why this is recommended for you:
            </strong>
            <ul className="space-y-1 pl-4 text-xs text-[#171d1b] list-disc">
              {matchReasons.map((reason, idx) => (
                <li key={idx} className="leading-tight">
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-[#eaf0ec] flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onSelect}
          className="text-xs font-bold text-[#29574b] hover:underline cursor-pointer bg-transparent border-0 p-0"
        >
          Read Eligibility &amp; Docs →
        </button>

        <a
          href={officialUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#29574b] hover:bg-[#1e443a] text-white text-xs font-bold no-underline shadow-sm transition-all"
        >
          <span>Apply on Official Portal</span>
          <ExternalLink size={13} />
        </a>
      </div>
    </article>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   Full Scheme Detail Modal Component
   ───────────────────────────────────────────────────────────────────────────── */
function SchemeDetailModal({ scheme, loading, onClose }) {
  const officialUrl = scheme.official_url || scheme.source_url || `https://www.myscheme.gov.in/schemes/${scheme.slug}`
  const tags = (scheme.tags || '').split(',').map((t) => t.trim()).filter(Boolean)

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
    >
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white rounded-3xl border border-[#c4dcd3] shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 sm:p-8 bg-[#1f4239] text-white flex items-start justify-between gap-4 shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 rounded text-[11px] font-extrabold uppercase bg-white/20 text-[#a3f3d1]">
                {scheme.level || 'Central'} Scheme
              </span>
              <span className="text-xs text-white/80 font-semibold">
                {scheme.beneficiary_state || 'All India'}
              </span>
            </div>
            {scheme.short_title && (
              <span className="text-xs font-bold text-[#a3f3d1] uppercase tracking-wider block">
                {scheme.short_title}
              </span>
            )}
            <h2 className="font-serif text-xl sm:text-2xl font-bold leading-snug">
              {scheme.scheme_name}
            </h2>
            {scheme.ministry && (
              <p className="text-xs text-white/75 mt-1">🏛️ {scheme.ministry}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border-0 cursor-pointer shrink-0 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 sm:p-8 overflow-y-auto space-y-6 text-sm text-[#171d1b]">
          {/* Brief Overview */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-wider text-[#29574b] mb-1.5">
              Overview &amp; Objective
            </h4>
            <p className="text-[#404845] leading-relaxed">
              {scheme.brief || 'Details will be updated from the central repository.'}
            </p>
          </div>

          {/* Benefits */}
          {scheme.benefits && (
            <div className="p-4 rounded-2xl bg-[#f5fbf7] border border-[#c4dcd3]">
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#29574b] mb-1.5 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-[#29574b]" /> Key Benefits &amp; Cashless Entitlements
              </h4>
              <p className="text-[#171d1b] leading-relaxed whitespace-pre-line">
                {scheme.benefits}
              </p>
            </div>
          )}

          {/* Eligibility Criteria */}
          {scheme.eligibility_criteria && (
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#29574b] mb-1.5 flex items-center gap-2">
                <ShieldCheck size={16} /> Eligibility Criteria
              </h4>
              <p className="text-[#404845] leading-relaxed whitespace-pre-line">
                {scheme.eligibility_criteria}
              </p>
            </div>
          )}

          {/* Documents Required */}
          {scheme.documents_required && (
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#29574b] mb-1.5 flex items-center gap-2">
                <FileCheck size={16} /> Required Documents
              </h4>
              <p className="text-[#404845] leading-relaxed whitespace-pre-line">
                {scheme.documents_required}
              </p>
            </div>
          )}

          {/* Application Process */}
          {scheme.application_process && (
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-[#29574b] mb-1.5 flex items-center gap-2">
                <BookOpen size={16} /> How to Apply
              </h4>
              <p className="text-[#404845] leading-relaxed whitespace-pre-line">
                {scheme.application_process}
              </p>
            </div>
          )}

          {/* Tags */}
          {tags.length > 0 && (
            <div>
              <h4 className="font-bold text-[11px] uppercase tracking-wider text-[#59756e] mb-1.5">
                Categories &amp; Tags
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-md bg-gray-100 text-xs text-gray-700">
                    #{t}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer with Prominent Apply Button */}
        <div className="p-4 sm:p-6 bg-[#f8faf9] border-t border-[#e2eae5] flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-[#59756e]">
            Official application link hosted on Government of India portals.
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-full bg-white border border-[#d5dbd8] hover:bg-gray-50 text-[#404845] font-bold text-sm cursor-pointer"
            >
              Close
            </button>
            <a
              href={officialUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-[#29574b] hover:bg-[#1e4239] text-white font-bold text-sm no-underline shadow-md"
            >
              <span>Apply / Know More</span>
              <ExternalLink size={15} />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
