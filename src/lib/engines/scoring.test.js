import { describe, it, expect } from 'vitest'
import {
  computeCourseHandicap,
  getStrokesOnHole,
  netScore,
  computeLeaderboards,
} from './scoring.js'

// ─── Course Handicap ──────────────────────────────────────────────────────────
describe('computeCourseHandicap', () => {
  it('computes standard USGA course handicap', () => {
    // HI=14.2, Slope=113, Rating=72, Par=72 → (14.2 * 113/113) + (72-72) = 14
    expect(computeCourseHandicap(14.2, 113, 72, 72)).toBe(14)
  })

  it('computes with slope adjustment', () => {
    // HI=10, Slope=130, Rating=73, Par=72 → round((10*130/113) + 1) = round(12.5) = 13
    expect(computeCourseHandicap(10, 130, 73, 72)).toBe(13)
  })

  it('returns 0 for scratch golfer on standard course', () => {
    expect(computeCourseHandicap(0, 113, 72, 72)).toBe(0)
  })

  it('returns negative for plus handicap', () => {
    // HI=-2, Slope=113, Rating=72, Par=72 → -2
    expect(computeCourseHandicap(-2, 113, 72, 72)).toBe(-2)
  })
})

// ─── Strokes on Hole ─────────────────────────────────────────────────────────
describe('getStrokesOnHole', () => {
  it('gives stroke on hardest holes for 1-handicap player', () => {
    // CH=1: gets 1 stroke only on SI=1
    expect(getStrokesOnHole(1, 1)).toBe(1)
    expect(getStrokesOnHole(1, 2)).toBe(0)
    expect(getStrokesOnHole(1, 18)).toBe(0)
  })

  it('gives stroke on holes with SI <= CH for 9-handicap player', () => {
    // CH=9: gets 1 stroke on holes SI 1-9
    expect(getStrokesOnHole(9, 9)).toBe(1)
    expect(getStrokesOnHole(9, 10)).toBe(0)
  })

  it('gives 2 strokes per hole for 19-handicap player on hardest hole', () => {
    // CH=19: full=1, remainder=1 → SI=1 gets 2 strokes, SI=2 gets 1 stroke
    expect(getStrokesOnHole(19, 1)).toBe(2)
    expect(getStrokesOnHole(19, 2)).toBe(1)
    // SI=18 (easiest): full=1 → still gets 1 stroke (remainder only affects SI≤1)
    expect(getStrokesOnHole(19, 18)).toBe(1)
  })

  it('subtracts strokes for plus handicap on easiest holes', () => {
    // CH=-1: deducts 1 stroke on the easiest hole (SI=18), 0 elsewhere
    expect(getStrokesOnHole(-1, 18)).toBe(-1)
    expect(getStrokesOnHole(-1, 17)).toBeCloseTo(0)  // -0 edge case
    expect(getStrokesOnHole(-1, 1)).toBeCloseTo(0)
  })

  it('gives 0 strokes for scratch', () => {
    for (let si = 1; si <= 18; si++) {
      expect(getStrokesOnHole(0, si)).toBe(0)
    }
  })
})

// ─── Net Score ───────────────────────────────────────────────────────────────
describe('netScore', () => {
  it('gross 5 on par 4, SI=1, CH=18 → net 4', () => {
    // CH=18 gives 1 stroke on all 18 holes
    expect(netScore(5, 18, 1)).toBe(4)
  })

  it('gross 4 on par 4, SI=10, CH=9 → net 4 (no stroke on SI>9)', () => {
    expect(netScore(4, 9, 10)).toBe(4)
  })

  it('gross 3 on par 3, SI=1, CH=1 → net 2', () => {
    expect(netScore(3, 1, 1)).toBe(2)
  })
})

// ─── computeLeaderboards ─────────────────────────────────────────────────────
describe('computeLeaderboards', () => {
  // Minimal course: 18 holes, par 4 each, SI = 1..18
  const course = {
    par_per_hole: Array(18).fill(4),
    stroke_index: Array.from({ length: 18 }, (_, i) => i + 1),
  }

  // Two Flight A players with 18 scores each
  const makeScores = (playerId, gross) =>
    Array.from({ length: 18 }, (_, i) => ({
      player_id: playerId,
      hole_number: i + 1,
      gross_score: gross,
      putts: 2,
    }))

  const playerA1 = { player_id: 'p1', flight: 'A', course_handicap: 10, is_guest: false, player: { first_name: 'Alice', last_name: 'A' } }
  const playerA2 = { player_id: 'p2', flight: 'A', course_handicap: 5,  is_guest: false, player: { first_name: 'Bob',   last_name: 'B' } }

  const scores = [
    ...makeScores('p1', 5),  // gross 90, net 80 (10 strokes given)
    ...makeScores('p2', 5),  // gross 90, net 85 (5 strokes given)
  ]

  it('ranks players by net score ascending', () => {
    const lb = computeLeaderboards([playerA1, playerA2], scores, course)
    expect(lb.full.A[0].player_id).toBe('p1')  // lower net wins
    expect(lb.full.A[0].rank).toBe(1)
    expect(lb.full.A[1].rank).toBe(2)
  })

  it('only includes players with holesCompleted === 18', () => {
    const partialScores = makeScores('p1', 5).slice(0, 9)  // only 9 holes
    const lb = computeLeaderboards([playerA1, playerA2], [...partialScores, ...makeScores('p2', 5)], course)
    // p1 only has 9 holes — excluded from full leaderboard
    expect(lb.full.A.find(p => p.player_id === 'p1')).toBeUndefined()
    expect(lb.full.A.find(p => p.player_id === 'p2')).toBeDefined()
  })

  it('assigns tied rank correctly', () => {
    // Same gross, same CH → same net → tied
    const tied1 = { ...playerA1, player_id: 't1', course_handicap: 10 }
    const tied2 = { ...playerA2, player_id: 't2', course_handicap: 10 }
    const lb = computeLeaderboards(
      [tied1, tied2],
      [...makeScores('t1', 5), ...makeScores('t2', 5)],
      course
    )
    expect(lb.full.A[0].rank).toBe(1)
    expect(lb.full.A[1].rank).toBe(1)  // both rank 1
  })

  it('excludes guest players from scoring', () => {
    const guest = { player_id: 'g1', flight: 'A', course_handicap: 0, is_guest: true, player: null }
    const lb = computeLeaderboards([playerA1, guest], [...makeScores('p1', 4), ...makeScores('g1', 3)], course)
    expect(lb.full.A.find(p => p.player_id === 'g1')).toBeUndefined()
  })

  it('splits flights correctly', () => {
    const playerB = { player_id: 'p3', flight: 'B', course_handicap: 8, is_guest: false, player: null }
    const lb = computeLeaderboards(
      [playerA1, playerB],
      [...makeScores('p1', 5), ...makeScores('p3', 5)],
      course
    )
    expect(lb.full.A.find(p => p.player_id === 'p1')).toBeDefined()
    expect(lb.full.B.find(p => p.player_id === 'p3')).toBeDefined()
    expect(lb.full.A.find(p => p.player_id === 'p3')).toBeUndefined()
    expect(lb.full.B.find(p => p.player_id === 'p1')).toBeUndefined()
  })
})
