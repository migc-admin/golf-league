import { describe, it, expect } from 'vitest'
import { computeSkinsForFlight, computeSkinsPayout } from './skins.js'

const course = {
  stroke_index: Array.from({ length: 18 }, (_, i) => i + 1),
}

const makePlayer = (id, ch) => ({
  player_id: id,
  flight: 'A',
  course_handicap: ch,
  tee: null,
})

const makeScores = (playerId, grossPerHole) =>
  grossPerHole.map((gross, i) => ({
    player_id: playerId,
    hole_number: i + 1,
    gross_score: gross,
  }))

// ─── Basic skins ─────────────────────────────────────────────────────────────
describe('computeSkinsForFlight — basic', () => {
  it('awards skin to sole low net score on a hole', () => {
    // p1 CH=0, p2 CH=0. p1 shoots 3, p2 shoots 4 on hole 1.
    const p1 = makePlayer('p1', 0)
    const p2 = makePlayer('p2', 0)
    const scores18 = (id, h1) => [
      { player_id: id, hole_number: 1, gross_score: h1 },
      ...Array.from({ length: 17 }, (_, i) => ({ player_id: id, hole_number: i + 2, gross_score: 4 })),
    ]
    const result = computeSkinsForFlight([p1, p2], [...scores18('p1', 3), ...scores18('p2', 4)], course, 'A')
    expect(result.playerSkins['p1']).toBeGreaterThan(0)
    expect(result.playerSkins['p2']).toBe(0)
  })

  it('carries over on a tie, then awards carried skin to next winner', () => {
    // Hole 1: tie (both 4). Hole 2: p1 wins with 3. Holes 3-18: p2 wins each.
    const p1 = makePlayer('p1', 0)
    const p2 = makePlayer('p2', 0)
    const makeAll = (id, h1, h2, rest) => [
      { player_id: id, hole_number: 1, gross_score: h1 },
      { player_id: id, hole_number: 2, gross_score: h2 },
      ...Array.from({ length: 16 }, (_, i) => ({ player_id: id, hole_number: i + 3, gross_score: rest })),
    ]
    const result = computeSkinsForFlight(
      [p1, p2],
      [...makeAll('p1', 4, 3, 5), ...makeAll('p2', 4, 4, 4)],
      course, 'A'
    )
    // Hole 1 tied → carryover. Hole 2 p1 wins 2 skins. Holes 3-18 p2 wins 1 each (16 skins).
    expect(result.playerSkins['p1']).toBe(2)
    expect(result.playerSkins['p2']).toBe(16)
  })

  it('returns empty result for flight with no players', () => {
    const result = computeSkinsForFlight([], [], course, 'B')
    expect(result.holes).toHaveLength(0)
    expect(result.playerSkins).toEqual({})
  })
})

// ─── Skins payout ────────────────────────────────────────────────────────────
describe('computeSkinsPayout', () => {
  it('divides pot by total skins won', () => {
    const skinsResult = { playerSkins: { p1: 3, p2: 1 } }
    const payouts = computeSkinsPayout(skinsResult, 200)
    // 4 total skins, $50/skin
    const p1 = payouts.find(p => p.playerId === 'p1')
    const p2 = payouts.find(p => p.playerId === 'p2')
    expect(p1.total).toBe(150)
    expect(p2.total).toBe(50)
    expect(p1.perSkinValue).toBe(50)
  })

  it('returns empty array when no skins won', () => {
    const skinsResult = { playerSkins: { p1: 0, p2: 0 } }
    expect(computeSkinsPayout(skinsResult, 200)).toHaveLength(0)
  })

  it('returns empty array when pot is zero', () => {
    const skinsResult = { playerSkins: { p1: 2 } }
    expect(computeSkinsPayout(skinsResult, 0)).toHaveLength(0)
  })

  it('only includes players who won skins', () => {
    const skinsResult = { playerSkins: { p1: 2, p2: 0, p3: 1 } }
    const payouts = computeSkinsPayout(skinsResult, 300)
    expect(payouts).toHaveLength(2)
    expect(payouts.map(p => p.playerId)).not.toContain('p2')
  })
})

// ─── Wraparound ──────────────────────────────────────────────────────────────
describe('computeSkinsForFlight — wraparound', () => {
  it('awards trailing carryover to first skin winner', () => {
    // p1 wins hole 1, then holes 2-18 all tie → carryover goes back to p1
    const p1 = makePlayer('p1', 0)
    const p2 = makePlayer('p2', 0)
    const scores = [
      // Hole 1: p1 wins
      { player_id: 'p1', hole_number: 1, gross_score: 3 },
      { player_id: 'p2', hole_number: 1, gross_score: 4 },
      // Holes 2-18: tie
      ...Array.from({ length: 17 }, (_, i) => ({ player_id: 'p1', hole_number: i + 2, gross_score: 4 })),
      ...Array.from({ length: 17 }, (_, i) => ({ player_id: 'p2', hole_number: i + 2, gross_score: 4 })),
    ]
    const result = computeSkinsForFlight([p1, p2], scores, course, 'A')
    // p1 won hole 1, then all 17 remaining tied → carryover wraps to p1
    expect(result.playerSkins['p1']).toBe(18)
    expect(result.carryoverToNext).toBe(false)
  })
})
