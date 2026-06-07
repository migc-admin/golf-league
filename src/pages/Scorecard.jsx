/**
 * Mobile Scorecard Entry
 *
 * Flow:
 *  1. If eventId === 'me' → find the active event this user is scorekeeper for
 *  2. Load the event, course, and their group's players
 *  3. Hole-by-hole entry with +/- steppers
 *  4. Net score shown live per player
 *  5. Saves optimistically; queues offline if no connection
 */

import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import { getStrokesOnHole, netScore } from '../lib/engines/scoring'
import toast from 'react-hot-toast'

export default function Scorecard() {
  const { eventId } = useParams()
  const { profile } = useAuth()
  const { saveScore, pendingCount, syncing } = useOfflineQueue()

  const [event,        setEvent]        = useState(null)
  const [course,       setCourse]       = useState(null)
  const [groupPlayers, setGroupPlayers] = useState([])  // event_players in scorekeeper's group
  const [scores,       setScores]       = useState({})  // { playerId: { holeNum: { gross, putts } } }
  const [currentHole,  setCurrentHole]  = useState(1)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)
  const [saving,       setSaving]       = useState(false)

  useEffect(() => {
    async function load() {
      let evId = eventId

      // Resolve 'me' to the user's active event
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

      // Load event + course
      const { data: ev } = await supabase
        .from('events')
        .select('*, course:courses(*)')
        .eq('id', evId)
        .single()

      if (!ev) { setError('Event not found.'); setLoading(false); return }
      if (ev.status === 'complete') { setError('This event is closed.'); setLoading(false); return }

      setEvent(ev)
      setCourse(ev.course)

      // Determine scorekeeper's group
      let groupNum = null
      if (profile?.player_id) {
        const { data: myEp } = await supabase
          .from('event_players')
          .select('group_number')
          .eq('event_id', evId)
          .eq('player_id', profile.player_id)
          .single()
        groupNum = myEp?.group_number ?? null
      }

      // Load group players (or all players if group not set)
      const query = supabase
        .from('event_players')
        .select('*, player:players(*)')
        .eq('event_id', evId)
      if (groupNum) query.eq('group_number', groupNum)

      const { data: eps } = await query.order('flight').order('adjusted_handicap_index')
      setGroupPlayers(eps ?? [])

      // Load existing scores for this group
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

        // Start on first incomplete hole
        const lastComplete = Math.max(0,
          ...playerIds.flatMap(pid =>
            Object.keys(map[pid] ?? {}).map(Number)
          )
        )
        setCurrentHole(Math.min(18, lastComplete + 1))
      }

      setLoading(false)
    }
    if (profile !== undefined) load()
  }, [eventId, profile])

  function getScore(playerId, hole) {
    return scores[playerId]?.[hole] ?? { gross: '', putts: '' }
  }

  function updateScore(playerId, hole, field, value) {
    setScores(prev => ({
      ...prev,
      [playerId]: {
        ...(prev[playerId] ?? {}),
        [hole]: {
          ...getScore(playerId, hole),
          [field]: value,
        },
      },
    }))
  }

  const saveHole = useCallback(async () => {
    if (!event || !course) return
    setSaving(true)

    const par = course.par_per_hole[currentHole - 1]
    let allValid = true

    for (const ep of groupPlayers) {
      const sc = getScore(ep.player_id, currentHole)
      const gross = parseInt(sc.gross, 10)
      if (!gross || gross < 1) { allValid = false; continue }

      const putts = sc.putts !== '' ? parseInt(sc.putts, 10) : null

      const result = await saveScore({
        event_id:    event.id,
        player_id:   ep.player_id,
        hole_number: currentHole,
        gross_score: gross,
        putts,
      })

      if (result.queued) {
        toast('Saved offline — will sync when connected', {
          icon: '📶',
          duration: 2000,
        })
      }
    }

    setSaving(false)

    if (allValid && currentHole < 18) {
      setCurrentHole(h => h + 1)
    } else if (currentHole === 18) {
      toast.success('Round complete! All 18 holes saved.')
    }
  }, [event, course, currentHole, groupPlayers, scores, saveScore])

  if (loading) return <ScorecardSkeleton />

  if (error) return (
    <div className="min-h-screen bg-fairway-800 flex flex-col items-center justify-center p-6 text-center">
      <div className="text-5xl mb-4">⛳</div>
      <p className="text-white font-semibold text-lg">{error}</p>
      <Link to="/admin" className="mt-4 text-fairway-300 text-sm hover:underline">Go to Dashboard →</Link>
    </div>
  )

  if (!event || !course) return null

  const hole = currentHole
  const par  = course.par_per_hole[hole - 1]
  const si   = course.stroke_index[hole - 1]
  const yd   = course.yardage[hole - 1]
  const holesEntered = groupPlayers.length > 0
    ? Math.max(0, ...groupPlayers.map(ep => Object.keys(scores[ep.player_id] ?? {}).length))
    : 0

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
            {/* Offline indicator */}
            {pendingCount > 0 && (
              <div className="flex items-center gap-1 bg-yellow-500/20 rounded-full px-2.5 py-1">
                <div className={`w-1.5 h-1.5 rounded-full ${syncing ? 'bg-yellow-300 animate-pulse' : 'bg-yellow-400'}`} />
                <span className="text-xs text-yellow-200">{pendingCount} pending</span>
              </div>
            )}
            <Link to={`/leaderboard/${event.id}`} className="text-fairway-200 text-xs hover:text-white">
              Board
            </Link>
          </div>
        </div>

        {/* Hole navigator */}
        <div className="px-4 pb-3 flex gap-1 overflow-x-auto scrollbar-hide">
          {Array.from({ length: 18 }, (_, i) => i + 1).map(h => {
            const hasScores = groupPlayers.every(ep => scores[ep.player_id]?.[h]?.gross)
            const isCurrent = h === hole
            return (
              <button
                key={h}
                onClick={() => setCurrentHole(h)}
                className={`shrink-0 w-8 h-8 rounded-full text-xs font-bold transition-all ${
                  isCurrent
                    ? 'bg-white text-fairway-700 shadow-lg scale-110'
                    : hasScores
                    ? 'bg-fairway-500 text-white'
                    : 'bg-fairway-800 text-fairway-400'
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
          <div className="text-2xl font-black text-fairway-700">
            {hole < 10 ? `0${hole}` : hole}
          </div>
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
            onChange={(field, val) => updateScore(ep.player_id, hole, field, val)}
          />
        ))}
      </div>

      {/* Save button — fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 safe-bottom">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <button
            disabled={hole <= 1}
            onClick={() => setCurrentHole(h => Math.max(1, h - 1))}
            className="flex-none w-12 h-12 rounded-full border-2 border-gray-200 text-gray-600 font-bold disabled:opacity-30 hover:border-gray-300 active:scale-95 transition-all"
          >
            ←
          </button>
          <button
            onClick={saveHole}
            disabled={saving || groupPlayers.every(ep => !getScore(ep.player_id, hole).gross)}
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
              hole === 18 ? 'Save Hole 18 · Finish' : `Save Hole ${hole} · Next →`
            )}
          </button>
          <button
            disabled={hole >= 18}
            onClick={() => setCurrentHole(h => Math.min(18, h + 1))}
            className="flex-none w-12 h-12 rounded-full border-2 border-gray-200 text-gray-600 font-bold disabled:opacity-30 hover:border-gray-300 active:scale-95 transition-all"
          >
            →
          </button>
        </div>
      </div>
    </div>
  )
}

function PlayerScoreCard({ ep, hole, par, si, score, allHoleScores, courseStrokeIndexes, onChange }) {
  const ch       = ep.course_handicap ?? 0
  const strokes  = getStrokesOnHole(ch, si)
  const gross    = parseInt(score.gross, 10)
  const net      = !isNaN(gross) && gross > 0 ? gross - strokes : null
  const putts    = score.putts !== '' ? parseInt(score.putts, 10) : null

  // Running net total across all entered holes
  const runningNet = Object.entries(allHoleScores).reduce((total, [h, s]) => {
    const g = parseInt(s.gross, 10)
    if (isNaN(g) || g <= 0) return total
    const holeSI = courseStrokeIndexes[parseInt(h, 10) - 1]
    const strokesToApply = getStrokesOnHole(ch, holeSI)
    const holePar = par // Note: this is current hole's par, not ideal — for running total display it's approximate
    return total + (g - strokesToApply)
  }, 0)

  const netVsPar = net != null ? net - par : null
  const netColor = netVsPar == null ? '' : netVsPar < 0 ? 'text-red-600' : netVsPar === 0 ? 'text-gray-700' : 'text-blue-600'

  function stepper(field, min, max) {
    const val = field === 'gross' ? (parseInt(score.gross, 10) || par) : (parseInt(score.putts, 10) || 0)
    return (
      <div className="flex items-center gap-0">
        <button
          type="button"
          onClick={() => onChange(field, Math.max(min, val - 1))}
          className="w-10 h-10 rounded-l-lg bg-gray-100 text-gray-700 font-bold text-lg active:bg-gray-200 transition-colors flex items-center justify-center"
        >
          −
        </button>
        <input
          type="number"
          value={field === 'gross' ? (score.gross === '' ? '' : score.gross) : (score.putts === '' ? '' : score.putts)}
          onChange={e => onChange(field, e.target.value)}
          className="w-12 h-10 text-center font-bold text-base border-y border-gray-200 focus:outline-none focus:bg-fairway-50"
          min={min}
          max={max}
          inputMode="numeric"
        />
        <button
          type="button"
          onClick={() => onChange(field, Math.min(max, val + 1))}
          className="w-10 h-10 rounded-r-lg bg-gray-100 text-gray-700 font-bold text-lg active:bg-gray-200 transition-colors flex items-center justify-center"
        >
          +
        </button>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Player header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-900 text-sm">
            {ep.player?.first_name} {ep.player?.last_name}
          </span>
          {ep.flight && (
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${ep.flight === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
              {ep.flight}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>CH: {ch}</span>
          <span className={`font-bold text-sm ${netColor}`}>
            {net != null ? (
              netVsPar === 0 ? 'E' : `${netVsPar > 0 ? '+' : ''}${netVsPar}`
            ) : '—'}
          </span>
        </div>
      </div>

      {/* Score inputs */}
      <div className="px-4 py-3 flex items-center gap-6">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Gross</span>
          {stepper('gross', 1, 15)}
          {strokes > 0 && (
            <span className="text-xs text-fairway-600 font-medium">
              −{strokes} stroke{strokes !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        <div className="flex-1 flex flex-col items-center">
          {net != null && (
            <>
              <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Net</span>
              <span className={`text-3xl font-black ${netColor}`}>{net}</span>
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-1">
          <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Putts</span>
          {stepper('putts', 0, 10)}
        </div>
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
