import { describe, it, expect } from 'vitest'
import {
  adjustedHandicapIndex,
  assignFlights,
  reassignFlights,
  flightSummary,
} from './flightAssignment.js'

// slope=113, rating===par ⇒ course_handicap = round(adjustedHandicapIndex)
const course = { slope: 113, rating: 72, par: 72 }

const makeEP = (id, handicapIndex, wins = 0, extra = {}) => ({
  player_id: id,
  handicap_index: handicapIndex,
  tournament_wins_prior: wins,
  ...extra,
})

// ─── adjustedHandicapIndex ───────────────────────────────────────────────────
describe('adjustedHandicapIndex', () => {
  it('leaves the index unchanged with no tournament wins', () => {
    expect(adjustedHandicapIndex(12.4, 0)).toBe(12.4)
  })

  it('multiplies by 0.90 for exactly one win', () => {
    expect(adjustedHandicapIndex(10, 1)).toBe(9)
  })

  it('multiplies by 0.80 and subtracts 1 for two or more wins', () => {
    expect(adjustedHandicapIndex(20, 2)).toBe(15)
    expect(adjustedHandicapIndex(20, 5)).toBe(15)
  })

  it('rounds to one decimal place', () => {
    expect(adjustedHandicapIndex(11.11, 1)).toBe(10) // 9.999 → 10.0
    expect(adjustedHandicapIndex(7.37, 0)).toBe(7.4)
  })
})

// ─── assignFlights ───────────────────────────────────────────────────────────
describe('assignFlights', () => {
  it('returns an empty array for no players', () => {
    expect(assignFlights([], course)).toEqual([])
    expect(assignFlights(null, course)).toEqual([])
  })

  it('splits the field in half by adjusted handicap, ascending = Flight A', () => {
    const players = [
      makeEP('p1', 10),
      makeEP('p2', 8),
      makeEP('p3', 20, 2), // adjusted: 20*0.8-1 = 15
      makeEP('p4', 16),
    ]
    const result = assignFlights(players, course)
    const byId = Object.fromEntries(result.map(r => [r.player_id, r]))
    // sorted ascending by adjusted index: p2(8), p1(10), p3(15), p4(16)
    expect(byId.p2.flight).toBe('A')
    expect(byId.p1.flight).toBe('A')
    expect(byId.p3.flight).toBe('B')
    expect(byId.p4.flight).toBe('B')
    expect(byId.p3.adjusted_handicap_index).toBe(15)
    expect(byId.p3.course_handicap).toBe(15)
  })

  it('gives Flight A the extra player when the field is odd', () => {
    const players = [makeEP('p1', 5), makeEP('p2', 10), makeEP('p3', 15)]
    const result = assignFlights(players, course)
    const counts = flightSummary(result)
    expect(counts.A).toBe(2)
    expect(counts.B).toBe(1)
  })

  it('applies the tournament-win reduction before sorting, which can change flight membership', () => {
    // p1 raw 14 (no wins) vs p2 raw 20 with 2 wins → adjusted 15. Without the
    // reduction p2 would be worse (higher) than p1; with it, p2 still trails
    // p1 but the reduction is what's under test via the adjusted value used for sorting.
    const players = [makeEP('p1', 14), makeEP('p2', 20, 2)]
    const result = assignFlights(players, course)
    const byId = Object.fromEntries(result.map(r => [r.player_id, r]))
    expect(byId.p1.adjusted_handicap_index).toBe(14)
    expect(byId.p2.adjusted_handicap_index).toBe(15)
    expect(byId.p1.flight).toBe('A')
    expect(byId.p2.flight).toBe('B')
  })
})

// ─── reassignFlights ─────────────────────────────────────────────────────────
describe('reassignFlights', () => {
  it('preserves a manually-overridden flight while recalculating its handicap fields', () => {
    const players = [
      makeEP('p1', 5, 0, { flight: 'B' }),  // manually forced into B despite low index
      makeEP('p2', 10, 0),
      makeEP('p3', 15, 0),
    ]
    const result = reassignFlights(players, course, new Set(['p1']))
    const byId = Object.fromEntries(result.map(r => [r.player_id, r]))

    // Manual player keeps its flight...
    expect(byId.p1.flight).toBe('B')
    // ...but adjusted fields are still recalculated
    expect(byId.p1.adjusted_handicap_index).toBe(5)
    expect(byId.p1.course_handicap).toBe(5)

    // Remaining auto players are assigned independently of the manual one
    expect(byId.p2.flight).toBe('A')
    expect(byId.p3.flight).toBe('B')
  })

  it('auto-assigns everyone when there are no manual overrides', () => {
    const players = [makeEP('p1', 5), makeEP('p2', 15)]
    const result = reassignFlights(players, course)
    const summary = flightSummary(result)
    expect(summary.total).toBe(2)
    expect(summary.A).toBe(1)
    expect(summary.B).toBe(1)
  })
})

// ─── flightSummary ───────────────────────────────────────────────────────────
describe('flightSummary', () => {
  it('counts A, B, and total, ignoring unassigned flights in the A/B tallies', () => {
    const players = [
      { player_id: 'p1', flight: 'A' },
      { player_id: 'p2', flight: 'A' },
      { player_id: 'p3', flight: 'B' },
      { player_id: 'p4', flight: null },
    ]
    expect(flightSummary(players)).toEqual({ A: 2, B: 1, total: 4 })
  })

  it('returns all zeros for an empty roster', () => {
    expect(flightSummary([])).toEqual({ A: 0, B: 0, total: 0 })
  })
})
