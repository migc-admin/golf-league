// Data and math for the homepage "try it" scoring demo. Uses the same stroke
// allocation as real rounds (engines/scoring.js) so the demo's net scores and
// skins match what the app would show. Sample data only — no real players.
import { getStrokesOnHole } from './engines/scoring'

export const DEMO_HOLES = [
  { number: 1, par: 4, yards: 385, si: 7 },
  { number: 2, par: 3, yards: 165, si: 15, contest: 'Closest to the Pin', contestShort: 'CTP' },
  { number: 3, par: 5, yards: 512, si: 3, contest: 'Long drive', contestShort: 'Long drive' },
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
  { id: 'chris', name: 'Chris Lowe',  flight: 'A', ch: 3,  gross: { 1: 4, 2: 3, 3: 5 } },
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

// ─── Groups ──────────────────────────────────────────────────────────────────
/** All 8 players in the sample league night (no scores). */
export const DEMO_ROSTER = [...DEMO_GROUP, ...DEMO_FIELD].map(({ gross: _gross, ...p }) => p)
export const DEMO_TEE_TIMES = ['4:30 PM', '4:39 PM']

/**
 * Split the roster into two foursomes.
 *  'flight' — Flight A together, Flight B together (each sorted by handicap)
 *  'mixed'  — two A players and two B players per group
 *  'random' — shuffled with rng (pass a fixed function in tests)
 */
export function buildGroups(mode, rng = Math.random) {
  const byCh = (a, b) => a.ch - b.ch
  const A = DEMO_ROSTER.filter(p => p.flight === 'A').sort(byCh)
  const B = DEMO_ROSTER.filter(p => p.flight === 'B').sort(byCh)
  let sets
  if (mode === 'flight') sets = [A, B]
  else if (mode === 'mixed') sets = [[A[0], A[1], B[0], B[2]], [A[2], A[3], B[1], B[3]]]
  else {
    const pool = [...DEMO_ROSTER]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t
    }
    sets = [pool.slice(0, 4), pool.slice(4)]
  }
  return sets.map((players, i) => ({ number: i + 1, teeTime: DEMO_TEE_TIMES[i], startHole: 1, players }))
}

// ─── Payouts ─────────────────────────────────────────────────────────────────
export const DEMO_ENTRY_FEE = 40
export const DEMO_PRIZES = {
  net: { A: [50, 30], B: [50, 30] },               // 1st and 2nd per flight
  ctp: { hole: 2, playerId: 'jen', distance: '6 ft 4 in', amount: 20 },
  longDrive: { hole: 3, playerId: 'tony', amount: 20 },
}
export const DEMO_POT = DEMO_ROSTER.length * DEMO_ENTRY_FEE

/** True once every player has a score on every demo hole. */
export const roundComplete = groupScores =>
  allPlayers(groupScores).every(p => DEMO_HOLES.every(h => p.gross[h.number] != null))

const cents = n => Math.round(n * 100) / 100

/** Net prizes for one flight; tied players split the places they share. */
function flightPrizes(rows, prizes) {
  const out = {}
  let i = 0
  while (i < rows.length && i < prizes.length) {
    const tied = rows.filter(r => r.netToPar === rows[i].netToPar)
    const pool = prizes.slice(i, i + tied.length).reduce((a, b) => a + b, 0)
    for (const r of tied) out[r.id] = cents(pool / tied.length)
    i += tied.length
  }
  return out
}

/** Full payout sheet. Only meaningful once roundComplete() is true. */
export function demoPayouts(groupScores) {
  const board = demoLeaderboard(groupScores)
  const skins = demoSkins(groupScores)
  const net = {
    ...flightPrizes(board.filter(r => r.flight === 'A'), DEMO_PRIZES.net.A),
    ...flightPrizes(board.filter(r => r.flight === 'B'), DEMO_PRIZES.net.B),
  }
  const skinsBy = Object.fromEntries(skins.payouts.map(w => [w.name, w.amount]))
  const rows = DEMO_ROSTER.map(p => {
    const r = {
      id: p.id, name: p.name, flight: p.flight,
      net: net[p.id] ?? 0,
      skins: skinsBy[p.name] ?? 0,
      ctp: DEMO_PRIZES.ctp.playerId === p.id ? DEMO_PRIZES.ctp.amount : 0,
      longDrive: DEMO_PRIZES.longDrive.playerId === p.id ? DEMO_PRIZES.longDrive.amount : 0,
    }
    r.total = cents(r.net + r.skins + r.ctp + r.longDrive)
    return r
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
  const paid = cents(rows.reduce((s, r) => s + r.total, 0))
  return { rows, paid, pot: DEMO_POT, skinsCarry: skins.carry }
}

// ─── Season standings ────────────────────────────────────────────────────────
/** Money list after three earlier league nights (skins excluded, as many leagues do). */
export const DEMO_SEASON = { chris: 120, dana: 160, sam: 85, jen: 140, kelly: 70, marcus: 60, ray: 95, tony: 35 }

function rankByAmount(list) {
  const sorted = [...list].sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  let last, pos = 0
  return sorted.map((r, i) => {
    if (r.amount !== last) { pos = i + 1; last = r.amount }
    return { ...r, pos }
  })
}

/** Standings before and after tonight, with how many spots each player moved. */
export function demoStandings(groupScores) {
  const payouts = demoPayouts(groupScores).rows
  const before = rankByAmount(DEMO_ROSTER.map(p => ({ id: p.id, name: p.name, flight: p.flight, amount: DEMO_SEASON[p.id] })))
  const after = rankByAmount(DEMO_ROSTER.map(p => {
    const w = payouts.find(r => r.id === p.id)
    const tonight = cents(w.net + w.ctp + w.longDrive)
    return { id: p.id, name: p.name, flight: p.flight, tonight, amount: cents(DEMO_SEASON[p.id] + tonight) }
  }))
  return after.map(r => ({ ...r, moved: before.find(b => b.id === r.id).pos - r.pos }))
}

export const formatMoney = n => (Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`)
