// Data and math for the homepage "try it" scoring demo. Uses the same stroke
// allocation as real rounds (engines/scoring.js) so the demo's net scores and
// skins match what the app would show. Sample data only — no real players.
import { getStrokesOnHole } from './engines/scoring'

export const DEMO_HOLES = [
  { number: 1, par: 4, yards: 385, si: 7 },
  { number: 2, par: 3, yards: 165, si: 15, contest: 'Closest to the Pin' },
  { number: 3, par: 5, yards: 512, si: 3 },
]

// The visitor scores for this group.
export const DEMO_GROUP = [
  { id: 'sam',    name: 'Sam Ortiz',    flight: 'A', ch: 6 },
  { id: 'jen',    name: 'Jen Park',     flight: 'A', ch: 9 },
  { id: 'marcus', name: 'Marcus Hill',  flight: 'B', ch: 17 },
  { id: 'tony',   name: 'Tony Russo',   flight: 'B', ch: 22 },
]

// Another group that already finished these holes, so the board isn't empty.
export const DEMO_FIELD = [
  { id: 'dana',  name: 'Dana Cole',   flight: 'A', ch: 4,  gross: { 1: 4, 2: 3, 3: 5 } },
  { id: 'ray',   name: 'Ray Medina',  flight: 'B', ch: 18, gross: { 1: 5, 2: 4, 3: 6 } },
  { id: 'kelly', name: 'Kelly Brandt', flight: 'B', ch: 15, gross: { 1: 6, 2: 3, 3: 7 } },
]

export const DEMO_SKINS_POT = 120

export const strokesOn = (player, hole) => getStrokesOnHole(player.ch, hole.si)

/** All players in the event, each with a gross map { holeNumber: strokes }. */
export function allPlayers(groupScores) {
  return [
    ...DEMO_GROUP.map(p => ({ ...p, gross: groupScores[p.id] ?? {}, inGroup: true })),
    ...DEMO_FIELD.map(p => ({ ...p, inGroup: false })),
  ]
}

/** Leaderboard rows sorted by net to par; players with no holes go last. */
export function demoLeaderboard(groupScores) {
  const rows = allPlayers(groupScores).map(p => {
    let netToPar = 0, grossTotal = 0, thru = 0
    for (const hole of DEMO_HOLES) {
      const g = p.gross[hole.number]
      if (g == null) continue
      grossTotal += g
      netToPar += g - strokesOn(p, hole) - hole.par
      thru++
    }
    return { id: p.id, name: p.name, flight: p.flight, inGroup: p.inGroup, thru, grossTotal, netToPar: thru ? netToPar : null }
  })
  rows.sort((a, b) => {
    if (a.netToPar == null || b.netToPar == null) return (a.netToPar == null) - (b.netToPar == null)
    return a.netToPar - b.netToPar || b.thru - a.thru || a.name.localeCompare(b.name)
  })
  // Golf-style positions: ties share a position ("T2").
  let lastScore, lastPos = 0
  rows.forEach((r, i) => {
    if (r.netToPar == null) { r.pos = null; return }
    if (r.netToPar !== lastScore) { lastPos = i + 1; lastScore = r.netToPar }
    r.pos = lastPos
    r.tied = rows.filter(x => x.netToPar === r.netToPar).length > 1
  })
  return rows
}

/**
 * Net skins across the full field. A hole is decided only once every player
 * has a score on it. Lowest net wins outright; ties carry to the next hole.
 */
export function demoSkins(groupScores) {
  const players = allPlayers(groupScores)
  let carry = 0
  const holes = DEMO_HOLES.map(hole => {
    const complete = players.every(p => p.gross[hole.number] != null)
    if (!complete) return { hole: hole.number, status: 'open' }
    const nets = players.map(p => ({ p, net: p.gross[hole.number] - strokesOn(p, hole) }))
    const low = Math.min(...nets.map(n => n.net))
    const winners = nets.filter(n => n.net === low)
    if (winners.length > 1) { carry += 1; return { hole: hole.number, status: 'carry', low, tiedCount: winners.length } }
    const skins = 1 + carry
    carry = 0
    return { hole: hole.number, status: 'won', low, winner: winners[0].p.name, skins }
  })
  const skinsWon = holes.reduce((n, h) => n + (h.skins ?? 0), 0)
  const perSkin = skinsWon ? Math.floor(DEMO_SKINS_POT / skinsWon) : null
  const byWinner = {}
  for (const h of holes) if (h.status === 'won') byWinner[h.winner] = (byWinner[h.winner] ?? 0) + h.skins
  const payouts = Object.entries(byWinner)
    .map(([name, n]) => ({ name, skins: n, amount: n * perSkin }))
    .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  return { holes, carry, skinsWon, perSkin, payouts }
}

export const formatToPar = n => (n == null ? '—' : n === 0 ? 'E' : n > 0 ? `+${n}` : String(n))
