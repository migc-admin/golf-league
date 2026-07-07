/**
 * ScorecardJoin — public page for joining a scorecard group via access code.
 * No login required. Stores guest session in sessionStorage, then redirects
 * to /scorecard/:eventId where the Scorecard page reads the session.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ScorecardJoin() {
  const { eventId } = useParams()
  const navigate = useNavigate()

  const [event,       setEvent]       = useState(null)
  const [groups,      setGroups]      = useState([])
  const [code,        setCode]        = useState('')
  const [codeValid,   setCodeValid]   = useState(false)
  const [codeError,   setCodeError]   = useState('')
  const [selectedGrp, setSelectedGrp] = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [checking,    setChecking]    = useState(false)

  useEffect(() => {
    async function load() {
      const { data: ev } = await supabase
        .from('events')
        .select('id, name, event_number, status, course:courses(name), league:leagues(name)')
        .eq('id', eventId)
        .single()
      setEvent(ev ?? null)
      setLoading(false)
    }
    load()
  }, [eventId])

  async function handleVerifyCode(e) {
    e.preventDefault()
    if (!code.trim()) return
    setChecking(true)
    setCodeError('')

    const { data: ev } = await supabase
      .from('events')
      .select('access_code')
      .eq('id', eventId)
      .single()

    if (!ev?.access_code) {
      setCodeError('This event does not have an access code set. Contact your admin.')
      setChecking(false)
      return
    }

    if (ev.access_code.trim().toLowerCase() !== code.trim().toLowerCase()) {
      setCodeError('Incorrect access code. Try again.')
      setChecking(false)
      return
    }

    // Code valid — load groups
    const { data: eps } = await supabase
      .from('event_players')
      .select('group_number, player:players(first_name, last_name)')
      .eq('event_id', eventId)
      .not('group_number', 'is', null)
      .order('group_number')

    // Group by group_number
    const grpMap = {}
    for (const ep of eps ?? []) {
      const g = ep.group_number
      if (!grpMap[g]) grpMap[g] = []
      grpMap[g].push(`${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim())
    }
    const grpList = Object.entries(grpMap).map(([num, players]) => ({ num: parseInt(num), players }))
    grpList.sort((a, b) => a.num - b.num)

    setGroups(grpList)
    setCodeValid(true)
    setChecking(false)
  }

  function handleJoin() {
    if (!selectedGrp) return
    sessionStorage.setItem('guestSession', JSON.stringify({
      eventId,
      groupNum: selectedGrp,
      accessCode: code.trim(),
    }))
    navigate(`/scorecard/${eventId}`)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
        <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
        <p className="text-white text-lg font-semibold">Event not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo + title */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Club Logo" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 shadow-xl" />
          <h1 className="text-white font-bold text-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            {event.name ?? `Event #${event.event_number}`}
          </h1>
          <p className="text-white/60 text-sm mt-1">{event.course?.name} · {event.league?.name}</p>
          <div className="mx-auto mt-2" style={{ width: 48, height: 2, background: '#D4AF37' }} />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {!codeValid ? (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Enter Access Code</h2>
              <p className="text-sm text-gray-500 mb-4">Your group leader has a code to join the scorecard.</p>
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="ACCESS CODE"
                  className="w-full text-center text-2xl font-bold tracking-widest border-2 border-gray-200 rounded-xl px-4 py-3 focus:border-fairway-600 focus:outline-none uppercase"
                  autoFocus
                  autoCapitalize="characters"
                />
                {codeError && (
                  <p className="text-sm text-red-600 text-center">{codeError}</p>
                )}
                <button
                  type="submit"
                  disabled={checking || !code.trim()}
                  className="w-full py-3 rounded-xl font-bold text-white transition-colors disabled:opacity-50"
                  style={{ background: '#1B4332' }}
                >
                  {checking ? 'Checking…' : 'Continue'}
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1">Select Your Group</h2>
              <p className="text-sm text-gray-500 mb-4">Choose the group you are scoring for.</p>
              <div className="space-y-2 mb-4">
                {groups.map(grp => (
                  <button
                    key={grp.num}
                    onClick={() => setSelectedGrp(grp.num)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      selectedGrp === grp.num
                        ? 'border-fairway-700 bg-fairway-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-semibold text-gray-900">Group {grp.num}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{grp.players.join(', ')}</div>
                  </button>
                ))}
                {groups.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">
                    No groups assigned yet. Contact your admin.
                  </p>
                )}
              </div>
              <button
                onClick={handleJoin}
                disabled={!selectedGrp}
                className="w-full py-3 rounded-xl font-bold text-white transition-colors disabled:opacity-50"
                style={{ background: '#1B4332' }}
              >
                Enter Scores →
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-5 text-white/40">
          Already have a login? <a href="/login" className="underline text-white/60">Sign in</a>
        </p>
      </div>
    </div>
  )
}
