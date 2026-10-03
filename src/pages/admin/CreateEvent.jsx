import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { hasFeature as checkFeature } from '../../lib/features'
import toast from 'react-hot-toast'
import Button from '../../components/ui/Button'
import Input from '../../components/ui/Input'
import {
  PER_FLIGHT_GAMES,
  GROUP_GAMES,
  PER_FLIGHT_FORMAT_KEYS,
  FORMAT_OPTIONS,
  PLACES_OPTIONS,
  buildFormatsArray,
  buildSideGameOptions,
} from './LeagueDetail'

export default function CreateEvent() {
  const { leagueSlug } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [league,  setLeague]  = useState(null)
  const [orgTier, setOrgTier] = useState('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('org_id, is_owner, is_platform_admin').eq('id', user.id).single()
      if (profile?.org_id) {
        const { data: org } = await supabase
          .from('organizations').select('tier').eq('id', profile.org_id).single()
        const isPrivileged = profile?.is_owner || profile?.is_platform_admin
        setOrgTier(isPrivileged ? 'club' : (org?.tier ?? 'free'))
      }
      const { data: lg } = await supabase
        .from('leagues').select('id, name, slug').eq('slug', leagueSlug).single()
      if (!lg) { navigate('/admin/leagues'); return }
      setLeague(lg)
      setLoading(false)
    }
    init()
  }, [user, leagueSlug])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-48 rounded-lg" style={{ background: '#eceae5' }} />
        <div className="h-96 rounded-xl" style={{ background: '#eceae5' }} />
      </div>
    )
  }

  return <CreateEventForm league={league} orgTier={orgTier} onDone={() => navigate(-1)} />
}

