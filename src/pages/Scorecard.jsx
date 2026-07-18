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

// Guest session helpers — use localStorage with 12-hour TTL (Safari iOS clears sessionStorage on tab suspend)
const GUEST_KEY = 'golf_guest_session'
function readGuestSession() {
  try {
    const raw = localStorage.getItem(GUEST_KEY)
    if (!raw) return null
    const obj = JSON.parse(raw)
    if (obj._expires && Date.now() > obj._expires) { localStorage.removeItem(GUEST_KEY); return null }
    return obj
  } catch { return null }
}
function writeGuestSession(data) {
  localStorage.setItem(GUEST_KEY, JSON.stringify({ ...data, _expires: Date.now() + 12 * 60 * 60 * 1000 }))
}
function clearGuestSession() { localStorage.removeItem(GUEST_KEY) }

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { getStrokesOnHole } from '../lib/engines/scoring'
import toast from 'react-hot-toast'

export default function Scorecard() {
  const { orgSlug, leagueSlug, eventSlug } = useParams()
  const [searchParams] = useSearchParams()
  const directEventId = searchParams.get('eid')   // guests bypass slug lookup via ?eid=UUID
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
  const [enteredBy,     setEnteredBy]     = useState(null)   // name/email of scorer
  const [conflicts,     setConflicts]     = useState([])     // conflicting holes detected
  // Guest code entry state (shown when not logged in and no valid session)
  const [needsCode,     setNeedsCode]     = useState(false)
  const [codeEventId,   setCodeEventId]   = useState(null)
  const [loadTrigger,   setLoadTrigger]   = useState(0)
  // Prevent hole from resetting on auth re-renders after initial load
  const holeInitKey = useRef(null)
  // Flag: focus first score input when hole advances after a save
  const focusFirstOnHoleChange = useRef(false)

  useEffect(() => {
    if (!focusFirstOnHoleChange.current) return
    focusFirstOnHoleChange.current = false
    const first = document.querySelectorAll('[data-player-gross]')[0]
    if (first) { first.focus(); first.select() }
  }, [currentHole])

  useEffect(() => {
    // Wait for auth to resolve before loading
    if (authLoading || profile === undefined) return

    async function load() {
      // Resolve the event UUID — prefer ?eid= param (guest links bypass RLS slug lookup)
      let evId = null
      if (directEventId) {
        evId = directEventId
      } else if (leagueSlug && eventSlug) {
        const { data: lg } = await supabase.from('leagues').select('id').eq('slug', leagueSlug).single()
        if (lg) {
          const { data: ev } = await supabase.from('events').select('id').eq('league_id', lg.id).eq('slug', eventSlug).single()
          evId = ev?.id ?? null
        }
        if (!evId) { setError('Event not found.'); setLoading(false); return }
      } else {
        // /scorecard/me route — no slug/number params, resolve via scorekeeper assignment
        evId = 'me'
      }

      let guestGroupNum = null

      // Guest access: check sessionStorage for a valid guest session
      if (!user) {
        const guest = readGuestSession()
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
        .select('*, course:courses(*), league:leagues(name, slug)')
        .eq('id', evId)
        .single()

      if (!ev) { setError('Event not found.'); setLoading(false); return }

      // Verify guest group code
      if (guestGroupNum != null) {
        const guest = readGuestSession()
        const groupCodes = ev.group_codes ?? {}
        const expectedCode = groupCodes[String(guestGroupNum)]
        if (!expectedCode || expectedCode !== guest?.accessCode) {
          clearGuestSession()
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
      const editAllowed = isAdmin || userIsScorekeeper || guestGroupNum != null
      setCanEdit(editAllowed)

      // Resolve scorer identity for audit log
      const guestSession = readGuestSession()
      const scorerName = guestSession?.selectedName
        ?? user?.email
        ?? (isAdmin ? 'Admin' : null)
      setEnteredBy(scorerName)

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

      const { data: eps } = await query.order('group_order').order('adjusted_handicap_index')
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
        // Only set the starting hole once per event/session load — prevents toggling on auth re-renders
        const initKey = `${evId}:${loadTrigger}`
        if (holeInitKey.current !== initKey) {
          holeInitKey.current = initKey
          if (lastComplete === 0 && ev.shotgun_start && groupNum) {
            // Start on the group's assigned shotgun hole (e.g. "4A" → 4), fallback to 1
            const assignStr = (ev.group_hole_assignments ?? {})[String(groupNum)] ?? null
            const shotgunStart = assignStr ? (parseInt(assignStr, 10) || 1) : 1
            setCurrentHole(shotgunStart)
          } else {
            setCurrentHole(Math.min(18, lastComplete + 1))
          }
        }

        const allDone = playerIds.every(pid => Object.keys(map[pid] ?? {}).length === 18)
        if (allDone || ev.status === 'complete') setShowScorecard(true)

        // Load conflicts for this group
        const { data: conflictRows } = await supabase
          .from('score_audit_log')
          .select('*')
          .eq('event_id', evId)
          .eq('is_conflict', true)
          .in('player_id', playerIds)
          .order('hole_number')
        setConflicts(conflictRows ?? [])
      }

      setLoading(false)
    }

    load()
  }, [leagueSlug, eventSlug, user, profile, authLoading, isAdmin, loadTrigger])

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
        entered_by:  enteredBy,
      })

      if (result?.error) {
        toast.error(`Save failed: ${result.error}`)
        allValid = false
      } else if (result?.queued) {
        toast('Saved offline — will sync when connected', { icon: '📶', duration: 2000 })
      }
    }

    setSaving(false)

    // Only clear dirty state if all saves succeeded
    if (allValid) {
      setDirtyHoles(prev => { const n = new Set(prev); n.delete(currentHole); return n })
    }

    if (allValid && currentHole < 18) {
      focusFirstOnHoleChange.current = true
      setCurrentHole(h => h + 1)
      window.scrollTo({ top: 0, behavior: 'instant' })
    } else if (allValid && currentHole === 18) {
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
        onSuccess={(groupNum, code, name) => {
          writeGuestSession({ eventId: codeEventId, groupNum, accessCode: code, selectedName: name })
          setNeedsCode(false)
          setLoading(true)
          setLoadTrigger(t => t + 1)
        }}
      />
    )
  }

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={{ background: '#fbfaf8' }}>
      <div className="text-5xl mb-4">⛳</div>
      <p className="text-ink font-semibold text-lg">{error}</p>
      <Link to="/login" className="mt-6 btn btn-secondary btn-md">
        Sign In
      </Link>
    </div>
  )

  if (!event || !course) return null

  const parPerHole    = course.par_per_hole    ?? Array(18).fill(4)
  const strokeIndex   = course.stroke_index    ?? Array(18).fill(0)

  const hole       = currentHole
  const par        = parPerHole[hole - 1]
  const si         = strokeIndex[hole - 1]
  const yd         = course.yardage?.[hole - 1] ?? '—'
  const trackPutts = (event.side_game_options ?? []).includes('track_putts') || (event.side_game_options ?? []).includes('low_putts')
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
        trackPutts={trackPutts}
        isComplete={isComplete}
        canEdit={canEdit}
        onEdit={() => setShowScorecard(false)}
        homeLink={homeLink}
        onSignOut={user ? handleSignOut : null}
        orgSlug={orgSlug}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8' }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: '#ffffff', borderBottom: '1px solid #ebe9e4' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold text-base text-ink leading-tight">{event.course?.name ?? course.name}</div>
            <div className="text-xs text-ink-muted mt-0.5">
              {event.league?.name} · Event #{event.event_number}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <div className="flex items-center gap-1 rounded-full px-2.5 py-1" style={{ background: '#fef9c3' }}>
                <div className={`w-1.5 h-1.5 rounded-full ${syncing ? 'bg-yellow-400 animate-pulse' : 'bg-yellow-500'}`} />
                <span className="text-xs text-yellow-700">{pendingCount} pending</span>
              </div>
            )}
            {holesEntered > 0 && (
              <button
                onClick={() => setShowScorecard(true)}
                className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors text-ink-muted hover:text-ink hover:bg-surface-high"
              >
                {holesEntered === 18 ? 'Scorecard' : `Progress (${holesEntered})`}
              </button>
            )}
            <Link
              to={`/${orgSlug ?? event.org_slug}/${event.league?.slug}/${event.slug}/leaderboard?eid=${event.id}`}
              state={{ from: 'scorecard', scorecardEventId: event.id }}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors text-ink-muted hover:text-ink hover:bg-surface-high"
            >
              Leaderboard
            </Link>
            {homeLink && <Link to={homeLink} className="text-xs text-ink-muted hover:text-ink px-2">⛳</Link>}
            {user && (
              <button onClick={handleSignOut} className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors text-ink-muted hover:text-ink hover:bg-surface-high">
                Sign out
              </button>
            )}
          </div>
        </div>

        {isComplete && (
          <div className="px-4 py-2 text-xs text-center font-medium" style={{ background: '#fef3c7', color: '#92400e' }}>
            Event is complete — editing scores will update official results
          </div>
        )}
        {!canEdit && !isComplete && (
          <div className="px-4 py-2 text-xs text-center font-medium" style={{ background: '#f4f3f0', color: '#86868b' }}>
            View only — you are not the assigned scorekeeper for this group
          </div>
        )}

        {/* Hole navigator — dot chips */}
        <div className="px-4 pb-3 flex gap-1.5 overflow-x-auto scrollbar-hide">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
            const saved   = holeSaved(h)
            const dirty   = dirtyHoles.has(h)
            const current = h === hole
            return (
              <button
                key={h}
                onClick={() => handleHoleNav(h)}
                title={`Hole ${h}`}
                className="shrink-0 transition-all"
                style={{
                  width: current ? 28 : 20,
                  height: 20,
                  borderRadius: 9999,
                  background: current ? '#1d1d1f'
                    : dirty   ? '#fbbf24'
                    : saved   ? '#1B4332'
                    :            '#eceae5',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Hole info bar */}
      <div className="px-4 py-3 flex items-center gap-6" style={{ background: '#ffffff', borderBottom: '1px solid #ebe9e4' }}>
        <div className="text-center">
          <div className="text-2xl font-black text-ink">{hole < 10 ? `0${hole}` : hole}</div>
          <div className="text-xs text-ink-muted font-medium" style={{ letterSpacing: '0.04em' }}>HOLE</div>
        </div>
        <div className="w-px h-10" style={{ background: '#ebe9e4' }} />
        <div className="text-center">
          <div className="text-xl font-bold text-ink">{par}</div>
          <div className="text-xs text-ink-muted" style={{ letterSpacing: '0.04em' }}>PAR</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-ink">{yd}</div>
          <div className="text-xs text-ink-muted" style={{ letterSpacing: '0.04em' }}>YDS</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-ink">{si}</div>
          <div className="text-xs text-ink-muted" style={{ letterSpacing: '0.04em' }}>S.I.</div>
        </div>
        <div className="ml-auto text-xs text-ink-muted">{holesEntered}/18 done</div>
      </div>

      {/* Player score cards */}
      <div className="flex-1 p-4 space-y-3 pb-28">
        {groupPlayers.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <p>No players assigned to your group yet.</p>
            <p className="text-sm mt-1">Contact your admin.</p>
          </div>
        )}
        {groupPlayers.map((ep, idx) => (
          <PlayerScoreCard
            key={ep.player_id}
            ep={ep}
            hole={hole}
            par={par}
            si={si}
            score={getScore(ep.player_id, hole)}
            allHoleScores={scores[ep.player_id] ?? {}}
            courseStrokeIndexes={strokeIndex}
            trackPutts={trackPutts}
            onChange={(field, val) => updateScore(ep.player_id, hole, field, val)}
            onGrossDone={() => {
              const inputs = document.querySelectorAll('[data-player-gross]')
              const nextCard = inputs[idx + 1]
              if (nextCard) {
                nextCard.focus()
                nextCard.select()
              } else {
                // Last player — dismiss keyboard
                document.activeElement?.blur()
              }
            }}
          />
        ))}
      </div>

      {/* Conflicts banner */}
      {conflicts.length > 0 && (
        <div className="mx-4 mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <p className="text-sm font-bold text-red-700 mb-1">⚠ Conflicting scores detected</p>
          <div className="space-y-0.5">
            {conflicts.map((c, i) => (
              <p key={i} className="text-xs text-red-600">
                Hole {c.hole_number} · {c.player_name ?? 'Player'}: {c.previous_score} → {c.new_score} (entered by {c.entered_by})
              </p>
            ))}
          </div>
          <p className="text-xs text-red-400 mt-1.5">Contact your admin to resolve.</p>
        </div>
      )}

      {/* Bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 safe-bottom" style={{ background: '#ffffff', borderTop: '1px solid #ebe9e4' }}>
        {isDirty && (
          <p className="text-center text-xs font-medium mb-2" style={{ color: '#92400e' }}>
            ⚠ Unsaved scores on this hole
          </p>
        )}
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            disabled={hole <= 1}
            onClick={() => handleHoleNav(Math.max(1, hole - 1))}
            className="btn btn-secondary flex-none disabled:opacity-30 active:scale-95"
            style={{ width: 48, height: 48, padding: 0 }}
          >
            ←
          </button>
          <button
            onClick={saveHole}
            disabled={saving || !canEdit}
            className="btn btn-primary btn-lg flex-1 disabled:opacity-50 active:scale-95"
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
            className="btn btn-secondary flex-none disabled:opacity-30 active:scale-95"
            style={{ width: 48, height: 48, padding: 0 }}
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Player Score Card ─────────────────────────────────────────────
function PlayerScoreCard({ ep, hole, par, si, score, allHoleScores, courseStrokeIndexes, trackPutts, onChange, onGrossDone }) {
  const grossRef    = useRef(null)
  const puttsRef    = useRef(null)
  const advanceTimer = useRef(null)

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
  const netColor = netVsPar == null ? 'text-ink-muted'
    : netVsPar < 0  ? 'text-status-active-text'
    : 'text-ink'

  const grossDisplay = score.gross !== '' && score.gross != null ? String(score.gross) : ''
  const puttsDisplay = score.putts !== '' && score.putts != null ? String(score.putts) : ''

  // Running score summary text
  const runningLabel = holesPlayed > 0
    ? `${holesPlayed} hole${holesPlayed !== 1 ? 's' : ''} · Gross ${totalGross}`
    : 'No holes entered'

  return (
    <div className="card overflow-hidden p-0">
      {/* Player header row */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-ink">
              {ep.player?.first_name} {ep.player?.last_name}
            </span>
            {ep.flight && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${ep.flight === 'A' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>
                {ep.flight}
              </span>
            )}
            {strokes > 0 && (
              <span className="inline-flex items-center text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: '#eaf1ec', color: '#1B4332' }} title={`Receives ${strokes} stroke${strokes > 1 ? 's' : ''}`}>
                {'●'.repeat(Math.min(strokes, 3))} {strokes} stroke{strokes > 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="text-xs text-ink-muted mt-0.5">{runningLabel}</div>
        </div>

        {/* Score input — 54px tap target */}
        <div className="flex items-center gap-3">
          {net != null && (
            <div className="text-right">
              <div className="text-xs text-ink-muted leading-none mb-0.5">Net</div>
              <div className={`text-xl font-black leading-none ${netColor}`}>
                {netVsPar === 0 ? 'E' : `${netVsPar > 0 ? '+' : ''}${netVsPar}`}
              </div>
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5">
            <span className="text-xs text-ink-muted font-medium" style={{ letterSpacing: '0.04em' }}>SCORE</span>
            <input
              ref={grossRef}
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={grossDisplay}
              onChange={e => {
                const raw = e.target.value
                const val = raw === '' ? '' : parseInt(raw, 10) || ''
                onChange('gross', val)
                // Auto-advance: immediate unless value starts with '1' (could be 11-19)
                if (val !== '' && advanceTimer.current) clearTimeout(advanceTimer.current)
                if (val !== '') {
                  const delay = String(val) === '1' ? 1600 : 0
                  advanceTimer.current = setTimeout(() => {
                    if (trackPutts && puttsRef.current) {
                      puttsRef.current.focus()
                      puttsRef.current.select()
                    } else if (onGrossDone) {
                      onGrossDone()
                    }
                  }, delay)
                }
              }}
              onFocus={e => e.target.select()}
              placeholder="—"
              min={1}
              max={20}
              data-player-gross
              className="text-center text-3xl font-black outline-none bg-white"
              style={{
                width: 54, height: 54,
                borderRadius: 14,
                border: grossDisplay ? '1px solid #d6d4cf' : '1.5px dashed #d6d4cf',
                WebkitAppearance: 'none', MozAppearance: 'textfield',
              }}
            />
          </div>
        </div>
      </div>

      {/* Putts row */}
      {trackPutts && (
        <div className="flex items-center justify-between px-4 py-2" style={{ borderTop: '1px solid #ebe9e4', background: '#fbfaf8' }}>
          <div>
            <span className="text-xs text-ink-muted font-medium">Putts on this hole</span>
            {grossVal != null && score.putts !== '' && score.putts != null && parseInt(score.putts, 10) > grossVal && (
              <div className="text-xs text-red-600 font-semibold mt-0.5">⚠ Putts exceed score</div>
            )}
          </div>
          <input
            ref={puttsRef}
            type="number"
            inputMode="numeric"
            pattern="[0-9]*"
            value={puttsDisplay}
            onChange={e => {
              const raw = e.target.value
              const val = raw === '' ? '' : parseInt(raw, 10)
              const valid = val === '' || (!isNaN(val) && val >= 0)
              if (!valid) return
              onChange('putts', val)
              // Always advance immediately — double-digit putts are not realistic
              if (val !== '' && onGrossDone) onGrossDone()
            }}
            onFocus={e => e.target.select()}
            placeholder="0"
            min={0}
            max={10}
            className="text-center text-xl font-bold outline-none bg-white"
            style={{
              width: 44, height: 40,
              borderRadius: 10,
              border: grossVal != null && score.putts !== '' && score.putts != null && parseInt(score.putts, 10) > grossVal
                ? '1.5px solid #f87171'
                : '1px solid #d6d4cf',
              WebkitAppearance: 'none', MozAppearance: 'textfield',
            }}
          />
        </div>
      )}
    </div>
  )
}

// ─── Traditional Scorecard View (vertical: holes=rows, players=cols) ──
function TraditionalScorecard({ event, course, groupPlayers, scores, isComplete, canEdit, onEdit, homeLink, onSignOut, trackPutts, orgSlug }) {
  const pars  = course.par_per_hole ?? Array(18).fill(4)
  const sis   = course.stroke_index ?? Array(18).fill(0)

  // Build per-player totals
  const playerData = groupPlayers.map(ep => {
    const ch = ep.course_handicap ?? 0
    const name = ep.player?.first_name ?? ''
    let frontGross = 0, backGross = 0, frontNet = 0, backNet = 0
    let frontPutts = 0, backPutts = 0, hasPutts = false

    const cells = Array.from({ length: 18 }, (_, i) => {
      const h = i + 1
      const sc = scores[ep.player_id]?.[h]
      const g = sc ? parseInt(sc.gross, 10) : null
      const putts = sc && sc.putts !== '' && sc.putts != null ? parseInt(sc.putts, 10) : null
      if (putts != null) hasPutts = true
      const strokes = getStrokesOnHole(ch, sis[i])
      const net = g != null ? g - strokes : null
      const p = pars[i]
      if (g != null) {
        if (i < 9) { frontGross += g; frontNet += (net ?? g); if (putts != null) frontPutts += putts }
        else        { backGross  += g; backNet  += (net ?? g); if (putts != null) backPutts  += putts }
      }
      const netVsPar = net != null ? net - p : null
      return { g, net, netVsPar, putts }
    })

    return { ep, name, ch, cells, frontGross, backGross, frontNet, backNet,
      totalGross: frontGross + backGross, totalNet: frontNet + backNet,
      frontPutts, backPutts, totalPutts: frontPutts + backPutts, hasPutts }
  })

  const anyPutts = trackPutts && playerData.some(p => p.hasPutts)

  function ScoreCell({ g, netVsPar }) {
    const size = 32
    const num = <text x="16" y="21" textAnchor="middle" fontSize="12" fontWeight="700" fill="#1d1d1f">{g}</text>

    if (netVsPar == null) return (
      <svg width={size} height={size}><text x="16" y="21" textAnchor="middle" fontSize="12" fill="#c7c7cc">—</text></svg>
    )
    if (netVsPar <= -2) return (  // Eagle or better — double circle
      <svg width={size} height={size}>
        <circle cx="16" cy="16" r="14" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/>
        <circle cx="16" cy="16" r="10" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/>
        {num}
      </svg>
    )
    if (netVsPar === -1) return (  // Birdie — single circle
      <svg width={size} height={size}>
        <circle cx="16" cy="16" r="13" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/>
        {num}
      </svg>
    )
    if (netVsPar === 0) return (  // Par — plain
      <svg width={size} height={size}>{num}</svg>
    )
    if (netVsPar === 1) return (  // Bogey — single square
      <svg width={size} height={size}>
        <rect x="2" y="2" width="28" height="28" rx="2" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/>
        {num}
      </svg>
    )
    return (  // Double bogey+ — double square
      <svg width={size} height={size}>
        <rect x="2" y="2" width="28" height="28" rx="2" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/>
        <rect x="6" y="6" width="20" height="20" rx="1" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/>
        {num}
      </svg>
    )
  }

  const frontPar = pars.slice(0, 9).reduce((a, b) => a + b, 0)
  const backPar  = pars.slice(9).reduce((a, b) => a + b, 0)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8' }}>
      {/* Header */}
      <div className="sticky top-0 z-20" style={{ background: '#ffffff', borderBottom: '1px solid #ebe9e4' }}>
        <div className="px-4 py-3 flex items-center justify-between">
          <div>
            <div className="font-bold text-base text-ink">{event.course?.name ?? course.name}</div>
            <div className="text-xs text-ink-muted">{event.league?.name} · {event.name ?? `Event #${event.event_number}`}</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/${orgSlug ?? event.org_slug}/${event.league?.slug}/${event.slug}/leaderboard?eid=${event.id}`}
              state={{ from: 'scorecard', scorecardEventId: event.id }}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors text-ink-muted hover:text-ink hover:bg-surface-high"
            >
              Leaderboard
            </Link>
            {homeLink && <Link to={homeLink} className="text-xs text-ink-muted hover:text-ink px-2">⛳</Link>}
            {onSignOut && (
              <button onClick={onSignOut} className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors text-ink-muted hover:text-ink hover:bg-surface-high">
                Sign out
              </button>
            )}
          </div>
        </div>
        <div className="px-4 pb-3">
          <button
            onClick={onEdit}
            className="btn btn-secondary btn-sm"
          >
            ← {isComplete ? 'Edit Scores' : 'Back to Entry'}
          </button>
        </div>
      </div>

      {/* Vertical scorecard */}
      <div className="p-3 pb-10">
        <div className="bg-white rounded-2xl shadow overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              {/* Player name header row */}
              <tr style={{ background: '#1d1d1f', color: '#ffffff' }}>
                <th className="text-left px-3 py-2.5 text-xs font-semibold w-16" style={{ color: '#86868b' }}>HOLE</th>
                <th className="text-center px-2 py-2.5 text-xs font-semibold w-10" style={{ color: '#86868b' }}>PAR</th>
                {playerData.map(({ ep, name, ch }) => (
                  <th key={ep.player_id} className="text-center px-2 py-2.5">
                    <div className="font-bold text-white text-sm">{name}</div>
                    <div className="text-fairway-300 text-xs">({ch})</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Front nine */}
              {Array.from({ length: 9 }, (_, i) => {
                const h = i + 1
                const p = pars[i]
                return (
                  <tr key={h} style={{ background: i % 2 === 0 ? '#ffffff' : 'rgba(27,67,50,0.025)' }}>
                    <td className="px-3 py-2 text-xs font-bold text-gray-500">{h}</td>
                    <td className="text-center px-2 py-2 text-xs text-gray-400 font-medium">{p}</td>
                    {playerData.map(({ ep, cells }) => {
                      const c = cells[i]
                      return (
                        <td key={ep.player_id} className="text-center px-1 py-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <ScoreCell g={c.g} netVsPar={c.g != null ? c.netVsPar : null} />
                            {anyPutts && c.g != null && (
                              <span className="text-xs text-gray-400 leading-none">
                                {c.putts != null ? `${c.putts}p` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {/* Front nine total */}
              <tr style={{ background: '#1d1d1f', color: '#ffffff' }}>
                <td className="px-3 py-2 text-xs font-bold">OUT</td>
                <td className="text-center px-2 py-2 text-xs font-bold">{frontPar}</td>
                {playerData.map(({ ep, frontGross, frontPutts, hasPutts }) => (
                  <td key={ep.player_id} className="text-center px-2 py-2 text-sm">
                    <div className="font-black">{frontGross || '—'}</div>
                    {anyPutts && hasPutts && <div className="text-xs" style={{ color: '#86868b' }}>{frontPutts}p</div>}
                  </td>
                ))}
              </tr>

              {/* Back nine divider label */}
              <tr>
                <td colSpan={2 + playerData.length} className="text-center py-2 text-xs font-bold tracking-widest text-ink-muted" style={{ borderTop: '2px dashed #ebe9e4', background: '#f4f3f0' }}>
                  — BACK NINE —
                </td>
              </tr>

              {/* Back nine */}
              {Array.from({ length: 9 }, (_, i) => {
                const h = i + 10
                const p = pars[i + 9]
                return (
                  <tr key={h} style={{ background: i % 2 === 0 ? '#ffffff' : 'rgba(27,67,50,0.025)' }}>
                    <td className="px-3 py-2 text-xs font-bold text-gray-500">{h}</td>
                    <td className="text-center px-2 py-2 text-xs text-gray-400 font-medium">{p}</td>
                    {playerData.map(({ ep, cells }) => {
                      const c = cells[i + 9]
                      return (
                        <td key={ep.player_id} className="text-center px-1 py-1">
                          <div className="flex flex-col items-center gap-0.5">
                            <ScoreCell g={c.g} netVsPar={c.g != null ? c.netVsPar : null} />
                            {anyPutts && c.g != null && (
                              <span className="text-xs text-gray-400 leading-none">
                                {c.putts != null ? `${c.putts}p` : ''}
                              </span>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              {/* Back nine total */}
              <tr style={{ background: '#1d1d1f', color: '#ffffff' }}>
                <td className="px-3 py-2 text-xs font-bold">IN</td>
                <td className="text-center px-2 py-2 text-xs font-bold">{backPar}</td>
                {playerData.map(({ ep, backGross, backPutts, hasPutts }) => (
                  <td key={ep.player_id} className="text-center px-2 py-2 text-sm">
                    <div className="font-black">{backGross || '—'}</div>
                    {anyPutts && hasPutts && <div className="text-xs" style={{ color: '#86868b' }}>{backPutts}p</div>}
                  </td>
                ))}
              </tr>
              {/* Grand total */}
              <tr style={{ background: '#1B4332', color: '#ffffff' }}>
                <td className="px-3 py-2.5 text-sm font-black">TOTAL</td>
                <td className="text-center px-2 py-2.5 text-sm font-bold">{frontPar + backPar}</td>
                {playerData.map(({ ep, totalGross, totalNet, totalPutts, hasPutts }) => (
                  <td key={ep.player_id} className="text-center px-2 py-2.5">
                    <div className="font-black text-base leading-none">{totalGross || '—'}</div>
                    {totalNet > 0 && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>Net {totalNet}</div>}
                    {anyPutts && hasPutts && <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>{totalPutts} putts</div>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs justify-center text-ink-muted items-center">
          <span className="flex items-center gap-1">
            <svg width="20" height="20"><circle cx="10" cy="10" r="9" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/><circle cx="10" cy="10" r="6" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/></svg>
            Eagle+
          </span>
          <span className="flex items-center gap-1">
            <svg width="20" height="20"><circle cx="10" cy="10" r="9" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/></svg>
            Birdie
          </span>
          <span className="flex items-center gap-1">
            <svg width="20" height="20"><text x="10" y="15" textAnchor="middle" fontSize="11" fontWeight="700" fill="#1d1d1f">4</text></svg>
            Par
          </span>
          <span className="flex items-center gap-1">
            <svg width="20" height="20"><rect x="1" y="1" width="18" height="18" rx="2" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/></svg>
            Bogey
          </span>
          <span className="flex items-center gap-1">
            <svg width="20" height="20"><rect x="1" y="1" width="18" height="18" rx="2" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/><rect x="4" y="4" width="12" height="12" rx="1" fill="none" stroke="#1d1d1f" strokeWidth="1.5"/></svg>
            Double+
          </span>
        </div>
        <p className="text-center text-xs text-ink-muted mt-1">Net score vs par</p>
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
    async function loadEventInfo() {
      const { data: ev } = await supabase
        .from('events')
        .select('id, name, event_number, group_codes, league_id, course:courses(name)')
        .eq('id', eventId)
        .single()
      if (!ev) return
      // Fetch league separately so RLS on leagues doesn't block the whole query
      const { data: lg } = await supabase
        .from('leagues')
        .select('name, logo_url')
        .eq('id', ev.league_id)
        .single()
      setEventInfo({ ...ev, league: lg ?? null })
    }
    loadEventInfo()
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
      .order('group_order')

    setGroupPlayers(eps ?? [])
    setMatchedGroup(groupNum)
    setMatchedCode(trimmed)
    setChecking(false)
  }

  function handleConfirm() {
    onSuccess(matchedGroup, matchedCode, selectedName)
  }

  const eventLabel = eventInfo?.name ?? (eventInfo ? `Event #${eventInfo.event_number}` : '…')

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
      <div className="w-full max-w-xs">
        <div className="text-center mb-8">
          {eventInfo?.league?.logo_url ? (
            <img src={eventInfo.league.logo_url} alt="Club Logo" className="w-32 h-32 rounded-full object-cover mx-auto mb-4 shadow-xl" />
          ) : (
            <div className="w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-4 shadow-xl" style={{ background: '#1B4332', border: '2px solid rgba(255,255,255,0.15)' }}>
              <span className="text-white font-bold text-4xl" style={{ fontFamily: "'Playfair Display', serif" }}>
                {(eventInfo?.league?.name ?? '').slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          {eventInfo?.league?.name && (
            <h1 className="text-white font-bold text-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>{eventInfo.league.name}</h1>
          )}
          <p className="text-white/60 text-sm mt-1">{eventLabel}</p>
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
    <div className="min-h-screen" style={{ background: '#fbfaf8' }}>
      <div className="h-24 animate-pulse" style={{ background: '#eceae5' }} />
      <div className="h-16 border-b animate-pulse" style={{ background: '#ffffff', borderColor: '#ebe9e4' }} />
      <div className="p-4 space-y-3">
        {[0,1,2,3].map(i => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: '#eceae5' }} />)}
      </div>
    </div>
  )
}
