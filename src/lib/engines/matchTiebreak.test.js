import { describe, it, expect } from 'vitest'
import { computeMatchPoints, normalizeMatchRules, TIEBREAK_PRESETS } from './matchPoints.js'

const course = {
  stroke_index: Array.from({ length: 18 }, (_, i) => i + 1),
  par_per_hole: Array.from({ length: 18 }, () => 4),
}
const ep = id => ({ player_id: id, course_handicap: 0, flight: null, tee: null, group_number: 1, player: { first_name: id, last_name: '' } })
const players = [ep('a'), ep('b')]
const pairing = (extra = {}) => ({ id: 'm1', match_number: 1, player_a_id: 'a', player_b_id: 'b', ...extra })

// Build 18 hole scores for a and b from a base of 4s with overrides { holeNumber: [grossA, grossB] }
function scoresWith(overrides) {
  const out = []
  for (let h = 1; h <= 18; h++) {
    const [ga, gb] = overrides[h] ?? [4, 4]
    out.push({ player_id: 'a', hole_number: h, gross_score: ga }, { player_id: 'b', hole_number: h, gross_score: gb })
  }
  return out
}
const run = (overrides, rules, pairingExtra) =>
  computeMatchPoints(players, scoresWith(overrides), course, [pairing(pairingExtra)], rules).pairings[0]
const FULL = { requireWinner: true, preset: 'full' }

// All square on holes won (A takes hole 1, B takes hole 18) but B has the lower net total: 72 vs 71.
const NET_TOTAL_B = { 1: [3, 4], 18: [5, 3] }
// All square, equal net total (72 v 72), but B is lower over the back 9 (35 v 37).
const BACK9_B = { 1: [3, 5], 18: [5, 3] }
// All square, equal through the last 6 and last 3, B lower only on hole 18.
const HOLE18_B = { 17: [3, 4], 18: [5, 4] }
// Dead even on every hole.
const DEAD_EVEN = {}

describe('ties without the rule', () => {
  it('still halve (1/2 point each) when the event does not require a winner', () => {
    const r = run(NET_TOTAL_B, null)
    expect(r.winner).toBe('halve')
    expect([r.pointsA, r.pointsB]).toEqual([0.5, 0.5])
    expect(r.tiedAfter18).toBe(true)
    expect(r.needsWinner).toBe(false)
  })
})

describe('automatic tiebreakers', () => {
  it('uses net total first', () => {
    const r = run(NET_TOTAL_B, FULL)
    expect(r.winner).toBe('B')
    expect(r.tiebreak).toMatchObject({ by: 'net_total', netA: 72, netB: 71 })
    expect([r.pointsA, r.pointsB]).toEqual([0, 1])
    expect(r.matchStatus).toBe('Tiebreak: Net total')
  })

  it('falls through to the back 9 when net totals are equal', () => {
    const r = run(BACK9_B, FULL)
    expect(r.winner).toBe('B')
    expect(r.tiebreak).toMatchObject({ by: 'back9', netA: 37, netB: 35 })
  })

  it('falls through to the last hole when everything before it is equal', () => {
    const r = run(HOLE18_B, FULL)
    expect(r.winner).toBe('B')
    expect(r.tiebreak.by).toBe('hole18')
  })

  it('the countback preset skips net total', () => {
    const r = run(NET_TOTAL_B, { requireWinner: true, preset: 'countback' })
    // back 9: A 4*8+5 = 37 vs B 4*8+3 = 35, so it is decided on the back 9
    expect(r.tiebreak.by).toBe('back9')
    expect(r.winner).toBe('B')
  })

  it('leaves the match undecided when every tiebreaker is level', () => {
    const r = run(DEAD_EVEN, FULL)
    expect(r.winner).toBeNull()
    expect(r.needsWinner).toBe(true)
    expect([r.pointsA, r.pointsB]).toEqual([0, 0])
    expect(r.matchStatus).toBe('Tied — winner needed')
  })
})

describe('manual winner', () => {
  it('beats the automatic tiebreaker', () => {
    const r = run(NET_TOTAL_B, FULL, { winner_player_id: 'a' })   // tiebreak says B, admin says A
    expect(r.winner).toBe('A')
    expect(r.tiebreak.by).toBe('manual')
    expect([r.pointsA, r.pointsB]).toEqual([1, 0])
  })

  it('resolves an otherwise undecided match', () => {
    const r = run(DEAD_EVEN, FULL, { winner_player_id: 'b' })
    expect(r.winner).toBe('B')
    expect(r.needsWinner).toBe(false)
  })

  it('works with the "no automatic tiebreaker" preset', () => {
    const rules = { requireWinner: true, preset: 'manual' }
    expect(run(NET_TOTAL_B, rules).needsWinner).toBe(true)
    expect(run(NET_TOTAL_B, rules, { winner_player_id: 'a' }).winner).toBe('A')
  })

  it('applies to a tied match even if the event does not require winners', () => {
    expect(run(DEAD_EVEN, null, { winner_player_id: 'a' }).winner).toBe('A')
  })

  it('is ignored when the match was decided on the course', () => {
    const r = run({ 1: [3, 4], 2: [3, 4], 3: [3, 4] }, FULL, { winner_player_id: 'b' })  // A is 3 up through 18
    expect(r.winner).toBe('A')
    expect(r.tiebreak).toBeNull()
  })

  it('ignores a winner id that is not one of the two players', () => {
    expect(run(DEAD_EVEN, FULL, { winner_player_id: 'zzz' }).needsWinner).toBe(true)
  })
})

describe('normalizeMatchRules', () => {
  it('is off by default', () => {
    expect(normalizeMatchRules(null)).toEqual({ requireWinner: false, tiebreak: [] })
    expect(normalizeMatchRules({ requireWinner: false, preset: 'full' }).requireWinner).toBe(false)
  })
  it('expands a preset and drops unknown steps', () => {
    expect(normalizeMatchRules({ requireWinner: true, preset: 'countback' }).tiebreak).toEqual(TIEBREAK_PRESETS.countback.steps)
    expect(normalizeMatchRules({ requireWinner: true, tiebreak: ['back9', 'nonsense'] }).tiebreak).toEqual(['back9'])
  })
})
