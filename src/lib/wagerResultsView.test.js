import { describe, it, expect } from 'vitest'
import { computeWagerSettlement } from './wagerSettlement'
import { money, netOf, netText, makeNameResolver, matchesQuery, buildResultsModel, filterResults, oddsRows } from './wagerResultsView'

const course = { stroke_index: Array.from({ length: 18 }, (_, i) => i + 1), par_per_hole: Array.from({ length: 18 }, () => 4) }
const ep = id => ({ player_id: id, course_handicap: 0, tee: null, flight: 'A', group_number: 1, player: { first_name: id, last_name: '' } })
const flat = (id, g) => Array.from({ length: 18 }, (_, i) => ({ player_id: id, hole_number: i + 1, gross_score: g }))
const bet = (id, amount, extra) => ({ id, bettor_name: `B-${id}`, amount: String(amount), pick_1st: null, pick_2nd: null, match_pairing_id: null, pick_match: null, ...extra })
const nameOf = id => ({ p1: 'John Nothdurft', p2: 'Paul Hsieh', p3: 'Daniel Lopez', p4: 'Max Obrien' })[id] ?? id
const players = ['p1', 'p2', 'p3', 'p4'].map(ep)

describe('money and net', () => {
  it('formats dollars and cents and signs the net', () => {
    expect(money(82.5)).toBe('$82.50')
    expect(money('5')).toBe('$5.00')
    expect(netOf(82.5, 5)).toBe(77.5)
    expect(netText(77.5)).toBe('+$77.50')
    expect(netText(0)).toBe('$0.00')
    expect(netText(netOf(5, 5))).toBe('$0.00')
    expect(netText(-5)).toBe('-$5.00')
  })
  it('net equals payout minus stake without floating-point dust', () => {
    expect(netOf(14.1, 10)).toBe(4.1)
  })
})

describe('bettor names', () => {
  it('uses the member’s proper name when the typed name matches, ignoring case and spacing', () => {
    const r = makeNameResolver(['Mat Vigil', 'Jeff Carey'])
    expect(r.resolve('Mat vigil')).toBe('Mat Vigil')
    expect(r.resolve('  jeff   carey ')).toBe('Jeff Carey')
  })
  it('keeps a name as stored when there is no member and lists it', () => {
    const r = makeNameResolver(['Mat Vigil'])
    expect(r.resolve('Paguyo')).toBe('Paguyo')
    expect(r.resolve('Paguyo')).toBe('Paguyo')
    expect(r.unlinked).toEqual(['Paguyo'])
  })
})

describe('search', () => {
  it('matches part of a name, any case; a blank query matches everyone', () => {
    expect(matchesQuery('Darrick Sogabe', 'sogabe')).toBe(true)
    expect(matchesQuery('Darrick Sogabe', 'SOG')).toBe(true)
    expect(matchesQuery('Darrick Sogabe', 'hsieh')).toBe(false)
    expect(matchesQuery('Darrick Sogabe', '  ')).toBe(true)
  })
})

