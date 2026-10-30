import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { computeWagerSettlement } from '../lib/wagerSettlement'
import { buildResultsModel } from '../lib/wagerResultsView'
import WagerShareCard, { WAGER_CARD_WIDTH, WAGER_FOOTER, CARD_BACKGROUND } from './WagerShareCard'

const html = el => renderToStaticMarkup(el)
const course = { stroke_index: Array.from({ length: 18 }, (_, i) => i + 1), par_per_hole: Array.from({ length: 18 }, () => 4) }
const ep = id => ({ player_id: id, course_handicap: 0, tee: null, flight: 'A', group_number: 1, player: { first_name: id, last_name: '' } })
const flat = (id, g) => Array.from({ length: 18 }, (_, i) => ({ player_id: id, hole_number: i + 1, gross_score: g }))
const bet = (id, amount, extra) => ({ id, bettor_name: `B-${id}`, amount: String(amount), pick_1st: null, pick_2nd: null, match_pairing_id: null, pick_match: null, ...extra })
const nameOf = id => ({ p1: 'John Nothdurft', p2: 'Paul Hsieh', p3: 'Daniel Lopez', p4: 'Max Obrien' })[id] ?? id
const players = ['p1', 'p2', 'p3', 'p4'].map(ep)

// John and Paul tie for 1st; only John has PLACE bettors; one match won by John.
const scores = [...flat('p1', 4), ...flat('p2', 4), ...flat('p3', 5), ...flat('p4', 6)]
const active = [
  bet('w1', 5, { bettor_name: 'Darrick Sogabe', pick_1st: 'p1' }),
  bet('w2', 5, { bettor_name: 'Paul Hsieh', pick_1st: 'p2' }),
  bet('w3', 10, { bettor_name: 'Daniel Lopez', pick_1st: 'p4' }),
  bet('a', 5, { bettor_name: 'Jeff Carey', pick_2nd: 'p1' }),
  bet('b', 5, { bettor_name: 'Kevin Taylor', pick_2nd: 'p1' }),
  bet('c', 15, { bettor_name: 'Lost Larry', pick_2nd: 'p4' }),
  bet('m', 5, { bettor_name: 'Spencer Higgins', match_pairing_id: 'm1', pick_match: 'p1' }),
  bet('n', 20, { bettor_name: 'Loser Lou', match_pairing_id: 'm1', pick_match: 'p4' }),
]
const pairings = [{ id: 'm1', match_number: 1, player_a_id: 'p1', player_b_id: 'p4' }]
const settlement = computeWagerSettlement({ active, players, scores, pairings, course })
const event = (status) => ({ name: 'Playoffs - Round 1', status, league: { name: "Mulligan's Island Golf Club" }, course: { name: 'The Golf Club of California' } })
const render = status => html(h(WagerShareCard, {
  event: event(status), eventDate: 'Sun, Oct 25, 2026', logoUrl: null,
  model: buildResultsModel({ event: event(status), settlement, active, nameOf }),
  matchCards: settlement.matchCards, playerName: nameOf,
}))

describe('WagerShareCard (final)', () => {
  const out = render('complete')

  it('has the redesigned header, pool tiles and the winning pools', () => {
    expect(out).toContain("Mulligan&#x27;s Island Golf Club")
    expect(out).toContain('Wager results')
    expect(out).toContain('Final · Settled')
    expect(out).toContain('Playoffs - Round 1 · The Golf Club of California · Sun, Oct 25, 2026')
    for (const t of ['Win pool', 'Place pool', 'Match pools', 'Total pot']) expect(out).toContain(t)
    expect(out).toContain(WAGER_FOOTER)
    expect(out).not.toContain('Find a bettor')
  })

  it('has the same numbers as the page: pools, payouts and a signed net', () => {
    expect(out).toContain('$20.00')   // WIN pool
    expect(out).toContain('$25.00')   // PLACE pool
    expect(out).toContain('$12.50')   // each PLACE winner now gets the whole profit
    expect(out).toContain('+$7.50')
    expect(out).toContain('T1 at net 72: John Nothdurft &amp; Paul Hsieh')
    expect(out).toContain('Winner: John Nothdurft')
  })

  it('is winners only and leaves out live odds once complete', () => {
    for (const loser of ['Daniel Lopez', 'Lost Larry', 'Loser Lou']) expect(out).not.toContain(`>${loser}<`)
    expect(out).not.toContain('Live odds')
    expect(out).not.toMatch(/Venmo|Cash|Ticket/i)
  })

  it('is a fixed-width card on the page background, with no old pool colors or emoji', () => {
    expect(WAGER_CARD_WIDTH).toBe(720)
    expect(out).toContain('width:720px')
    expect(out).toContain(`background:${CARD_BACKGROUND}`)
    expect(out).not.toMatch(/#2E7D4F|#2B59A0|#6B46C1/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('WagerShareCard (still being played)', () => {
  const out = render('active')
  it('shows odds and match pools but no bettor names', () => {
    expect(out).toContain('Wager odds')
    expect(out).toContain('>Live<')
    expect(out).toContain('Live odds')
    expect(out).toContain('Match pools')
    expect(out).toContain('4.00x') // John: WIN pool $20 / $5 bet on him
    for (const b of ['Darrick Sogabe', 'Jeff Carey', 'Lost Larry']) expect(out).not.toContain(b)
  })
})
