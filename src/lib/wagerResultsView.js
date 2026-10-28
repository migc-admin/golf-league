/**
 * View-model for the wager results page and its shareable PNG: winners only.
 *
 * Pure functions (no React, no Supabase). Everything here is built from the settlement the
 * board and the Excel export already use (`computeWagerSettlement`) — no pool, payout or winner
 * is calculated differently. The only new number is Net = payout − stake, derived for display.
 */

const cents = n => Math.round(Number(n) * 100) / 100

export function money(n) {
  const v = Number(n)
  return `$${(Number.isFinite(v) ? v : 0).toFixed(2)}`
}

/** Net = payout − stake, to the cent. */
export function netOf(payout, stake) {
  return cents(payout - stake)
}

/** "+$77.50" for a gain, "$0.00" for even (a halved match), "-$5.00" for a loss. */
export function netText(net) {
  const v = cents(net)
  if (v === 0) return '$0.00'
  return `${v > 0 ? '+' : '-'}${money(Math.abs(v))}`
}

const norm = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * Proper names for bettors. A wager only stores the name the bettor typed, so we match it
 * (ignoring case and extra spaces) against the member names we have. A match shows the member's
 * proper name; no match shows the stored name as-is and is recorded in `unlinked`.
 */
export function makeNameResolver(memberNames = []) {
  const members = new Map(memberNames.map(n => [norm(n), String(n).trim()]))
  const unlinked = new Set()
  return {
    resolve(stored) {
      const key = norm(stored)
      if (members.has(key)) return members.get(key)
      const raw = String(stored ?? '').trim()
      if (raw) unlinked.add(raw)
      return raw
    },
    get unlinked() { return [...unlinked].sort((a, b) => a.localeCompare(b)) },
  }
}

const join = names => names.join(' & ')

/** Case-insensitive "Find a bettor" match. A blank query matches everyone. */
export function matchesQuery(name, query) {
  const q = norm(query)
  return !q || norm(name).includes(q)
}

function rowOf(resolver, nameOf, b, withPick) {
  const row = { name: resolver.resolve(b.name), stake: b.bet, payout: b.payout, net: netOf(b.payout, b.bet) }
  if (withPick) row.picked = nameOf(b.pid)
  return row
}

function winPanel(settlement, nameOf, resolver) {
  const w = settlement.winResults
  if (!w) return null
  const names = w.topPlayers.map(nameOf)
  const tied = names.length > 1
  return {
    key: 'win',
    title: 'WIN pool',
    pool: settlement.winPool,
    pill: `${tied ? 'T1' : '1st'} at net ${w.net}: ${join(names)}`,
    note: w.matched
      ? 'Whole pool split among bettors on the winner, pro rata to stake; payout includes stake.'
      : `No WIN bets on ${join(names)}, so the pool rolls to the club.`,
    rows: w.matched ? w.bettors.map(b => rowOf(resolver, nameOf, b, true)) : [],
  }
}

function placePanel(settlement, nameOf, resolver) {
  const p = settlement.placeResults
  if (!p) return null
  if (!p.matched) {
    const names = p.topPlayers.map(nameOf)
    return {
      key: 'place', title: 'PLACE pool', pool: settlement.placePool,
      pill: `${p.twoWayTie ? 'T1' : '1st/2nd'} at net ${p.net}: ${join(names)}`,
      note: `No PLACE bets on ${join(names)}, so the pool rolls to the club.`,
      rows: [],
    }
  }
  const g1 = p.g1.players.map(nameOf)
  const g2 = p.g2.players.map(nameOf)
  // A two-way tie for 1st is a dead heat: nothing breaks it, so we say so rather than naming a rule.
  const pill = p.twoWayTie
    ? `T1 at net ${p.net}: ${join([...g1, ...g2])} · tied for 1st (dead heat, no tiebreak)`
    : `1st: ${join(g1)} (net ${p.net}) · 2nd: ${join(g2)} (net ${p.net2})`
  let note = 'Split 50/50 between 1st- and 2nd-place bettors; stake back plus share of profit.'
  if (!p.g1.hasMatch) note += ` No PLACE bets on ${join(g1)}, so all profit goes to ${p.twoWayTie ? 'the other' : '2nd'}-place bettors.`
  else if (!p.g2.hasMatch && g2.length) note += ` No PLACE bets on ${join(g2)}, so all profit goes to ${p.twoWayTie ? 'the other' : '1st'}-place bettors.`
  return {
    key: 'place', title: 'PLACE pool', pool: settlement.placePool, pill, note,
    rows: [...p.g1.bettors, ...p.g2.bettors].map(b => rowOf(resolver, nameOf, b, true)),
  }
}

