/**
 * Mobile Scorecard Entry
 *
 * Flow:
 *  1. If eventId === 'me' → find the active event this user is scorekeeper for
 *  2. Load the event, course, and their group's players
 *  3. Hole-by-hole entry via tap-to-enter keypad inputs
 *  4. Net score shown live per player
 *  5. Saves optimistically; queues offline if no connection
 *  6. Traditional scorecard table view (available mid-round via Progress button)
 *  7. Score editing allowed even on completed events
 *  8. Guest access via sessionStorage (set by /join/:eventId)
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { getStrokesOnHole } from '../lib/engines/scoring'
import toast from 'react-hot-toast'

export default function Scorecard() {
  const { eventId } = useParams()
  const { user, profile, loading: authLoading, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const homeLink = isAdmin ? '/admin' : '/home'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }
  const { saveScore, pendingCount, syncing } = useOfflineQueue()

  const [event,         setEvent]         = useState(null)
  const [course,        setCourse]        = useState(null)
  const [groupPlayers,  setGroupPlayers]  = useState([])
  const [scores,        setScores]        = useState({})
  const [currentHole,   setCurrentHole]   = useState(1)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [saving,        setSaving]        = useState(false)
  const [dirtyHoles,    setDirtyHoles]    = useState(new Set())
  const [showScorecard, setShowScorecard] = useState(false)
  const [isComplete,    setIsComplete]    = useState(false)
  const [canEdit,       setCanEdit]       = useState(false)
  // Guest code entry state (shown when not logged in and no valid session)
  const [needsCode,     setNeedsCode]     = useState(false)
  const [codeEventId,   setCodeEventId]   = useState(null)
  const [loadTrigger,   setLoadTrigger]   = useState(0)

  useEffect(() => {
    // Wait for auth to resolve before loading
    if (authLoading || profile === undefined) return

    async function load() {
      let evId = eventId
      let guestGroupNum = null

      // Guest access: check sessionStorage for a valid guest session
      if (!user) {
        const rawGuest = sessionStorage.getItem('guestSession')
        const guest = rawGuest ? JSON.parse(rawGuest) : null
        if (guest?.eventId === evId && guest?.groupNum != null) {
          guestGroupNum = guest.groupNum
        } else {
          // No valid session — show inline code entry
          setCodeEventId(evId)
          setNeedsCode(true)
          setLoading(false)
          return
        }
      }

      if (evId === 'me') {
        const { data: ep } = await supabase
          .from('event_players')
          .select('event_id, event:events(id, status)')
          .eq('is_scorekeeper', true)
          .eq('player_id', profile?.player_id)
          .in('event.status', ['active'])
          .limit(1)
          .single()

        if (!ep) {
          setError("You're not assigned as scorekeeper for any active event.")
          setLoading(false)
          return
        }
        evId = ep.event_id
      }

      const { data: ev } = await supabase
        .from('events')
        .select('*, course:courses(*), league:leagues(name)')
        .eq('id', evId)
        .single()

      if (!ev) { setError('Event not found.'); setLoading(false); return }

      // Verify guest group code
      if (guestGroupNum != null) {
        const rawGuest = sessionStorage.getItem('guestSession')
        const guest = rawGuest ? JSON.parse(rawGuest) : null
        const groupCodes = ev.group_codes ?? {}
        const expectedCode = groupCodes[String(guestGroupNum)]
        if (!expectedCode || expectedCode !== guest?.accessCode) {
          sessionStorage.removeItem('guestSession')
          setCodeEventId(evId)
          setNeedsCode(true)
          setLoading(false)
          return
        }
      }

      setEvent(ev)
      setCourse(ev.course)
      setIsComplete(ev.status === 'complete')

      // Find this user's player record (by profile.player_id or email fallback)
      let myPlayerId = profile?.player_id ?? null
      if (!myPlayerId && user?.email) {
        const { data: pByEmail } = await supabase
          .from('players').select('id').eq('email', user.email).maybeSingle()
        myPlayerId = pByEmail?.id ?? null
      }

      // Find this user's group and scorekeeper status
      let groupNum = guestGroupNum  // guests already have their group from sessionStorage
      let userIsScorekeeper = guestGroupNum != null  // guests are assumed scorekeepers

      if (!guestGroupNum && myPlayerId) {
        const { data: myEp } = await supabase
          .from('event_players')
          .select('group_number, is_scorekeeper')
          .eq('event_id', evId)
          .eq('player_id', myPlayerId)
          .maybeSingle()
        groupNum          = myEp?.group_number ?? null
        userIsScorekeeper = myEp?.is_scorekeeper ?? false
      }

      // Admins can always edit; others must be the assigned scorekeeper or guest
      const editAllowed = isAdmin || userIsScorekeeper
      setCanEdit(editAllowed)

      const eventComplete = ev.status === 'complete'

      // Group scoping:
      // - If assigned to a group AND event is not complete → only see that group (even admins)
      // - If admin AND event is complete (or no group) → see all players
      // - If not admin and no group → only see own player row
      const query = supabase
        .from('event_players')
        .select('*, player:players(*)')
        .eq('event_id', evId)

      if (groupNum && !eventComplete) {
        query.eq('group_number', groupNum)
      } else if (!isAdmin && !groupNum && myPlayerId) {
        query.eq('player_id', myPlayerId)
      }

      const { data: eps } = await query.order('flight').order('adjusted_handicap_index')
      setGroupPlayers(eps ?? [])

      const playerIds = (eps ?? []).map(ep => ep.player_id)
      if (playerIds.length > 0) {
        const { data: existing } = await supabase
          .from('scores')
          .select('*')
          .eq('event_id', evId)
          .in('player_id', playerIds)

        const map = {}
        for (const s of (existing ?? [])) {
          if (!map[s.player_id]) map[s.player_id] = {}
          map[s.player_id][s.hole_number] = { gross: s.gross_score, putts: s.putts ?? '' }
        }
        setScores(map)

        const lastComplete = Math.max(0,
          ...playerIds.flatMap(pid => Object.keys(map[pid] ?? {}).map(Number))
        )
        setCurrentHole(Math.min(18, lastComplete + 1))

        const allDone = playerIds.every(pid => Object.keys(map[pid] ?? {}).length === 18)
        if (allDone || ev.status === 'complete') setShowScorecard(true)
      }

      setLoading(false)
    }

    load()
  }, [eventId, user, profile, authLoading, isAdmin, loadTrigger])

  function getScore(playerId, hole) {
    return scores[playerId]?.[hole] ?? { gross: '', putts: '' }
  }

  function updateScore(playerId, hole, field, value) {
    setDirtyHoles(prev => new Set([...prev, hole]))
    setScores(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {}),
        [hole]: { ...getScore(playerId, hole), [field]: value },
      },
    }))
  }

  // Check if every player has a saved score for the given hole
  function holeSaved(hole) {
    return groupPlayers.length > 0 &&
      groupPlayers.every(ep => {
        const sc = scores[ep.player_id]?.[hole]
        return sc && sc.gross !== '' && sc.gross != null
      })
  }

  const saveHole = useCallback(async () => {
    if (!event || !course) return
    setSaving(true)

    let allValid = true

    for (const ep of groupPlayers) {
      const sc = getScore(ep.player_id, currentHole)
      // Default: treat empty gross as 1
      const gross = sc.gross === '' ? 1 : parseInt(sc.gross, 10)
      if (!gross || gross < 1) { allValid = false; continue }

      const putts = sc.putts !== '' ? parseInt(sc.putts, 10) : null

      const result = await saveScore({
        event_id:    event.id,
        player_id:   ep.player_id,
        hole_number: currentHole,
        gross_score: gross,
        putts,
      })

      if (result?.error) {
        toast.error(`Save failed: ${result.error}`)
        allValid = false
      } else if (result?.queued) {
        toast('Saved offline — will sync when connected', { icon: '📶', duration: 2000 })
      }
    }

    // Clear dirty state for this hole
    setDirtyHoles(prev => { const n = new Set(prev); n.delete(currentHole); return n })

    setSaving(false)

    if (allValid && currentHole < 18) {
      setCurrentHole(h => h + 1)
    } else if (currentHole === 18) {
      toast.success('Round complete! All 18 holes saved.')
      setShowScorecard(true)
    }
  }, [event, course, currentHole, groupPlayers, scores, saveScore])

  function handleHoleNav(targetHole) {
    if (dirtyHoles.has(currentHole)) {
      if (!confirm(`Hole ${currentHole} has unsaved scores. Save before moving on?`)) return
      saveHole()
      return
    }
    setCurrentHole(targetHole)
  }

  if (loading) return <ScorecardSkeleton />

  if (needsCode) {
    return (
      <GuestCodeEntry
        eventId={codeEventId}
        onSuccess={(groupNum, code) => {
          sessionStorage.setItem('guestSession', JSON.stringify({ eventId: codeEventId, groupNum, accessCode: code }))
          setNeedsCode(false)
          setLoading(true)
          setLoadTrigger(t => t + 1)
        }}
      />
    )
  }

  if (error) return (
    <div className="min-h-screen bg-fairway-800 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4">⛳</div>
      <p className="text-white font-semibold text-lg">{error}</p>
      <Link to="/login" className="mt-6 bg-white/10 hover:bg-white/20 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
        Sign In
      </Link>
    </div>
  )

  if (!event || !course) return null

  const hole       = currentHole
  const par        = course.par_per_hole[hole - 1]
  const si         = course.stroke_index[hole - 1]
  const yd         = course.yardage?.[hole - 1] ?? '—'
  const trackPutts = !event.side_game_options?.length || event.side_game_options.includes('track_putts')
  const holesEntered = groupPlayers.length > 0
    ? Math.max(0, ...groupPlayers.map(ep => Object.keys(scores[ep.player_id] ?? {}).length))
    : 0
  const isDirty = dirtyHoles.has(currentHole)

  if (showScorecard) {
    return (
      <TraditionalScorecard
        event={event}
        course={course}
        groupPlayers={groupPlayers}
        scores={scores}
        isComplete={isComplete}
        canEdit={canEdit}
        onEdit={() => setShowScorecard(false)}
        homeLink={homeLink}
        onSignOut={user ? handleSignOut : null}
      />
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-fairway-700 text-white sticky top-0 z-20 shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold text-base leading-tight">{event.course?.name ?? course.name}</div>
            <div className="text-xs text-fairway-200 mt-0.5">
              {event.league?.name} · Event #{event.event_number}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1 bg-yellow-500/20 rounded-full px-2.5 py-1">
                <div className={`w-1.5 h-1.5 rounded-full ${syncing ? 'bg-yellow-300 animate-pulse' : 'bg-yellow-400'}`} />
                <span className="text-xs text-yellow-200">{pendingCount} pending</span>
              </div>
            )}
            {holesEntered > 0 && (
              <button
                onClick={() => setShowScorecard(true)}
                className="text-fairway-200 text-xs hover:text-white border border-fairway-500 rounded px-2 py-1"
              >
                {holesEntered === 18 ? 'Scorecard' : `Progress (${holesEntered})`}
              </button>
            )}
            <Link
              to={`/leaderboard/${event.id}`}
              state={{ from: 'scorecard', scorecardEventId: event.id }}
              className="text-fairway-200 text-xs hover:text-white border border-fairway-500 rounded px-2 py-1"
            >
              Board
            </Link>
            {homeLink && <Link to={homeLink} className="text-fairway-200 text-xs hover:text-white">⛳</Link>}
            {user && (
              <button onClick={handleSignOut} className="text-fairway-200 text-xs hover:text-white border border-fairway-500 rounded px-2 py-1">
                Sign out
              </button>
            )}
          </div>
        </div>

        {isComplete && (
          <div className="px-4 py-2 bg-yellow-600/80 text-yellow-100 text-xs text-center font-medium">
            Event is complete — editing scores will update official results
          </div>
        )}
        {!canEdit && !isComplete && (
          <div className="px-4 py-2 bg-gray-800/80 text-gray-200 text-xs text-center font-medium">
            View only — you are not the assigned scorekeeper for this group
          </div>
        )}

        {/* Hole navigator */}
        <div className="px-4 pb-3 flex gap-1 overflow-x-auto scrollbar-hide">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
            const saved   = holeSaved(h)
            const dirty   = dirtyHoles.has(h)
            const current = h === hole
            return (
              <button
                key={h}
                onClick={() => handleHoleNav(h)}
                className={`shrink-0 w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  current ? 'bg-white text-fairway-700 shadow-lg scale-110'
                  : dirty  ? 'bg-yellow-400 text-yellow-900'
                  : saved  ? 'bg-fairway-500 text-white'
                  :          'bg-fairway-800 text-fairway-400'
                }`}
              >
                {h}
              </button>
            )
          })}
        </div>
      </div>

      {/* Hole info bar */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-6">
        <div className="text-center">
          <div className="text-2xl font-black text-fairway-700">{hole < 10 ? `0${hole}` : hole}</div>
          <div className="text-xs text-gray-400 font-medium">HOLE</div>
        </div>
        <div className="w-px h-10 bg-gray-200" />
        <div className="text-center">
          <div className="text-xl font-bold text-gray-800">{par}</div>
          <div className="text-xs text-gray-400">PAR</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-gray-800">{yd}</div>
          <div className="text-xs text-gray-400">YDS</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-gray-800">{si}</div>
          <div className="text-xs text-gray-400">S.I.</div>
        </div>
        <div className="ml-auto text-xs text-gray-400">{holesEntered}/18 done</div>
      </div>

      {/* Player score cards */}
      <div className="flex-1 p-4 space-y-3 pb-28">
        {groupPlayers.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No players assigned to your group yet.</p>
            <p className="text-sm mt-1">Contact your admin.</p>
          </div>
        )}
        {groupPlayers.map(ep => (
          <PlayerScoreCard
            key={ep.player_id}
            ep={ep}
            hole={hole}
            par={par}
            si={si}
            score={getScore(ep.player_id, hole)}
            allHoleScores={scores[ep.player_id] ?? {}}
            courseStrokeIndexes={course.stroke_index}
            trackPutts={trackPutts}
            onChange={(field, val) => updateScore(ep.player_id, hole, field, val)}
          />
        ))}
      </div>

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-bottom">
        {isDirty && (
          <p className="text-center text-xs text-yellow-600 font-medium mb-2">
            ⚠ Unsaved scores on this hole — save before continuing
          </p>
        )}
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            disabled={hole <= 1}
            onClick={() => handleHoleNav(Math.max(1, hole - 1))}
            className="flex-none w-12 h-12 rounded-full border-2 border-gray-200 text-gray-600 font-bold disabled:opacity-30 hover:border-gray-300 active:scale-95 transition-all"
          >
            ←
          </button>
          <button
            onClick={saveHole}
            disabled={saving || !canEdit}
            className="flex-1 h-12 bg-fairway-700 text-white font-bold rounded-xl disabled:opacity-50 hover:bg-fairway-800 active:scale-95 transition-all shadow-lg shadow-fairway-700/30"
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </span>
            ) : (
              hole === 18 ? 'Save Hole 18 · Finish Round' : `Save Hole ${hole} · Next →`
            )}
          </button>
          <button
            disabled={hole >= 18}
            onClick={() => handleHoleNav(Math.min(18, hole + 1))}
            className="flex-none w-12 h-12 rounded-full border-2 border-gray-200 text-gray-600 font-bold disabled:opacity-30 hover:border-gray-300 active:scale-95 transition-all"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Player Score Card ─────────────────────────────────────────────