describe('buildResultsModel (the Playoffs example)', () => {
  // p1 and p2 tie for 1st at net 72; p3 shoots 90, p4 108. Only p1 has PLACE bettors.
  const scores = [...flat('p1', 4), ...flat('p2', 4), ...flat('p3', 5), ...flat('p4', 6)]
  const active = [
    bet('w1', 5, { bettor_name: 'Darrick Sogabe', pick_1st: 'p1' }),
    bet('w2', 5, { bettor_name: 'paul hsieh', pick_1st: 'p2' }),
    bet('w3', 10, { bettor_name: 'Daniel Lopez', pick_1st: 'p4' }),
    bet('p1', 5, { bettor_name: 'Jeff Carey', pick_2nd: 'p1' }),
    bet('p2', 5, { bettor_name: 'Kevin Taylor', pick_2nd: 'p1' }),
    bet('p3', 15, { bettor_name: 'Lost Larry', pick_2nd: 'p4' }),
  ]
  const settlement = computeWagerSettlement({ active, players, scores, pairings: [], course })
  const model = buildResultsModel({ event: { status: 'complete' }, settlement, active, nameOf, memberNames: ['Paul Hsieh', 'Darrick Sogabe', 'Jeff Carey', 'Kevin Taylor'] })

  it('shows the pool summary, bet count and final status', () => {
    expect(model.pools).toEqual({ win: 20, place: 25, match: 0, total: 45 })
    expect(model.betsLabel).toBe('6 bets settled')
    expect(model.statusLabel).toBe('Final · Settled')
  })

  it('WIN panel: a tie is "T1 at net 72", winners only, with stake, payout and signed net', () => {
    const win = model.panels.find(p => p.key === 'win')
    expect(win.pill).toBe('T1 at net 72: John Nothdurft & Paul Hsieh')
    expect(win.rows.map(r => [r.name, r.picked, r.stake, r.payout, netText(r.net)])).toEqual([
      ['Darrick Sogabe', 'John Nothdurft', 5, 10, '+$5.00'],
      ['Paul Hsieh', 'Paul Hsieh', 5, 10, '+$5.00'],
    ])
    expect(win.rows.some(r => r.name === 'Daniel Lopez')).toBe(false) // a loser never appears
  })

  it('PLACE panel: dead heat wording, all profit to the side that has bettors, losers hidden', () => {
    const place = model.panels.find(p => p.key === 'place')
    expect(place.pill).toBe('T1 at net 72: John Nothdurft & Paul Hsieh · tied for 1st (dead heat, no tiebreak)')
    expect(place.note).toContain('all profit goes to the other-place bettors')
    expect(place.rows.map(r => [r.name, r.payout, netText(r.net)])).toEqual([['Jeff Carey', 12.5, '+$7.50'], ['Kevin Taylor', 12.5, '+$7.50']])
    expect(place.rows.reduce((t, r) => t + r.payout, 0)).toBe(25)
  })

  it('every row’s net is payout minus stake, and no loser appears anywhere', () => {
    for (const p of model.panels) for (const r of p.rows) expect(r.net).toBe(netOf(r.payout, r.stake))
    const names = model.panels.flatMap(p => p.rows.map(r => r.name))
    expect(names).not.toContain('Lost Larry')
  })

  it('lists the stored names it could not match to a member', () => {
    // Daniel Lopez and Lost Larry were not in memberNames, but only displayed rows count
    expect(model.unlinkedNames).toEqual([])
    const m2 = buildResultsModel({ event: { status: 'complete' }, settlement, active, nameOf, memberNames: [] })
    expect(m2.unlinkedNames).toContain('Darrick Sogabe')
  })

  it('not final: active bets label and live status', () => {
    const live = buildResultsModel({ event: { status: 'active' }, settlement, active, nameOf })
    expect(live.betsLabel).toBe('6 active bets')
    expect(live.statusLabel).toBe('Live')
  })

  it('search keeps only the matching bettor and drops panels with no rows; clearing restores all', () => {
    const f = filterResults(model, 'sogabe')
    expect(f.panels).toHaveLength(1)
    expect(f.panels[0].rows.map(r => r.name)).toEqual(['Darrick Sogabe'])
    expect(filterResults(model, '')).toBe(model)
    expect(filterResults(model, 'nobody-here').panels).toHaveLength(0)
  })
})

describe('PLACE panel with a normal 1st and 2nd', () => {
  const scores = [...flat('p1', 4), ...flat('p2', 5), ...flat('p3', 6), ...flat('p4', 7)]
  const active = [bet('a', 10, { bettor_name: 'A', pick_2nd: 'p1' }), bet('b', 10, { bettor_name: 'B', pick_2nd: 'p2' }), bet('c', 20, { bettor_name: 'C', pick_2nd: 'p4' })]
  const settlement = computeWagerSettlement({ active, players, scores, pairings: [], course })
  const place = buildResultsModel({ event: { status: 'complete' }, settlement, active, nameOf }).panels.find(p => p.key === 'place')
  it('names 1st and 2nd with their nets and splits 50/50', () => {
    expect(place.pill).toBe('1st: John Nothdurft (net 72) · 2nd: Paul Hsieh (net 90)')
    expect(place.note).toBe('Split 50/50 between 1st- and 2nd-place bettors; stake back plus share of profit.')
    expect(place.rows.map(r => r.payout)).toEqual([20, 20])
  })
})

