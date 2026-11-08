// "Player scoring" rows for the public league page: one row per player per completed event they
// finished (all 18 holes). Numbers come straight from the leaderboard calculation the event pages
// use (computeLeaderboards), which leaves guests out; nothing here changes scoring. Pure functions.

import { computeLeaderboards } from './engines/scoring'

const nameOf = player => `${player?.first_name ?? ''} ${player?.last_name ?? ''}`.trim() || 'Unnamed player'

/**
 * @returns [{ key, playerId, player, eventId, event, course, date, flight, hcp, gross, net, front9, back9, putts }]
 *   `front9` and `back9` are gross scores for each nine; `putts` is null when putts weren't tracked.
 */
export function playerScoringRows({ events, epsByEvent, scoresByEvent }) {
  const rows = []
  for (const ev of events) {
    const eps = epsByEvent[ev.id] ?? []
    const scores = scoresByEvent[ev.id] ?? []
    if (!ev.course?.par_per_hole || eps.length === 0 || scores.length === 0) continue
    let lb
    try { lb = computeLeaderboards(eps, scores, ev.course) } catch { continue }
    for (const p of [...(lb.full?.A ?? []), ...(lb.full?.B ?? [])]) {
      rows.push({
        key: `${ev.id}-${p.player_id}`,
        playerId: p.player_id,
        player: nameOf(p.player),
        role: p.player?.intended_role === 'guest' ? 'Guest' : 'Member',
        eventId: ev.id,
        event: ev.name || `Event #${ev.event_number}`,
        course: ev.course?.name ?? null,
        date: ev.event_date ?? null,
        season: ev.event_date ? String(ev.event_date).slice(0, 4) : null,
        flight: p.flight ?? null,
        hcp: p.course_handicap ?? null,
        gross: p.gross18,
        net: p.net18,
        front9: p.grossF9,
        back9: p.grossB9,
        putts: p.totalPutts ?? null,
      })
    }
  }
  return sortScoringRows(rows, 'player', 'asc')
}

const TEXT = new Set(['player', 'event', 'flight'])

/** Sort by one column. Empty values always go last; ties fall back to player, then event date. */
export function sortScoringRows(rows, key, dir = 'asc') {
  const sign = dir === 'desc' ? -1 : 1
  return [...rows].sort((a, b) => {
    const av = a[key], bv = b[key]
    const aEmpty = av == null, bEmpty = bv == null
    if (aEmpty !== bEmpty) return aEmpty ? 1 : -1
    let c = 0
    if (!aEmpty) c = TEXT.has(key) ? String(av).localeCompare(String(bv)) : av - bv
    if (c !== 0) return c * sign
    return a.player.localeCompare(b.player) || String(a.date).localeCompare(String(b.date))
  })
}

const CSV_COLUMNS = [
  ['Player', 'player'], ['Role', 'role'], ['Tournament', 'event'], ['Date', 'date'], ['Season', 'season'], ['Course', 'course'], ['Flight', 'flight'],
  ['HCP', 'hcp'], ['Gross', 'gross'], ['Net', 'net'], ['Front 9', 'front9'], ['Back 9', 'back9'], ['Putts', 'putts'],
]

// Quote cells that need it; a leading = + - @ would run as a formula in Excel, so mark those as text.
function csvCell(v) {
  if (v == null) return ''
  let s = String(v)
  if (/^[=+\-@]/.test(s) && Number.isNaN(Number(s))) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** The rows as CSV text (header first), in the order given. Blank cells for missing values. */
export function scoringRowsToCsv(rows) {
  const lines = [CSV_COLUMNS.map(([label]) => label).join(',')]
  for (const r of rows) lines.push(CSV_COLUMNS.map(([, key]) => csvCell(r[key])).join(','))
  return lines.join('\r\n') + '\r\n'
}

/** Apply the season, tournament and player filters ('' means all). A season is the year of the event date. */
export function filterScoringRows(rows, { season = '', eventId = '', playerId = '' } = {}) {
  return rows.filter(r => (!season || r.season === season) && (!eventId || r.eventId === eventId) && (!playerId || r.playerId === playerId))
}

/** Distinct seasons (newest first), players (A to Z) and events (oldest first) for the filter lists. */
export function scoringFilterOptions(rows) {
  const players = new Map(), events = new Map()
  for (const r of rows) {
    players.set(r.playerId, r.player)
    if (!events.has(r.eventId)) events.set(r.eventId, { id: r.eventId, label: r.event, date: r.date })
  }
  return {
    seasons: [...new Set(rows.map(r => r.season).filter(Boolean))].sort().reverse(),
    players: [...players].map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label)),
    events: [...events.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))),
  }
}