function matchCardOf(card, nameOf, resolver) {
  const { match, result, settlement: s, pool } = card
  if (!s) return null // not decided yet
  const a = nameOf(match.player_a_id)
  const b = nameOf(match.player_b_id)
  let resultLine = ''
  if (result?.tiebreak && result.tiebreak.by !== 'manual' && result.winner !== 'halve') {
    const t = result.tiebreak
    resultLine = `Tiebreak: ${String(t.label).toLowerCase()} ${t.valueA} vs ${t.valueB} · Final`
  } else if (result?.tiebreak?.by === 'manual') {
    resultLine = 'Decided by admin · Final'
  } else if (result?.winner === 'halve') {
    resultLine = 'All square after 18 · Final'
  } else if (result?.matchStatus) {
    resultLine = `${result.matchStatus} · Final`
  }
  const base = { id: match.id, number: match.match_number, a, b, resultLine, pool }
  if (s.type === 'refund') {
    return { ...base, pill: 'Halved · Stakes refunded', halved: true, rows: s.bettors.map(x => rowOf(resolver, nameOf, x, false)) }
  }
  if (s.type === 'club') {
    return { ...base, pill: `Winner: ${nameOf(s.winnerPid)}`, halved: false, note: 'No bets on the winner.', rows: [] }
  }
  return { ...base, pill: `Winner: ${nameOf(s.winnerPid)}`, halved: false, rows: s.bettors.map(x => rowOf(resolver, nameOf, x, false)) }
}

/** Live odds rows (pool ÷ amount on that player), exactly as the board shows them. */
export function oddsRows(settlement, nameOf) {
  const { winPool, placePool, winTotals, placeTotals, allPickedIds } = settlement
  return allPickedIds.map(pid => {
    const winAmt = winTotals[pid] ?? 0
    const placeAmt = placeTotals[pid] ?? 0
    return {
      name: nameOf(pid),
      winAmt,
      winOdds: winAmt > 0 && winPool > 0 ? `${(winPool / winAmt).toFixed(2)}x` : '—',
      placeAmt,
      placeOdds: placeAmt > 0 && placePool > 0 ? `${(placePool / placeAmt).toFixed(2)}x` : '—',
    }
  })
}

/**
 * @param {{ event, settlement, active: object[], nameOf: (playerId) => string, memberNames?: string[] }} args
 */
export function buildResultsModel({ event, settlement, active, nameOf, memberNames = [] }) {
  const resolver = makeNameResolver(memberNames)
  const final = event?.status === 'complete'
  const matchTotal = settlement.matchPoolTotal ?? 0
  const model = {
    final,
    statusLabel: final ? 'Final · Settled' : event?.status === 'active' ? 'Live' : 'Upcoming',
    betCount: active.length,
    betsLabel: final ? `${active.length} bets settled` : `${active.length} active bets`,
    pools: { win: settlement.winPool, place: settlement.placePool, match: matchTotal, total: settlement.totalPot + matchTotal },
    panels: [winPanel(settlement, nameOf, resolver), placePanel(settlement, nameOf, resolver)].filter(Boolean),
    matches: settlement.matchCards.map(c => matchCardOf(c, nameOf, resolver)).filter(Boolean),
    odds: oddsRows(settlement, nameOf),
  }
  // Read after the rows above have been resolved.
  Object.defineProperty(model, 'unlinkedNames', { get: () => resolver.unlinked, enumerable: true })
  return model
}

/** Keep only rows whose bettor matches; drop panels and match cards left with no rows. */
export function filterResults(model, query) {
  if (!norm(query)) return model
  const keep = rows => rows.filter(r => matchesQuery(r.name, query))
  return {
    ...model,
    panels: model.panels.map(p => ({ ...p, rows: keep(p.rows) })).filter(p => p.rows.length > 0),
    matches: model.matches.map(m => ({ ...m, rows: keep(m.rows) })).filter(m => m.rows.length > 0),
  }
}
