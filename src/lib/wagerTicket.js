/**
 * View-model for the Wager ticket (the bettor's receipt).
 *
 * Pure functions (no React, no Supabase). A wager row carries no ticket or batch id, and bets placed
 * together are one INSERT, so they share a created_at. A "ticket" is therefore the active bets of one
 * bettor (name, case-insensitive) whose created_at fall within a few seconds of each other, and its id
 * is derived from data that already exists: league initials + placed date + a hash of event, bettor
 * and placed time. Nothing new is stored. Settled results come from `wagerOutcomes`
 * (the same numbers the results page uses); nothing here calculates a pool or a payout.
 */
import { initialsOf } from './logoData'
import { money, netOf, netText } from './wagerResultsView'

const SAME_SUBMISSION_MS = 5000
const cents = n => Math.round(Number(n) * 100) / 100
const norm = s => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
const time = w => new Date(w.created_at).getTime()

/** FNV-1a, 32-bit, as 6 upper-case hex digits. Stable across browsers and sessions. */
function hash6(text) {
  let h = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).toUpperCase().padStart(8, '0').slice(-6)
}

/** "MI1025B7C93E" — league initials, placed month+day (UTC, so everyone derives the same id), hash. */
export function ticketIdOf({ leagueName, eventId, bettor, placedAt }) {
  const d = new Date(placedAt)
  const mmdd = `${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
  return `${initialsOf(leagueName) || 'WT'}${mmdd}${hash6(`${eventId}|${norm(bettor)}|${new Date(placedAt).toISOString()}`)}`
}

/** Group active wagers into tickets, oldest first: [{ id, bettor, placedAt, wagers }]. */
export function groupTickets(active, { eventId, leagueName }) {
  const open = new Map() // normalized name -> the ticket still accepting rows
  const tickets = []
  for (const w of [...active].sort((a, b) => time(a) - time(b))) {
    const key = norm(w.bettor_name)
    let t = open.get(key)
    if (!t || time(w) - t.last > SAME_SUBMISSION_MS) {
      t = { bettor: String(w.bettor_name).trim(), placedAt: w.created_at, wagers: [], last: time(w) }
      open.set(key, t)
      tickets.push(t)
    }
    t.wagers.push(w)
    t.last = time(w)
  }
  return tickets.map(({ last, ...t }) => ({ ...t, id: ticketIdOf({ leagueName, eventId, bettor: t.bettor, placedAt: t.placedAt }) }))
}

/** The newest ticket for a bettor name (right after they submit). */
export function latestTicketFor(tickets, bettorName) {
  const key = norm(bettorName)
  return [...tickets].reverse().find(t => norm(t.bettor) === key) ?? null
}

const GROUPS = [
  { key: 'match', title: 'Match bets' },
  { key: 'win',   title: 'Win bets' },
  { key: 'place', title: 'Place bets' },
]
const typeOf = w => (w.match_pairing_id ? 'match' : w.pick_1st ? 'win' : 'place')

const join = names => names.join(' & ')

/** The settled line for one bet, or null while it is still undecided. */
function resultOf(w, outcome, { settlement, nameOf }) {
  if (!outcome || outcome.result === 'Pending') return null
  if (outcome.result === 'Won') return { kind: 'won', pays: outcome.payout, text: `Pays ${money(outcome.payout)}` }
  if (outcome.result === 'Refund') return { kind: 'halved', text: 'Halved · stake refunded' }
  if (w.match_pairing_id) {
    const card = settlement.matchCards.find(c => c.match.id === w.match_pairing_id)
    const winner = card?.settlement?.winnerPid
    return { kind: 'lost', text: winner ? `Lost · ${nameOf(winner)} won` : 'Lost' }
  }
  const top = (settlement.winResults?.topPlayers ?? []).map(nameOf)
  if (top.length === 0) return { kind: 'lost', text: 'Lost' }
  return { kind: 'lost', text: `Lost · ${join(top)} ${top.length > 1 ? 'tied 1st' : 'won'}` }
}

/**
 * @param {{ ticket, pairings: object[], nameOf: (pid) => string, lastNameOf: (pid) => string,
 *           settlement?: object, outcomes?: object, final: boolean }} args
 * `settlement`/`outcomes` are only needed (and only used) when `final`.
 */
export function buildTicketView({ ticket, pairings = [], nameOf, lastNameOf, settlement, outcomes, final }) {
  const pairingById = new Map(pairings.map(m => [m.id, m]))
  const bets = ticket.wagers.map(w => {
    const type = typeOf(w)
    const m = w.match_pairing_id ? pairingById.get(w.match_pairing_id) : null
    return {
      id: w.id,
      type,
      context: type === 'match'
        ? `Match ${m?.match_number ?? ''} · ${lastNameOf(m?.player_a_id)} vs ${lastNameOf(m?.player_b_id)}`.replace('Match  ·', 'Match ·')
        : type === 'win' ? 'Low net overall' : 'Finishes 1st or 2nd (net)',
      pick: nameOf(type === 'match' ? w.pick_match : type === 'win' ? w.pick_1st : w.pick_2nd),
      amount: parseFloat(w.amount),
      pay: w.payment_method === 'venmo' ? 'venmo' : w.payment_method === 'cash' ? 'cash' : 'unpaid',
      result: final && settlement ? resultOf(w, outcomes?.[w.id], { settlement, nameOf }) : null,
    }
  })

  const groups = GROUPS
    .map(g => ({ ...g, bets: bets.filter(b => b.type === g.key) }))
    .filter(g => g.bets.length > 0)

  const sum = f => cents(bets.filter(f).reduce((s, b) => s + b.amount, 0))
  const cost = sum(() => true)
  const amounts = new Set(bets.map(b => b.amount))
  const totals = {
    cost,
    count: bets.length,
    each: amounts.size === 1 ? bets[0].amount : null,
    cash: sum(b => b.pay === 'cash'),
    venmo: sum(b => b.pay === 'venmo'),
    unpaid: sum(b => b.pay === 'unpaid'),
  }

  let settled = null
  if (final && settlement) {
    const payout = cents(ticket.wagers.reduce((s, w) => s + (outcomes?.[w.id]?.payout ?? 0), 0))
    const won = bets.filter(b => b.result?.kind === 'won').length
    const net = netOf(payout, cost)
    settled = { payout, won, count: bets.length, net, netLabel: netText(net) }
  }

  return { id: ticket.id, bettor: ticket.bettor, placedAt: ticket.placedAt, groups, totals, settled, final: !!final }
}