function CreateEventForm({ league, orgTier, onDone }) {
  const canUsePro = checkFeature(orgTier ?? 'free', 'side_games')

  const [courses,      setCourses]      = useState([])
  const [courseId,     setCourseId]     = useState('')
  const [eventDate,    setEventDate]    = useState('')
  const [eventNum,     setEventNum]     = useState(1)
  const [eventName,    setEventName]    = useState('')
  const [entryFee,     setEntryFee]     = useState('20')
  const [payoutBasis,  setPayoutBasis]  = useState('per_player')
  const [payoutFixed,  setPayoutFixed]  = useState('')
  const [formats,      setFormats]      = useState(new Set(['net_stroke']))
  const [formatScope,  setFormatScope]  = useState({})   // { format_key: 'flight'|'group' }
  const [payoutPlaces, setPayoutPlaces] = useState({})   // { format_key: number }
  const [sideGames,    setSideGames]    = useState(new Set())
  const [customCompetitions, setCustomCompetitions] = useState([])
  const [gameScope,    setGameScope]    = useState({})   // { game_key: 'flight'|'group' }
  const [numFlights,   setNumFlights]   = useState(0)   // 0 = no flights, 2–25 = number of flights
  const [startTime,    setStartTime]    = useState('')
  const [interval,     setInterval]     = useState(10)
  const [tournamentFee,  setTournamentFee]  = useState('')
  const [venmoHandle,   setVenmoHandle]   = useState('')
  const [paypalLink,    setPaypalLink]    = useState('')
  const [zelleHandle,     setZelleHandle]     = useState('')
  const [customQuestions, setCustomQuestions] = useState([{ label: '', required: false }])
  const [scheduleItems,   setScheduleItems]   = useState([])
  const [shotgunStart,  setShotgunStart]  = useState(false)
  const [holesPlayed,   setHolesPlayed]   = useState(18)
  const [useHandicaps,  setUseHandicaps]  = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [sideGameBuyIns, setSideGameBuyIns] = useState({})

  useEffect(() => {
    supabase.from('courses').select('id, name').order('name').then(({ data }) => setCourses(data ?? []))
    if (league) {
      supabase.from('events').select('event_number').eq('league_id', league.id).order('event_number', { ascending: false }).limit(1)
        .then(({ data }) => setEventNum(data?.[0]?.event_number ? data[0].event_number + 1 : 1))
    }
  }, [league])

  function toggleFormat(key) {
    setFormats(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  }
  function toggleSideGame(key) {
    setSideGames(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  }
  function toggleBuyIn(key) {
    setSideGameBuyIns(prev => ({ ...prev, [key]: { ...prev[key], enabled: !(prev[key]?.enabled) } }))
  }
  function setBuyInAmount(key, val) {
    setSideGameBuyIns(prev => ({ ...prev, [key]: { ...prev[key], amount: val } }))
  }

  async function handleSave(e) {
    e.preventDefault()
    if (!courseId || !eventDate || formats.size === 0) return
    setSaving(true)
    const formatsArr = buildFormatsArray(formats, formatScope, numFlights)
    const { error } = await supabase.from('events').insert({
      league_id:              league.id,
      course_id:              courseId,
      event_date:             eventDate,
      event_number:           parseInt(eventNum, 10),
      name:                   eventName.trim() || null,
      entry_fee:              Math.round(parseFloat(entryFee) * 100) / 100,
      payout_basis:           payoutBasis,
      payout_fixed_total:     payoutBasis === 'fixed' ? parseFloat(payoutFixed) || 0 : null,
      format:                 formatsArr[0]?.replace(/_[a-z]$/, '') ?? formatsArr[0],
      formats:                formatsArr,
      use_flights:            numFlights > 0,
      num_flights:            numFlights > 0 ? numFlights : null,
      side_game_options:      buildSideGameOptions(sideGames, gameScope, numFlights),
      payout_places:          Object.keys(payoutPlaces).length > 0 ? payoutPlaces : null,
      start_time:             startTime || null,
      tee_time_interval_mins: parseInt(interval, 10),
      tournament_fee:         tournamentFee ? Math.round(parseFloat(tournamentFee) * 100) / 100 : null,
      venmo_handle:           venmoHandle.trim().replace(/^@/, '') || null,
      paypal_link:            paypalLink.trim() || null,
      zelle_handle:           zelleHandle.trim() || null,
      custom_questions:       customQuestions.filter(q => q.label.trim()),
      custom_competitions:    customCompetitions.filter(c => c.trim()),
      schedule_items:         scheduleItems.filter(s => s.label.trim()),
      shotgun_start:          shotgunStart,
      holes_played:           holesPlayed,
      use_handicaps:          useHandicaps,
      status:                 'upcoming',
      side_game_buy_ins:      Object.fromEntries(
        Object.entries(sideGameBuyIns)
          .filter(([k, v]) => sideGames.has(k) && v?.enabled)
          .map(([k, v]) => [k, { enabled: true, amount: v.amount !== '' && v.amount != null ? parseFloat(v.amount) : null }])
      ),
    })
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Event created'); onDone() }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <button onClick={onDone} className="text-sm text-ink-muted hover:text-ink">← Back</button>
      </div>

      <div className="card p-5 sm:p-6">
        <h1 className="text-xl font-bold text-ink mb-5" style={{ letterSpacing: '-0.02em' }}>
          New Event — {league?.name ?? ''}
        </h1>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Event #" type="number" min="1" value={eventNum} onChange={e => setEventNum(e.target.value)} required />
            <Input label="Date" type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} required />
          </div>
          <Input label="Event Name (optional)" value={eventName} onChange={e => setEventName(e.target.value)} placeholder="e.g. Spring Opener, Member-Guest…" />
          <div>
            <label className="label">Course</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)} className="input bg-white" required>
              <option value="">Select course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div className={`bg-gray-50 rounded-xl px-4 py-3 ${!canUsePro ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-800 flex items-center gap-2">
                  Number of Flights
                  {!canUsePro && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Pro</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">Flight A = highest/best players. Leave at "No flights" for a single field.</div>
              </div>
              <select
                value={numFlights}
                onChange={e => canUsePro && setNumFlights(Number(e.target.value))}
                disabled={!canUsePro}
                className="input bg-white w-36"
              >
                <option value={0}>No flights</option>
                {Array.from({ length: 24 }, (_, i) => i + 2).map(n => (
                  <option key={n} value={n}>{n} flights ({Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i)).join(', ')})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">Shotgun Start?</div>
              <div className="text-xs text-gray-400 mt-0.5">All groups tee off simultaneously from different holes</div>
            </div>
            <button
              type="button"
              onClick={() => setShotgunStart(v => !v)}
              className={`relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${shotgunStart ? 'bg-fairway-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${shotgunStart ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">Holes Played</div>
              <div className="text-xs text-gray-400 mt-0.5">Defaults to 18. Select 9 for a nine-hole event.</div>
            </div>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden text-sm font-semibold">
              {[18, 9].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHolesPlayed(h)}
                  className={`px-4 py-1.5 transition-colors ${holesPlayed === h ? 'bg-fairway-700 text-white' : 'bg-white text-gray-600 hover:bg-gray-100'}`}
                >
                  {h}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-gray-800">Use Handicaps</div>
              <div className="text-xs text-gray-400 mt-0.5">When off, handicap index is not required when adding players.</div>
            </div>
            <button
              type="button"
              onClick={() => setUseHandicaps(v => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${useHandicaps ? 'bg-fairway-600' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${useHandicaps ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div>
            <label className="label">Scoring Formats</label>
            <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-3">
              {FORMAT_OPTIONS.map(group => (
                <div key={group.group}>
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1.5">{group.group}</div>
                  <div className="space-y-2">
                    {group.options.map(opt => {
                      const locked = opt.pro && !canUsePro
                      const isPerFlightEligible = PER_FLIGHT_FORMAT_KEYS.has(opt.value)
                      const fmtScope = formatScope[opt.value] ?? 'flight'
                      const flightLetters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
                      return (
                        <div key={opt.value} className={locked ? 'opacity-50' : ''}>
                          <div className="flex items-center gap-2.5">
                            <input type="checkbox" checked={formats.has(opt.value)}
                              onChange={() => !locked && toggleFormat(opt.value)}
                              disabled={locked} className="accent-fairway-600 w-4 h-4 shrink-0 cursor-pointer" />
                            <span className={`text-sm text-gray-800 ${locked ? '' : 'cursor-pointer'}`} onClick={() => !locked && toggleFormat(opt.value)}>{opt.label}</span>
                            {locked && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Pro</span>}
                            {formats.has(opt.value) && !locked && (
                              <div className="ml-auto flex items-center gap-1.5 shrink-0">
                                <span className="text-xs text-gray-400">Places to pay:</span>
                                <select
                                  value={payoutPlaces[opt.value] ?? 1}
                                  onChange={e => setPayoutPlaces(prev => ({ ...prev, [opt.value]: Number(e.target.value) }))}
                                  className="text-xs border border-gray-300 rounded px-1.5 py-0.5 bg-white"
                                >
                                  {PLACES_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
                                </select>
                              </div>
                            )}
                          </div>
                          {formats.has(opt.value) && !locked && isPerFlightEligible && numFlights > 0 && (
                            <div className="ml-6 mt-1.5 flex gap-4">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" checked={fmtScope === 'group'}
                                  onChange={() => setFormatScope(prev => ({ ...prev, [opt.value]: 'group' }))}
                                  className="accent-fairway-600" />
                                <span className="text-xs text-gray-600">Whole group</span>
                              </label>
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="radio" checked={fmtScope === 'flight'}
                                  onChange={() => setFormatScope(prev => ({ ...prev, [opt.value]: 'flight' }))}
                                  className="accent-fairway-600" />
                                <span className="text-xs text-gray-600">Per flight ({flightLetters.join(', ')})</span>
                              </label>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
            {formats.size === 0 && <p className="text-xs text-red-500 mt-1">Select at least one format.</p>}
          </div>

          <div>
            <label className="label">Side Games / Competitions</label>
            <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
              {[...PER_FLIGHT_GAMES, ...GROUP_GAMES].map(opt => {
                const locked = opt.pro && !canUsePro
                const checked = sideGames.has(opt.key)
                const scope = gameScope[opt.key] ?? 'flight'
                const flightLetters = Array.from({ length: numFlights }, (_, i) => String.fromCharCode(65 + i))
                const isPerFlight = PER_FLIGHT_GAMES.some(g => g.key === opt.key)
                const buyIn = sideGameBuyIns[opt.key] ?? {}
                return (
                  <div key={opt.key} className={locked ? 'opacity-50' : ''}>
                    <label className="flex items-center gap-2.5 cursor-pointer">
                      <input type="checkbox" checked={checked}
                        onChange={() => !locked && toggleSideGame(opt.key)}
                        disabled={locked} className="accent-fairway-600 w-4 h-4" />
                      <span className="text-sm text-gray-800">{opt.label}</span>
                      {locked && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Pro</span>}
                    </label>
                    {checked && isPerFlight && numFlights > 0 && (
                      <div className="ml-6 mt-1.5 flex gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={scope === 'flight'}
                            onChange={() => setGameScope(prev => ({ ...prev, [opt.key]: 'flight' }))}
                            className="accent-fairway-600" />
                          <span className="text-xs text-gray-600">Per flight ({flightLetters.join(', ')})</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="radio" checked={scope === 'group'}
                            onChange={() => setGameScope(prev => ({ ...prev, [opt.key]: 'group' }))}
                            className="accent-fairway-600" />
                          <span className="text-xs text-gray-600">Whole group</span>
                        </label>
                      </div>
                    )}
                    {checked && (
                      <div className="ml-6 mt-1.5 flex items-center gap-3">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input type="checkbox" checked={buyIn.enabled ?? false} onChange={() => toggleBuyIn(opt.key)} className="accent-fairway-600 w-4 h-4" />
                          <span className="text-xs text-gray-600">Separate buy-in</span>
                        </label>
                        {buyIn.enabled && (
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">$</span>
                            <input
                              type="number" min="0" step="1"
                              value={buyIn.amount ?? ''}
                              onChange={e => setBuyInAmount(opt.key, e.target.value)}
                              placeholder="0"
                              className="w-16 border border-gray-300 rounded px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="mt-3">
              <div className="space-y-2">
                {customCompetitions.map((name, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={name}
                      onChange={e => setCustomCompetitions(prev => prev.map((c, j) => j === i ? e.target.value : c))}
                      placeholder="e.g. Bingo Bango Bongo"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                    <button type="button" onClick={() => setCustomCompetitions(prev => prev.filter((_, j) => j !== i))}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none">✕</button>
                  </div>
                ))}
              </div>
              <button type="button"
                onClick={() => setCustomCompetitions(prev => [...prev, ''])}
                className="mt-2 text-xs font-semibold text-green-700 hover:text-green-900">
                + Add Custom Competition
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Time" type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
            <Input label="Tee Interval (min)" type="number" min="1" max="60" value={interval} onChange={e => setInterval(e.target.value)} />
          </div>
          <Input label="Side Games / Competitions Entry Fee ($)" type="number" step="0.01" min="0" value={entryFee} onChange={e => setEntryFee(e.target.value)} required />
          <div>
            <label className="label">Payout Pot Based On</label>
            <div className="flex gap-4 mt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="payoutBasis" value="per_player" checked={payoutBasis === 'per_player'} onChange={() => setPayoutBasis('per_player')} className="accent-fairway-600" />
                <span className="text-sm text-gray-700">Attendance (entry fee × players)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="radio" name="payoutBasis" value="fixed" checked={payoutBasis === 'fixed'} onChange={() => setPayoutBasis('fixed')} className="accent-fairway-600" />
                <span className="text-sm text-gray-700">Fixed total</span>
              </label>
            </div>
            {payoutBasis === 'fixed' && (
              <Input className="mt-2" label="Fixed Pot Total ($)" type="number" step="0.01" min="0" value={payoutFixed} onChange={e => setPayoutFixed(e.target.value)} placeholder="e.g. 500" />
            )}
          </div>
          <Input label="Tournament Entry Fee ($)" type="number" step="0.01" min="0" value={tournamentFee} onChange={e => setTournamentFee(e.target.value)} placeholder="e.g. 25.00 (shown on registration page)" />

          <div className="space-y-3">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment Links (optional)</div>
            <div>
              <label className="label">Venmo Handle</label>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-green-600">
                <span className="px-3 text-gray-400 text-sm border-r border-gray-300 bg-gray-50 py-2">@</span>
                <input
                  type="text"
                  value={venmoHandle}
                  onChange={e => setVenmoHandle(e.target.value)}
                  placeholder="your-venmo-username"
                  className="flex-1 px-3 py-2 text-sm focus:outline-none bg-white"
                />
              </div>
            </div>
            <Input label="PayPal.me Link" value={paypalLink} onChange={e => setPaypalLink(e.target.value)} placeholder="https://paypal.me/yourhandle" />
            <div>
              <label className="label">Zelle (phone or email)</label>
              <input
                type="text"
                value={zelleHandle}
                onChange={e => setZelleHandle(e.target.value)}
                placeholder="555-555-5555 or name@email.com"
                className="input"
              />
            </div>
          </div>

          {/* Schedule of Events */}
          <div className="space-y-3 bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Schedule of Events <span className="normal-case text-gray-400 font-normal">(shown on event page and registration)</span></p>
            {scheduleItems.map((item, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={item.time ?? ''}
                    onChange={e => setScheduleItems(prev => prev.map((s, j) => j === i ? { ...s, time: e.target.value } : s))}
                    className="input w-28 shrink-0"
                  />
                  <input
                    type="text"
                    value={item.label}
                    onChange={e => setScheduleItems(prev => prev.map((s, j) => j === i ? { ...s, label: e.target.value } : s))}
                    placeholder="e.g. Check-in, Tee Time, Awards…"
                    className="input flex-1"
                  />
                  <button type="button" onClick={() => setScheduleItems(prev => prev.filter((_, j) => j !== i))}
                    className="text-gray-400 hover:text-red-500 text-sm shrink-0">✕</button>
                </div>
                <input
                  type="text"
                  value={item.description ?? ''}
                  onChange={e => setScheduleItems(prev => prev.map((s, j) => j === i ? { ...s, description: e.target.value } : s))}
                  placeholder="Description (optional)"
                  className="input text-sm"
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => setScheduleItems(prev => [...prev, { time: '', label: '', description: '' }])}
              className="text-xs text-fairway-700 font-semibold hover:underline mt-1"
            >
              + Add item
            </button>
          </div>

          {/* Custom Registration Questions */}
          <div className="space-y-2 bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Registration Questions <span className="normal-case text-gray-400 font-normal">(shown on registration form)</span></p>
            {customQuestions.map((q, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text"
                  value={q.label}
                  onChange={e => setCustomQuestions(prev => prev.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  placeholder="e.g. Interested in bringing a guest?"
                  className="input flex-1"
                />
                <label className="flex items-center gap-1 text-xs text-gray-500 shrink-0 cursor-pointer">
                  <input type="checkbox" checked={q.required}
                    onChange={e => setCustomQuestions(prev => prev.map((x, j) => j === i ? { ...x, required: e.target.checked } : x))}
                    className="accent-fairway-600" />
                  Required
                </label>
                <button type="button" onClick={() => setCustomQuestions(prev => prev.filter((_, j) => j !== i))}
                  className="text-gray-400 hover:text-red-500 text-sm shrink-0">✕</button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setCustomQuestions(prev => [...prev, { label: '', required: false }])}
              className="text-xs text-fairway-700 font-semibold hover:underline mt-1"
            >
              + Add item
            </button>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onDone}>Cancel</Button>
            <Button type="submit" loading={saving}>Create Event</Button>
          </div>
        </form>
      </div>
    </div>
  )
}
