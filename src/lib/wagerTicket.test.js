import { describe, it, expect } from 'vitest'
import { groupTickets, latestTicketFor, ticketIdOf, buildTicketView } from './wagerTicket'
import { computeWagerSettlement, wagerOutcomes } from './wagerSettlement'

const W = (id, bettor, created_at, extra) => ({ id, event_id: 'e1', bettor_name: bettor, amount: 5, created_at, payment_method: 'cash', ...extra })
const ctx = { eventId: 'e1', leagueName: "Mulligan's Island Golf Club" }

describe('groupTickets', () => {
  it('groups one submission, keeps another submission and another bettor apart', () => {
    const active = [
      W('a', 'Darrick Sogabe', '2026-10-25T19:05:00.100Z', { pick_1st: 'p1' }),
      W('b', 'darrick  sogabe', '2026-10-25T19:05:00.100Z', { pick_2nd: 'p2' }),
      W('c', 'Darrick Sogabe', '2026-10-25T20:00:00.000Z', { pick_1st: 'p3' }),
      W('d', 'Tam Tran', '2026-10-25T19:05:00.100Z', { pick_1st: 'p1' }),
    ]
    const t = groupTickets(active, ctx)
    expect(t).toHaveLength(3)
    expect(t.find(x => x.bettor === 'Darrick Sogabe' && x.wagers.length === 2)).toBeTruthy()
    expect(latestTicketFor(t, 'DARRICK SOGABE').wagers.map(w => w.id)).toEqual(['c'])
  })
  it('derives a stable, readable id', () => {
    const id = ticketIdOf({ ...ctx, bettor: 'Darrick Sogabe', placedAt: '2026-10-25T19:05:00.100Z' })
    expect(id).toMatch(/^MI1025[0-9A-F]{6}$/)
    expect(id).toBe(ticketIdOf({ ...ctx, bettor: ' darrick sogabe ', placedAt: '2026-10-25T19:05:00.100Z' }))
  })
})

describe('buildTicketView', () => {
  const players = [
    { player_id: 'p1', course_handicap: 0, player: { first_name: 'Ann', last_name: 'Lee' } },
    { player_id: 'p2', course_handicap: 0, player: { first_name: 'Bo', last_name: 'Ng' } },
  ]
  const names = { p1: 'Ann Lee', p2: 'Bo Ng' }
  const last = { p1: 'Lee', p2: 'Ng' }
  const nameOf = id => names[id] ?? '—'
  const lastNameOf = id => last[id] ?? '—'
  const course = { stroke_index: Array.from({ length: 18 }, (_, i) => i + 1), par_per_hole: Array.from({ length: 18 }, () => 4) }
  const pairings = [{ id: 'm1', match_number: 1, player_a_id: 'p1', player_b_id: 'p2' }]
  const wagers = [
    W('w1', 'Cy', '2026-10-25T19:05:00Z', { pick_1st: 'p1', payment_method: 'venmo' }),
    W('w2', 'Cy', '2026-10-25T19:05:00Z', { pick_1st: 'p2' }),
    W('w3', 'Cy', '2026-10-25T19:05:00Z', { match_pairing_id: 'm1', pick_match: 'p2', amount: 10, payment_method: null }),
    W('w4', 'Di', '2026-10-25T19:06:00Z', { pick_1st: 'p1' }),
  ]
  const ticket = groupTickets(wagers, ctx).find(t => t.bettor === 'Cy')

  it('pending: groups, rows, pay tags and totals', () => {
    const v = buildTicketView({ ticket, pairings, nameOf, lastNameOf, final: false })
    expect(v.groups.map(g => [g.title, g.bets.length])).toEqual([['Match bets', 1], ['Win bets', 2]])
    expect(v.groups[0].bets[0]).toMatchObject({ context: 'Match 1 · Lee vs Ng', pick: 'Bo Ng', amount: 10, pay: 'unpaid' })
    expect(v.totals).toMatchObject({ cost: 20, count: 3, each: null, cash: 5, venmo: 5, unpaid: 10 })
    expect(v.settled).toBeNull()
    expect(v.groups[1].bets[0].result).toBeNull()
  })

  it('settled: per-bet results and payout match wagerOutcomes', () => {
    const scores = [
      ...Array.from({ length: 18 }, (_, i) => ({ player_id: 'p1', hole_number: i + 1, gross_score: 4 })),
      ...Array.from({ length: 18 }, (_, i) => ({ player_id: 'p2', hole_number: i + 1, gross_score: 5 })),
    ]
    const settlement = computeWagerSettlement({ active: wagers, players, scores, pairings, course })
    const outcomes = wagerOutcomes(settlement, wagers, 'complete')
    const v = buildTicketView({ ticket, pairings, nameOf, lastNameOf, settlement, outcomes, final: true })
    const win = v.groups.find(g => g.key === 'win').bets
    expect(win[0].result).toMatchObject({ kind: 'won' })
    expect(win[1].result).toEqual({ kind: 'lost', text: 'Lost · Ann Lee won' })
    expect(v.groups[0].bets[0].result).toEqual({ kind: 'lost', text: 'Lost · Ann Lee won' })
    const expected = (outcomes.w1.payout + outcomes.w2.payout + outcomes.w3.payout)
    expect(v.settled.payout).toBe(expected)
    expect(v.settled).toMatchObject({ won: 1, count: 3 })
    expect(v.settled.net).toBe(Math.round((expected - 20) * 100) / 100)
  })
})
