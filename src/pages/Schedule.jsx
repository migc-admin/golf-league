/**
 * Public Schedule / Pairings Page
 * No authentication required — shareable link for players.
 *
 * Shows: event info, format, tee times, groups with player details.
 * Tee times computed from events.start_time + group_number * tee_time_interval_mins.
 */

import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const FORMAT_LABELS = {
  net_stroke:   'Net Stroke Play',
  stableford:   'Stableford',
  match_points: 'Match Play Points',
  ryder_cup:    'Ryder Cup',
}

const FORMAT_DESCRIPTIONS = {
  net_stroke:   'Lowest net score wins. Handicap strokes applied per USGA allocation.',
  stableford:   'Points per hole. Eagle=4, Birdie=3, Par=2, Bogey=1, Double+=0. Most points wins.',
  match_points: 'Head-to-head within groups. Win a hole = 1 pt, halve = 0.5 pts each.',
  ryder_cup:    'Flight A vs Flight B team match play. Win/halve/lose each match for team points.',
}

export default function Schedule() {
  const { orgSlug, leagueSlug, eventSlug } = useParams()
  const navigate = useNavigate()
  const [event,        setEvent]        = useState(null)
  const [eventPlayers, setEventPlayers] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  useEffect(() => {
    async function load() {
      const { data: league } = await supabase.from('leagues').select('id, name, slug').eq('slug', leagueSlug).single()
      if (!league) { setError('Event not found.'); setLoading(false); return }

      const { data: ev } = await supabase
        .from('events')
        .select('*, course:courses(name), league:leagues(name, season_year, slug)')
        .eq('league_id', league.id)
        .eq('slug', eventSlug)
        .single()

      if (!ev) { setError('Event not found.'); setLoading(false); return }

      const eventId = ev.id

      const { data: eps } = await supabase
        .from('event_players')
        .select('*, player:players(first_name, last_name)')
        .eq('event_id', eventId)
        .order('group_number')
        .order('flight')
        .order('adjusted_handicap_index')

      setEvent(ev)
      setEventPlayers(eps ?? [])
      setLoading(false)
    }
    load()
  }, [leagueSlug, eventSlug])

  if (loading) return <ScheduleSkeleton />

  if (error) return (
    <div className="min-h-screen bg-fairway-800 flex items-center justify-center p-6">
      <p className="text-white font-semibold">{error}</p>
    </div>
  )

  if (!event) return null

  // Group players by group_number
  const groups = {}
  const ungrouped = []
  for (const ep of eventPlayers) {
    if (ep.group_number) {
      if (!groups[ep.group_number]) groups[ep.group_number] = []
      groups[ep.group_number].push(ep)
    } else {
      ungrouped.push(ep)
    }
  }

  const sortedGroups = Object.entries(groups).sort(([a], [b]) => parseInt(a) - parseInt(b))
  const format = event.format ?? 'net_stroke'
  const formatLabel = FORMAT_LABELS[format] ?? format

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top nav bar — always visible, works for both public and admin users */}
      <div className="bg-fairway-900 text-white px-4 py-2 flex items-center justify-between">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-fairway-300 hover:text-white text-sm transition-colors"
        >
          ← Back
        </button>
        <Link to="/admin" className="text-fairway-300 hover:text-white text-sm transition-colors">
          ⛳ Home
        </Link>
      </div>

      {/* Header */}
      <div className="bg-fairway-700 text-white shadow-lg">
        <div className="max-w-xl mx-auto px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold text-fairway-300 uppercase tracking-wider mb-1">
                {event.league?.name} · {event.league?.season_year}
              </div>
              <h1 className="text-xl font-bold leading-tight">
                {event.course?.name}
              </h1>
              <div className="text-fairway-200 text-sm mt-1">
                Event #{event.event_number} · {formatDate(event.event_date)}
              </div>
            </div>
            <StatusPill status={event.status} />
          </div>

          {/* Format + Start Time */}
          <div className="mt-4 flex flex-wrap gap-3">
            <div className="bg-white/15 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-lg">{formatIcon(format)}</span>
              <div>
                <div className="text-xs text-fairway-200">Format</div>
                <div className="text-sm font-semibold">{formatLabel}</div>
              </div>
            </div>
            {event.start_time && (
              <div className="bg-white/15 rounded-lg px-3 py-2 flex items-center gap-2">
                <span className="text-lg">🕗</span>
                <div>
                  <div className="text-xs text-fairway-200">First Tee</div>
                  <div className="text-sm font-semibold">{formatTime(event.start_time)}</div>
                </div>
              </div>
            )}
            <div className="bg-white/15 rounded-lg px-3 py-2 flex items-center gap-2">
              <span className="text-lg">👥</span>
              <div>
                <div className="text-xs text-fairway-200">Players</div>
                <div className="text-sm font-semibold">{eventPlayers.length} total</div>
              </div>
            </div>
          </div>

          {/* Format description */}
          {FORMAT_DESCRIPTIONS[format] && (
            <p className="mt-3 text-xs text-fairway-300 leading-relaxed">
              {FORMAT_DESCRIPTIONS[format]}
            </p>
          )}
        </div>
      </div>

      {/* Leaderboard link */}
      {event.status !== 'upcoming' && (
        <div className="max-w-xl mx-auto px-4 pt-4">
          <Link
            to={`/${orgSlug}/${event.league?.slug}/${event.slug}/leaderboard`}
            className="flex items-center justify-between bg-fairway-700 text-white rounded-xl px-4 py-3 shadow-sm hover:bg-fairway-800 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-xl">📊</span>
              <div>
                <div className="font-semibold text-sm">Live Leaderboard</div>
                <div className="text-xs text-fairway-300">Updated hole by hole</div>
              </div>
            </div>
            <span className="text-fairway-300 text-lg">→</span>
          </Link>
        </div>
      )}

      {/* Pairings */}
      <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
        {sortedGroups.length === 0 && ungrouped.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-3">⛳</div>
            <p className="font-medium">Pairings not posted yet</p>
            <p className="text-sm mt-1">Check back closer to the event.</p>
          </div>
        )}

        {sortedGroups.map(([groupNum, members]) => {
          const teeTime = computeTeeTime(event.start_time, event.tee_time_interval_mins ?? 10, parseInt(groupNum))
          const groupCode = event.group_codes?.[groupNum] ?? null
          return (
            <GroupCard
              key={groupNum}
              groupNum={groupNum}
              members={members}
              teeTime={teeTime}
              format={format}
              groupCode={groupCode}
            />
          )
        })}

        {ungrouped.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-3">
              Unassigned Players
            </p>
            <div className="space-y-2">
              {ungrouped.map(ep => (
                <PlayerRow key={ep.player_id} ep={ep} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="max-w-xl mx-auto px-4 pb-8 pt-2 text-center text-xs text-gray-400">
        No app to download · Open this link in any browser
      </div>
    </div>
  )
}

// ─── Group Card ───────────────────────────────────────────────────
function GroupCard({ groupNum, members, teeTime, format, groupCode }) {
  const flightA = members.filter(m => m.flight === 'A')
  const flightB = members.filter(m => m.flight === 'B')
  const hasFlights = flightA.length > 0 || flightB.length > 0
  const showMatchup = (format === 'match_points' || format === 'ryder_cup') && flightA.length > 0 && flightB.length > 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="bg-fairway-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-white text-sm">
            {groupNum}
          </div>
          <div>
            <div className="font-bold text-white text-sm">Group {groupNum}</div>
            <div className="text-fairway-200 text-xs">{members.length} players</div>
          </div>
          {groupCode && (
            <div className="bg-white/20 rounded-lg px-2.5 py-1 text-center">
              <div className="text-fairway-200 text-xs leading-none mb-0.5">Scoring Access Code</div>
              <div className="text-white font-bold text-sm tracking-widest">{groupCode}</div>
            </div>
          )}
        </div>
        <div className="text-right">
          {teeTime ? (
            <>
              <div className="text-white font-bold text-base">{teeTime}</div>
              <div className="text-fairway-300 text-xs">Tee time</div>
            </>
          ) : (
            <div className="text-fairway-300 text-xs">Time TBD</div>
          )}
        </div>
      </div>

      {/* Match play header for ryder_cup / match_points */}
      {showMatchup && (
        <div className="flex border-b border-gray-100">
          <div className="flex-1 bg-blue-50 text-center py-1.5 text-xs font-bold text-blue-700">
            Flight A
          </div>
          <div className="w-8 bg-gray-50 flex items-center justify-center text-xs text-gray-400 font-bold">
            vs
          </div>
          <div className="flex-1 bg-purple-50 text-center py-1.5 text-xs font-bold text-purple-700">
            Flight B
          </div>
        </div>
      )}

      {/* Players */}
      <div className="divide-y divide-gray-100">
        {showMatchup
          ? renderMatchupRows(flightA, flightB)
          : members.map(ep => <PlayerRow key={ep.player_id} ep={ep} />)
        }
      </div>
    </div>
  )
}

function renderMatchupRows(flightA, flightB) {
  const rows = []
  const count = Math.max(flightA.length, flightB.length)
  for (let i = 0; i < count; i++) {
    rows.push(
      <div key={i} className="flex divide-x divide-gray-100">
        <div className="flex-1 py-3 px-3">
          {flightA[i] ? <MatchupPlayer ep={flightA[i]} flight="A" /> : <span className="text-xs text-gray-300">—</span>}
        </div>
        <div className="flex-1 py-3 px-3">
          {flightB[i] ? <MatchupPlayer ep={flightB[i]} flight="B" /> : <span className="text-xs text-gray-300">—</span>}
        </div>
      </div>
    )
  }
  return rows
}

function MatchupPlayer({ ep, flight }) {
  const color = flight === 'A' ? 'text-blue-700' : 'text-purple-700'
  return (
    <div>
      <div className={`font-semibold text-sm ${color}`}>
        {ep.player?.first_name} {ep.player?.last_name}
        {ep.is_scorekeeper && <span className="ml-1.5 text-xs font-normal text-gray-400">(SK)</span>}
      </div>
      <div className="text-xs text-gray-400 mt-0.5">
        HI {ep.handicap_index} · CH {ep.course_handicap}
      </div>
    </div>
  )
}

function PlayerRow({ ep }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        {ep.flight && (
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
            ep.flight === 'A' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
          }`}>
            {ep.flight}
          </div>
        )}
        <div>
          <div className="font-semibold text-sm text-gray-900">
            {ep.player?.first_name} {ep.player?.last_name}
            {ep.is_scorekeeper && (
              <span className="ml-2 text-xs font-normal text-fairway-600 bg-fairway-50 px-1.5 py-0.5 rounded">
                Scorekeeper
              </span>
            )}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            Handicap Index {ep.handicap_index}
            {ep.course_handicap != null && (
              <span className="ml-2 text-gray-500">Course {ep.course_handicap}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────
function computeTeeTime(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  // startTime is a Postgres TIME: "08:00:00"
  const [h, m] = startTime.split(':').map(Number)
  const totalMins = h * 60 + m + (groupNum - 1) * intervalMins
  const hh = Math.floor(totalMins / 60) % 24
  const mm  = totalMins % 60
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const hour12 = hh % 12 || 12
  return `${hour12}:${mm.toString().padStart(2, '0')} ${ampm}`
}

function formatTime(t) {
  return computeTeeTime(t, 0, 1) ?? t
}

function formatDate(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatIcon(format) {
  const icons = { net_stroke: '🏌️', stableford: '🎯', match_points: '⚔️', ryder_cup: '🏆' }
  return icons[format] ?? '⛳'
}

function StatusPill({ status }) {
  const map = {
    upcoming: { bg: 'bg-yellow-400/20 text-yellow-200', label: 'Upcoming' },
    active:   { bg: 'bg-green-400/20 text-green-200',  label: 'In Progress' },
    complete: { bg: 'bg-gray-400/20 text-gray-200',    label: 'Complete' },
  }
  const { bg, label } = map[status] ?? { bg: 'bg-gray-400/20 text-gray-200', label: status }
  return (
    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${bg}`}>
      {label}
    </span>
  )
}

function ScheduleSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="h-44 bg-fairway-700 animate-pulse" />
      <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-40 bg-gray-200 rounded-2xl animate-pulse" />
        ))}
      </div>
    </div>
  )
}