describe('match cards', () => {
  const pairings = [
    { id: 'm1', match_number: 1, player_a_id: 'p1', player_b_id: 'p4' }, // p1 wins comfortably
    { id: 'm2', match_number: 2, player_a_id: 'p2', player_b_id: 'p3' }, // identical scores: halved
    { id: 'm3', match_number: 3, player_a_id: 'p3', player_b_id: 'p4' }, // p3 wins, nobody backs them
  ]
  const scores = [...flat('p1', 4), ...flat('p2', 5), ...flat('p3', 5), ...flat('p4', 6)]
  const active = [
    bet('x', 5, { bettor_name: 'Spencer Higgins', match_pairing_id: 'm1', pick_match: 'p1' }),
    bet('y', 20, { bettor_name: 'Loser Lou', match_pairing_id: 'm1', pick_match: 'p4' }),
    bet('h1', 10, { bettor_name: 'Mat vigil', match_pairing_id: 'm2', pick_match: 'p2' }),
    bet('h2', 10, { bettor_name: 'Paguyo', match_pairing_id: 'm2', pick_match: 'p3' }),
    bet('n', 10, { bettor_name: 'Nobody Backs', match_pairing_id: 'm3', pick_match: 'p4' }),
  ]
  const settlement = computeWagerSettlement({ active, players, scores, pairings, course })
  const model = buildResultsModel({ event: { status: 'complete' }, settlement, active, nameOf, memberNames: ['Mat Vigil', 'Spencer Higgins'] })
  const byNum = n => model.matches.find(m => m.number === n)

  it('a decided match shows the winner pill, the pool, and only the winning bettors with a net', () => {
    const m = byNum(1)
    expect(m.a).toBe('John Nothdurft')
    expect(m.pill).toBe('Winner: John Nothdurft')
    expect(m.pool).toBe(25)
    expect(m.rows).toEqual([{ name: 'Spencer Higgins', stake: 5, payout: 25, net: 20 }])
  })

  it('a halved match refunds every stake: payout equals stake and net is $0.00', () => {
    const m = byNum(2)
    expect(m.pill).toBe('Halved · Stakes refunded')
    expect(m.halved).toBe(true)
    expect(m.rows.map(r => [r.name, r.stake, r.payout, netText(r.net)])).toEqual([['Mat Vigil', 10, 10, '$0.00'], ['Paguyo', 10, 10, '$0.00']])
  })

  it('a match whose winner nobody backed shows the winner and no rows', () => {
    const m = byNum(3)
    expect(m.pill).toBe('Winner: Daniel Lopez')
    expect(m.rows).toEqual([])
    expect(m.note).toBe('No bets on the winner.')
  })

  it('totals the match pool and skips matches that are not decided yet', () => {
    expect(model.pools.match).toBe(55)
    const pending = computeWagerSettlement({ active, players, scores: [], pairings, course })
    expect(buildResultsModel({ event: { status: 'active' }, settlement: pending, active, nameOf }).matches).toEqual([])
  })

  it('search hides match cards that have no matching bettor', () => {
    const f = filterResults(model, 'spencer')
    expect(f.matches.map(m => m.number)).toEqual([1])
    expect(f.panels).toHaveLength(0)
  })
})

describe('oddsRows', () => {
  it('shows pool ÷ amount per player, with dashes where nobody bet, matching the board', () => {
    const settlement = {
      winPool: 165, placePool: 25, allPickedIds: ['p1', 'p2'],
      winTotals: { p1: 5, p2: 40 }, placeTotals: { p1: 10 },
    }
    expect(oddsRows(settlement, id => id.toUpperCase())).toEqual([
      { name: 'P1', winAmt: 5, winOdds: '33.00x', placeAmt: 10, placeOdds: '2.50x' },
      { name: 'P2', winAmt: 40, winOdds: '4.13x', placeAmt: 0, placeOdds: '—' },
    ])
  })
})
