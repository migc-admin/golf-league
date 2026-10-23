import { describe, it, expect } from 'vitest'
import { computeWagerSettlement, wagerOutcomes } from './wagerSettlement'

const course = {
  stroke_index: Array.from({ length: 18 }, (_, i) => i + 1),
  par_per_hole: Array.from({ length: 18 }, () => 4),
}
const ep = (id, ch = 0) => ({ player_id: id, course_handicap: ch, tee: null, flight: 'A', group_number: 1, player: { first_name: id, last_name: '' } })
const flat = (id, gross) => Array.from({ length: 18 }, (_, i) => ({ player_id: id, hole_number: i + 1, gross_score: gross }))
const bet = (id, amount, extra) => ({ id, bettor_name: `B-${id}`, amount: String(amount), pick_1st: null, pick_2nd: null, match_pairing_id: null, pick_match: null, ...extra })
const settle = (args) => computeWagerSettlement({ players: [], scores: [], pairings: [], course, ...args })

// p1 shoots 72, p2 and p3 tie at 90, p4 shoots 108
const players = [ep('p1'), ep('p2'), ep('p3'), ep('p4')]
const scores = [...flat('p1', 4), ...flat('p2', 5), ...flat('p3', 5), ...flat('p4', 6)]

describe('WIN pool', () => {
  it('splits the whole WIN pool among bettors on the lowest net, pro rata to stake', () => {
    const active = [bet('a', 10, { pick_1st: 'p1' }), bet('b', 20, { pick_1st: 'p2' }), bet('c', 30, { pick_1st: 'p1' })]
    const s = settle({ active, players, scores })
    expect(s.winPool).toBe(60)
    const pay = Object.fromEntries(s.winResults.bettors.map(b => [b.id, b.payout]))
    expect(pay).toEqual({ a: 15, c: 45 }) // 10/40 and 30/40 of $60
  })

  it('rolls the pool to the club when nobody backed the winner', () => {
    const s = settle({ active: [bet('a', 10, { pick_1st: 'p2' })], players, scores })
    expect(s.winResults.matched).toBe(false)
  })

  it('has no result until scores exist', () => {
    expect(settle({ active: [bet('a', 10, { pick_1st: 'p1' })], players }).winResults).toBeNull()
  })
})

describe('PLACE pool', () => {
  it('splits profit 50/50 between the 1st- and 2nd-place groups and returns stakes', () => {
    const active = [
      bet('a', 10, { pick_2nd: 'p1' }),   // 1st place
      bet('b', 10, { pick_2nd: 'p2' }),   // tied 2nd
      bet('c', 20, { pick_2nd: 'p4' }),   // loses
    ]
    const s = settle({ active, players, scores })
    expect(s.placePool).toBe(40)
    // profit = 40 - (10 + 10) = 20; each group gets 10 on top of its stake
    expect(s.placeResults.g1.bettors.map(b => [b.id, b.payout])).toEqual([['a', 20]])
    expect(s.placeResults.g2.bettors.map(b => [b.id, b.payout])).toEqual([['b', 20]])
  })
})

describe('MATCH pools', () => {
  const pairings = [
    { id: 'm1', match_number: 1, player_a_id: 'p1', player_b_id: 'p4' }, // p1 wins comfortably
    { id: 'm2', match_number: 2, player_a_id: 'p2', player_b_id: 'p3' }, // identical scores: halved
  ]
  it('pays the winning side the whole match pool, pro rata', () => {
    const active = [
      bet('x', 10, { match_pairing_id: 'm1', pick_match: 'p1' }),
      bet('y', 30, { match_pairing_id: 'm1', pick_match: 'p4' }),
    ]
    const s = settle({ active, players, scores, pairings })
    const card = s.matchCards.find(c => c.match.id === 'm1')
    expect(card.pool).toBe(40)
    expect(card.settlement.type).toBe('paid')
    expect(card.settlement.bettors.map(b => [b.id, b.payout])).toEqual([['x', 40]])
  })

  it('refunds every stake when the match is halved', () => {
    const active = [
      bet('x', 10, { match_pairing_id: 'm2', pick_match: 'p2' }),
      bet('y', 5, { match_pairing_id: 'm2', pick_match: 'p3' }),
    ]
    const s = settle({ active, players, scores, pairings })
    const card = s.matchCards.find(c => c.match.id === 'm2')
    expect(card.settlement.type).toBe('refund')
  })

  it('rolls the pool to the club when nobody backed the winner', () => {
    const active = [bet('y', 30, { match_pairing_id: 'm1', pick_match: 'p4' })]
    const s = settle({ active, players, scores, pairings })
    expect(s.matchCards.find(c => c.match.id === 'm1').settlement.type).toBe('club')
  })
})

