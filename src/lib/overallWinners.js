// "Overall winners": how many times each player has finished 1st, 2nd or 3rd in their flight across
// the season's completed events, by net score for the full round.
//
// Uses the same leaderboard calculation as the event pages (computeLeaderboards), which already ranks
// each flight with ties and leaves guests out. Nothing here changes scoring. Pure functions.

import { computeLeaderboards } from './engines/scoring'

const FLIGHTS = ['A', 'B']

const nameOf = player => `${player?.first_name ?? ''} ${player?.last_name ?? ''}`.trim()

/**
 * Sort by 1sts, then 2nds, then 3rds (most first); equal counts share a place (1, 2, 2, 4).
 * `players` in each row are { id, name, finishes } so a row can open to the events behind its counts.
 */
export function placeGroups(tally) {
  const people = Object.values(tally)
    .filter(p => p.first + p.second + p.third > 0)
    .sort((a, b) => (b.first - a.first) || (b.second - a.second) || (b.third - a.third) || a.name.localeCompare(b.name))
  const groups = []
  for (const p of people) {
    const last = groups[groups.length - 1]
    const who = { id: p.id, name: p.name, finishes: p.finishes }
    if (last && last.first === p.first && last.second === p.second && last.third === p.third) last.players.push(who)
    else groups.push({ rank: people.indexOf(p) + 1, first: p.first, second: p.second, third: p.third, players: [who] })
  }
  return groups
}

/**
 * @returns [{ flight: 'A'|'B', label, rows: [{ rank, first, second, third, players: [name] }] }]
 *   (players are { id, name, finishes: [{ eventName, date, place, tied, net, vsPar }] })
 *   one entry per flight that has results; when the league has no second flight the label is "Overall".
 */
export function overallWinners({ events, epsByEvent, scoresByEvent }) {
  const tallies = { A: {}, B: {} }

  for (const ev of events) {
    const eps = epsByEvent[ev.id] ?? []
    const scores = scoresByEvent[ev.id] ?? []
    if (!ev.course?.par_per_hole || eps.length === 0 || scores.length === 0) continue
    let lb
    try { lb = computeLeaderboards(eps, scores, ev.course) } catch { continue }
    for (const fl of FLIGHTS) {
      const field = lb.full?.[fl] ?? []
      for (const p of field) {
        if (p.rank > 3) continue
        const t = (tallies[fl][p.player_id] ??= { id: p.player_id, name: nameOf(p.player) || 'Unnamed player', first: 0, second: 0, third: 0, finishes: [] })
        t.finishes.push({
          eventId: ev.id,
          eventName: ev.name || `Event #${ev.event_number}`,
          date: ev.event_date ?? null,
          place: p.rank,
          tied: field.filter(q => q.rank === p.rank).length > 1,
          net: p.net18,
          vsPar: p.netVsPar,
        })
        if (p.rank === 1) t.first += 1
        else if (p.rank === 2) t.second += 1
        else t.third += 1
      }
    }
  }

  for (const fl of FLIGHTS) for (const t of Object.values(tallies[fl])) t.finishes.sort((a, b) => String(a.date).localeCompare(String(b.date)))
  const out = FLIGHTS.map(fl => ({ flight: fl, rows: placeGroups(tallies[fl]) })).filter(f => f.rows.length > 0)
  const split = out.length > 1
  return out.map(f => ({ ...f, label: split ? `Flight ${f.flight}` : 'Overall' }))
}