function PlayerScoreCard({ ep, hole, par, si, score, allHoleScores, courseStrokeIndexes, trackPutts, onChange }) {
  const grossRef = useRef(null)
  const puttsRef = useRef(null)

  const ch      = ep.course_handicap ?? 0
  const strokes = getStrokesOnHole(ch, si)

  // Running total across all saved holes
  let totalGross = 0, totalNetVsPar = 0, holesPlayed = 0
  for (let h = 1; h <= 18; h++) {
    const sc = allHoleScores[h]
    if (sc && sc.gross !== '' && sc.gross != null) {
      const g = parseInt(sc.gross, 10)
      const hSI = courseStrokeIndexes[h - 1]
      const hStrokes = getStrokesOnHole(ch, hSI)
      totalGross += g
      // par for this hole isn't passed in here, but we can approximate via netVsPar
      // We'll just track gross for the summary display
      holesPlayed++
    }
  }

  // Net for current hole
  const grossVal = score.gross !== '' && score.gross != null ? parseInt(score.gross, 10) : null
  const net = grossVal != null && !isNaN(grossVal) ? grossVal - strokes : null
  const netVsPar = net != null ? net - par : null
  const netColor = netVsPar == null ? 'text-gray-300'
    : netVsPar <= -2 ? 'text-yellow-600 font-black'
    : netVsPar === -1 ? 'text-red-600'
    : netVsPar === 0  ? 'text-gray-700'
    : netVsPar === 1  ? 'text-blue-600'
    : 'text-blue-800'

  const grossDisplay = score.gross !== '' && score.gross != null ? String(score.gross) : ''
  const puttsDisplay = score.putts !== '' && score.putts != null ? String(score.putts) : ''

  // Running score summary text
  const runningLabel = holesPlayed > 0
    ? `${holesPlayed} hole${holesPlayed !== 1 ? 's' : ''} · Gross ${totalGross}`
    : 'No holes entered'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Player header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-900">
              {ep.player?.first_name} {ep.player?.last_name}
            </span>
            {ep.flight && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${ep.flight === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {ep.flight}
              </span>
            )}
            {strokes > 0 && (
              <span className="inline-flex items-center bg-fairway-100 text-fairway-800 text-xs font-bold px-1.5 py-0.5 rounded-full" title={`Receives ${strokes} stroke${strokes > 1 ? 's' : ''}`}>
                {'●'.repeat(Math.min(strokes, 3))} {strokes} stroke{strokes > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{runningLabel}</div>
        </div>

        {/* Score input — large tap target */}
        <div className="flex items-center gap-3">
          {net != null && (
            <div className="text-right">
              <div className="text-xs text-gray-400 leading-none mb-0.5">Net</div>
              <div className={`text-xl font-black leading-none ${netColor}`}>
                {netVsPar === 0 ? 'E' : `${netVsPar > 0 ? '+' : ''}${netVsPar}`}
              </div>
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Score</span>
            <input
              ref={grossRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={grossDisplay}
              onChange={e => onChange('gross', e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
              onFocus={e => e.target.select()}
              placeholder="—"
              min={1}
              max={20}
              className="w-16 h-16 text-center text-3xl font-black border-2 border-fairway-700 rounded-xl focus:border-fairway-500 focus:ring-2 focus:ring-fairway-200 outline-none bg-white"
              style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
            />
          </div>
        </div>
      </div>

      {/* Putts row */}
      {trackPutts && (
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-100">
          <span className="text-xs text-gray-500 font-medium">Putts on this hole</span>
          <input
            ref={puttsRef}
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={puttsDisplay}
            onChange={e => onChange('putts', e.target.value === '' ? '' : parseInt(e.target.value, 10) || '')}
            onFocus={e => e.target.select()}
            placeholder="0"
            min={0}
            max={10}
            className="w-14 h-11 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-fairway-500 focus:ring-2 focus:ring-fairway-200 outline-none bg-white"
            style={{ WebkitAppearance: 'none', MozAppearance: 'textfield' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Traditional Scorecard View ────────────────────────────────────
function TraditionalScorecard({ event, course, groupPlayers, scores, isComplete, canEdit, onEdit, homeLink, onSignOut }) {
  const pars  = course.par_per_hole  // array[18]
  const front = pars.slice(0, 9)
  const back  = pars.slice(9, 18)
  const frontPar = front.reduce((a, b) => a + b, 0)
  const backPar  = back.reduce((a, b) => a + b, 0)
  const totalPar = frontPar + backPar

  function playerRow(ep) {
    const ch = ep.course_handicap ?? 0
    const name = `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`
    let frontGross = 0, backGross = 0, frontNet = 0, backNet = 0

    const cells = Array.from({ length: 18 }, (_, i) => {
      const h = i + 1
      const sc = scores[ep.player_id]?.[h]
      const g = sc ? parseInt(sc.gross, 10) : null
      const si = course.stroke_index[i]
      const strokes = getStrokesOnHole(ch, si)
      const net = g != null ? g - strokes : null
      const p = pars[i]

      if (g != null) {
        if (i < 9) { frontGross += g; frontNet += (net ?? g) }
        else        { backGross  += g; backNet  += (net ?? g) }
      }

      const netVsPar = net != null ? net - p : null
      let cellClass = 'text-center text-xs font-bold px-1 py-1.5 '
      if (netVsPar != null) {
        if (netVsPar <= -2) cellClass += 'bg-yellow-100 text-yellow-800'          // eagle+
        else if (netVsPar === -1) cellClass += 'bg-red-100 text-red-700'           // birdie
        else if (netVsPar === 0)  cellClass += 'text-gray-700'                     // par
        else if (netVsPar === 1)  cellClass += 'bg-blue-50 text-blue-700'          // bogey
        else                      cellClass += 'bg-blue-100 text-blue-900'         // double+
      } else {
        cellClass += 'text-gray-300'
      }

      return { g, net, cellClass }
    })

    const totalGross = frontGross + backGross
    const totalNet   = frontNet + backNet

    return { name, ep, cells, frontGross, backGross, totalGross, frontNet, backNet, totalNet }
  }

  const rows = groupPlayers.map(playerRow)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-fairway-700 text-white sticky top-0 z-20 shadow-lg">
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold text-base">{event.course?.name ?? course.name}</div>
            <div className="text-xs text-fairway-200">{event.league?.name} · Event #{event.event_number}</div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to={`/leaderboard/${event.id}`}
              state={{ from: 'scorecard', scorecardEventId: event.id }}
              className="text-fairway-200 text-xs hover:text-white border border-fairway-500 rounded px-2 py-1"
            >
              Board
            </Link>
            {homeLink && <Link to={homeLink} className="text-fairway-200 text-xs hover:text-white">⛳</Link>}
            {onSignOut && (
              <button onClick={onSignOut} className="text-fairway-200 text-xs hover:text-white border border-fairway-500 rounded px-2 py-1">
                Sign out
              </button>
            )}
          </div>
        </div>
        <div className="px-4 pb-3 flex gap-2">
          <button
            onClick={onEdit}
            className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            ← {isComplete ? 'Edit Scores' : 'Back to Entry'}
          </button>
        </div>
      </div>

      {/* Scorecard table — horizontal scroll */}
      <div className="overflow-x-auto p-4">
        <table className="w-full text-xs border-collapse min-w-[700px]">
          {/* Front nine */}
          <thead>
            <tr className="bg-fairway-700 text-white">
              <th className="text-left px-3 py-2 font-semibold w-28">Player</th>
              {[1,2,3,4,5,6,7,8,9].map(h => (
                <th key={h} className="text-center px-1 py-2 w-8">{h}</th>
              ))}
              <th className="text-center px-2 py-2 font-bold bg-fairway-800 w-10">OUT</th>
              {[10,11,12,13,14,15,16,17,18].map(h => (
                <th key={h} className="text-center px-1 py-2 w-8">{h}</th>
              ))}
              <th className="text-center px-2 py-2 font-bold bg-fairway-800 w-10">IN</th>
              <th className="text-center px-2 py-2 font-bold bg-fairway-900 w-10">TOT</th>
            </tr>
            {/* Par row */}
            <tr className="bg-gray-100 text-gray-600 font-semibold">
              <td className="px-3 py-1.5 text-xs">Par</td>
              {pars.slice(0, 9).map((p, i) => (
                <td key={i} className="text-center px-1 py-1.5">{p}</td>
              ))}
              <td className="text-center px-2 py-1.5 bg-gray-200 font-bold">{frontPar}</td>
              {pars.slice(9, 18).map((p, i) => (
                <td key={i} className="text-center px-1 py-1.5">{p}</td>
              ))}
              <td className="text-center px-2 py-1.5 bg-gray-200 font-bold">{backPar}</td>
              <td className="text-center px-2 py-1.5 bg-gray-300 font-bold">{totalPar}</td>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, ep, cells, frontGross, backGross, totalGross, frontNet, backNet, totalNet }) => (
              <>
                {/* Gross row */}
                <tr key={`${ep.player_id}-gross`} className="border-t border-gray-200 bg-white hover:bg-gray-50">
                  <td className="px-3 py-1.5 font-semibold text-gray-900 whitespace-nowrap">
                    {name}
                    {ep.flight && (
                      <span className={`ml-1 text-xs font-bold ${ep.flight === 'A' ? 'text-blue-600' : 'text-purple-600'}`}>
                        ({ep.flight})
                      </span>
                    )}
                  </td>
                  {cells.slice(0, 9).map((c, i) => (
                    <td key={i} className={c.cellClass}>{c.g ?? '—'}</td>
                  ))}
                  <td className="text-center px-2 py-1.5 bg-gray-100 font-bold text-gray-800">
                    {frontGross || '—'}
                  </td>
                  {cells.slice(9, 18).map((c, i) => (
                    <td key={i} className={c.cellClass}>{c.g ?? '—'}</td>
                  ))}
                  <td className="text-center px-2 py-1.5 bg-gray-100 font-bold text-gray-800">
                    {backGross || '—'}
                  </td>
                  <td className="text-center px-2 py-1.5 bg-gray-200 font-bold text-gray-900">
                    {totalGross || '—'}
                  </td>
                </tr>
                {/* Net row */}
                <tr key={`${ep.player_id}-net`} className="bg-fairway-50">
                  <td className="px-3 py-1 text-gray-400 text-xs italic">Net (CH:{ep.course_handicap ?? 0})</td>
                  {cells.slice(0, 9).map((c, i) => (
                    <td key={i} className="text-center px-1 py-1 text-xs text-fairway-700 font-medium">
                      {c.net ?? '—'}
                    </td>
                  ))}
                  <td className="text-center px-2 py-1 bg-fairway-100 font-bold text-fairway-800 text-xs">
                    {frontNet || '—'}
                  </td>
                  {cells.slice(9, 18).map((c, i) => (
                    <td key={i} className="text-center px-1 py-1 text-xs text-fairway-700 font-medium">
                      {c.net ?? '—'}
                    </td>
                  ))}
                  <td className="text-center px-2 py-1 bg-fairway-100 font-bold text-fairway-800 text-xs">
                    {backNet || '—'}
                  </td>
                  <td className="text-center px-2 py-1 bg-fairway-200 font-bold text-fairway-900 text-xs">
                    {totalNet || '—'}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
        </table>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><span className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold">Eagle+</span></span>
          <span className="flex items-center gap-1"><span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">Birdie</span></span>
          <span className="flex items-center gap-1"><span className="text-gray-700 px-1.5 py-0.5 rounded font-bold border border-gray-200">Par</span></span>
          <span className="flex items-center gap-1"><span className="bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded font-bold">Bogey</span></span>
          <span className="flex items-center gap-1"><span className="bg-blue-100 text-blue-900 px-1.5 py-0.5 rounded font-bold">Double+</span></span>
          <span className="text-gray-400 ml-2">Colors based on net score vs par</span>
        </div>
      </div>
    </div>
  )
}

// ─── Guest Code Entry ──────────────────────────────────────────────
function GuestCodeEntry({ eventId, onSuccess }) {
  const [eventInfo,    setEventInfo]    = useState(null)
  const [groupPlayers, setGroupPlayers] = useState(null)  // null = not yet loaded
  const [matchedGroup, setMatchedGroup] = useState(null)
  const [matchedCode,  setMatchedCode]  = useState('')
  const [code,         setCode]         = useState('')
  const [error,        setError]        = useState('')
  const [checking,     setChecking]     = useState(false)
  const [selectedName, setSelectedName] = useState(null)

  useEffect(() => {
    supabase.from('events')
      .select('id, name, event_number, group_codes, course:courses(name), league:leagues(name)')
      .eq('id', eventId)
      .single()
      .then(({ data }) => setEventInfo(data))
  }, [eventId])

  async function handleCodeSubmit(e) {
    e.preventDefault()
    if (!code.trim()) return
    setChecking(true)
    setError('')

    const trimmed = code.trim().toUpperCase()
    const groupCodes = eventInfo?.group_codes ?? {}
    const match = Object.entries(groupCodes).find(([, c]) => c?.toUpperCase() === trimmed)

    if (!match) {
      setError('Code not recognized. Check with your group leader and try again.')
      setChecking(false)
      return
    }

    const groupNum = parseInt(match[0], 10)

    // Load players in this group
    const { data: eps } = await supabase
      .from('event_players')
      .select('player_id, player:players(first_name, last_name)')
      .eq('event_id', eventId)
      .eq('group_number', groupNum)
      .order('player(last_name)')

    setGroupPlayers(eps ?? [])
    setMatchedGroup(groupNum)
    setMatchedCode(trimmed)
    setChecking(false)
  }

  function handleConfirm() {
    onSuccess(matchedGroup, matchedCode)
  }

  const eventLabel = eventInfo?.name ?? (eventInfo ? `Event #${eventInfo.event_number}` : '…')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Mulligan's Island Golf Club" className="w-20 h-20 rounded-full object-cover mx-auto mb-3 shadow-xl" />
          <h1 className="text-white font-bold text-xl" style={{ fontFamily: "'Playfair Display', serif" }}>{eventLabel}</h1>
          {eventInfo && <p className="text-white/50 text-sm mt-0.5">{eventInfo.course?.name}</p>}
          <div className="mx-auto mt-2" style={{ width: 40, height: 2, background: '#D4AF37' }} />
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          {groupPlayers === null ? (
            /* Step 1 — enter code */
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">Enter Group Code</h2>
              <p className="text-sm text-gray-500 mb-5 text-center">Your group leader has a code to access scoring.</p>
              <form onSubmit={handleCodeSubmit} className="space-y-4">
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="· · · · ·"
                  maxLength={8}
                  autoFocus
                  autoCapitalize="characters"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full text-center text-3xl font-black tracking-[0.4em] border-2 border-gray-200 rounded-xl px-4 py-4 focus:border-fairway-600 focus:outline-none uppercase"
                />
                {error && <p className="text-sm text-red-600 text-center">{error}</p>}
                <button
                  type="submit"
                  disabled={checking || !code.trim()}
                  className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-colors disabled:opacity-50"
                  style={{ background: '#1B4332' }}
                >
                  {checking ? 'Checking…' : 'Continue'}
                </button>
              </form>
            </>
          ) : (
            /* Step 2 — confirm who you are */
            <>
              <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">Who are you?</h2>
              <p className="text-sm text-gray-500 mb-4 text-center">Group {matchedGroup} · Tap your name</p>
              <div className="space-y-2 mb-4">
                {groupPlayers.map(ep => {
                  const name = `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim()
                  return (
                    <button
                      key={ep.player_id}
                      onClick={() => setSelectedName(name)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 font-semibold transition-all ${
                        selectedName === name
                          ? 'border-fairway-700 bg-fairway-50 text-fairway-900'
                          : 'border-gray-200 text-gray-800 hover:border-gray-300'
                      }`}
                    >
                      {name}
                    </button>
                  )
                })}
                {groupPlayers.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-3">No players in this group yet.</p>
                )}
              </div>
              <button
                onClick={handleConfirm}
                disabled={!selectedName && groupPlayers.length > 0}
                className="w-full py-3.5 rounded-xl font-bold text-white text-base transition-colors disabled:opacity-50"
                style={{ background: '#1B4332' }}
              >
                Enter Scoring →
              </button>
              <button
                onClick={() => { setGroupPlayers(null); setMatchedGroup(null); setCode('') }}
                className="w-full mt-2 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Wrong code?
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-5 text-white/40">
          Have an account? <a href="/login" className="underline text-white/60">Sign in</a>
        </p>
      </div>
    </div>
  )
}

function ScorecardSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-24 bg-fairway-700 animate-pulse" />
      <div className="h-16 bg-white border-b animate-pulse" />
      <div className="p-4 space-y-3">
        {[0,1,2,3].map(i => <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />)}
      </div>
    </div>
  )
}