describe('wagerOutcomes', () => {
  const pairings = [
    { id: 'm1', match_number: 1, player_a_id: 'p1', player_b_id: 'p4' },
    { id: 'm2', match_number: 2, player_a_id: 'p2', player_b_id: 'p3' },
  ]
  const active = [
    bet('win-yes', 10, { pick_1st: 'p1' }),
    bet('win-no', 10, { pick_1st: 'p4' }),
    bet('place-yes', 10, { pick_2nd: 'p1' }),
    bet('m-win', 10, { match_pairing_id: 'm1', pick_match: 'p1' }),
    bet('m-lose', 30, { match_pairing_id: 'm1', pick_match: 'p4' }),
    bet('m-halve', 10, { match_pairing_id: 'm2', pick_match: 'p2' }),
  ]

  it('labels every bet and carries the payout', () => {
    const s = settle({ active, players, scores, pairings })
    const o = wagerOutcomes(s, active, 'complete')
    expect(o['win-yes']).toMatchObject({ result: 'Won', provisional: false })
    expect(o['win-yes'].payout).toBe(20)           // WIN pool is $10 + $10; the only winning bet takes all of it
    expect(o['win-no']).toMatchObject({ result: 'Lost', payout: 0 })
    expect(o['m-win']).toMatchObject({ result: 'Won', payout: 40 })
    expect(o['m-lose']).toMatchObject({ result: 'Lost', payout: 0 })
    expect(o['m-halve']).toMatchObject({ result: 'Refund', payout: 10 })
  })

  it('marks WIN/PLACE results provisional until the event is complete, but not match results', () => {
    const s = settle({ active, players, scores, pairings })
    const o = wagerOutcomes(s, active, 'active')
    expect(o['win-yes'].provisional).toBe(true)
    expect(o['m-win'].provisional).toBe(false)
  })

  it('is Pending for everything when there are no scores', () => {
    const s = settle({ active, players, scores: [], pairings })
    const o = wagerOutcomes(s, active, 'upcoming')
    for (const w of active) expect(o[w.id].result).toBe('Pending')
  })
})

describe('MATCH pools when the event requires a winner', () => {
  const tiePairing = id => [{ id: 'm1', match_number: 1, player_a_id: 'p1', player_b_id: 'p4', ...(id ? { winner_player_id: id } : {}) }]
  const betsOn = [
    bet('x', 10, { match_pairing_id: 'm1', pick_match: 'p1' }),
    bet('y', 30, { match_pairing_id: 'm1', pick_match: 'p4' }),
  ]
  // p1 and p4 finish all square on holes (p1 wins hole 1, p4 wins hole 18); p4 has the lower net total (71 v 72)
  const tieScores = [
    ...Array.from({ length: 18 }, (_, i) => ({ player_id: 'p1', hole_number: i + 1, gross_score: i === 0 ? 3 : i === 17 ? 5 : 4 })),
    ...Array.from({ length: 18 }, (_, i) => ({ player_id: 'p4', hole_number: i + 1, gross_score: i === 0 ? 4 : i === 17 ? 3 : 4 })),
  ]
  // dead even on every hole: nothing to break the tie
  const evenScores = [...flat('p1', 4), ...flat('p4', 4)]
  const two = [ep('p1'), ep('p4')]
  const full = { requireWinner: true, preset: 'full' }

  it('refunds a tied match when ties are allowed (default)', () => {
    const s = settle({ active: betsOn, players: two, scores: tieScores, pairings: tiePairing() })
    expect(s.matchCards[0].settlement.type).toBe('refund')
  })

  it('pays the tiebreak winner the whole match pool', () => {
    const s = settle({ active: betsOn, players: two, scores: tieScores, pairings: tiePairing(), matchRules: full })
    const card = s.matchCards[0]
    expect(card.settlement.type).toBe('paid')
    expect(card.settlement.winnerPid).toBe('p4')
    expect(card.settlement.bettors.map(b => [b.id, b.payout])).toEqual([['y', 40]])   // $10 + $30 pool to the p4 backer
  })

  it('keeps bets Pending until a tie that nothing can break gets a manual winner', () => {
    const undecided = settle({ active: betsOn, players: two, scores: evenScores, pairings: tiePairing(), matchRules: full })
    expect(undecided.matchCards[0].settlement).toBeNull()
    expect(wagerOutcomes(undecided, betsOn, 'active')).toMatchObject({ x: { result: 'Pending' }, y: { result: 'Pending' } })

    const decided = settle({ active: betsOn, players: two, scores: evenScores, pairings: tiePairing('p1'), matchRules: full })
    expect(decided.matchCards[0].settlement.type).toBe('paid')
    expect(wagerOutcomes(decided, betsOn, 'active')).toMatchObject({ x: { result: 'Won', payout: 40 }, y: { result: 'Lost', payout: 0 } })
  })

  it("an admin's manual winner overrides the tiebreaker", () => {
    const s = settle({ active: betsOn, players: two, scores: tieScores, pairings: tiePairing('p1'), matchRules: full })   // tiebreak says p4
    expect(s.matchCards[0].settlement.winnerPid).toBe('p1')
  })
})
