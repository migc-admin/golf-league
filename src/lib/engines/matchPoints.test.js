import { describe, it, expect } from 'vitest'
import {
  buildPairings,
  computeMatchStrokeMap,
  computeMatchPoints,
  computeTeamMatchPoints,
} from './matchPoints.js'

const course = {
  stroke_index: Array.from({ length: 18 }, (_, i) => i + 1),
  par_per_hole: Array.from({ length: 18 }, () => 4),
}

const makeEP = (id, ch, { flight = null, tee = null, group = 1, player = null } = {}) => ({
  player_id: id,
  course_handicap: ch,
  flight,
  tee,
  group_number: group,
  player,
})

const scoresFor = (playerId, values) =>
  values.map((gross, i) => ({ player_id: playerId, hole_number: i + 1, gross_score: gross }))

const flatScores = (playerId, gross) => scoresFor(playerId, Array.from({ length: 18 }, () => gross))

// ─── buildPairings ───────────────────────────────────────────────────────────
describe('buildPairings', () => {
  it('pairs Flight A vs Flight B by ascending handicap when both flights present', () => {
    const players = [
      makeEP('a1', 10, { flight: 'A' }),
      makeEP('a2', 5,  { flight: 'A' }),
      makeEP('b1', 12, { flight: 'B' }),
      makeEP('b2', 3,  { flight: 'B' }),
    ]
    const pairs = buildPairings(players)
    expect(pairs).toHaveLength(2)
    // Lowest CH in A (a2=5) paired with lowest CH in B (b2=3)
    expect(pairs[0].playerA.player_id).toBe('a2')
    expect(pairs[0].playerB.player_id).toBe('b2')
    expect(pairs[1].playerA.player_id).toBe('a1')
    expect(pairs[1].playerB.player_id).toBe('b1')
  })

  it('pairs top-down by handicap when no A/B split exists', () => {
    const players = [
      makeEP('p1', 20),
      makeEP('p2', 5),
      makeEP('p3', 15),
      makeEP('p4', 1),
    ]
    const pairs = buildPairings(players)
    // sorted by CH: p4(1), p2(5), p3(15), p1(20) → (p4,p2), (p3,p1)
    expect(pairs).toEqual([
      { playerA: players[3], playerB: players[1] },
      { playerA: players[2], playerB: players[0] },
    ])
  })

  it('drops the odd player out when the group has an odd count and no flights', () => {
    const players = [makeEP('p1', 1), makeEP('p2', 2), makeEP('p3', 3)]
    const pairs = buildPairings(players)
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toEqual({ playerA: players[0], playerB: players[1] })
  })
})

// ─── computeMatchStrokeMap ───────────────────────────────────────────────────
describe('computeMatchStrokeMap', () => {
  it('returns empty map when no match format is active', () => {
    const players = [makeEP('p1', 5), makeEP('p2', 10)]
    expect(computeMatchStrokeMap(players, ['stroke_play'])).toEqual({})
  })

  it('computes relative handicaps and opponent names for individual match play', () => {
    const players = [
      makeEP('p1', 5, { player: { first_name: 'Jane', last_name: 'Doe' } }),
      makeEP('p2', 10, { player: { first_name: 'John', last_name: 'Smith' } }),
    ]
    const map = computeMatchStrokeMap(players, ['match_points'])
    expect(map['p1']).toEqual({ mode: 'individual', relCH: 0, opponentName: 'John Smith' })
    expect(map['p2']).toEqual({ mode: 'individual', relCH: 5, opponentName: 'Jane Doe' })
  })

  it('computes relative handicaps for team match play using sides config', () => {
    const players = [
      makeEP('p1', 4, { group: 1 }),
      makeEP('p2', 8, { group: 1 }),
      makeEP('p3', 12, { group: 1 }),
      makeEP('p4', 16, { group: 1 }),
    ]
    const teamMatchConfig = { sides: { p1: 'A', p2: 'B', p3: 'A', p4: 'B' } }
    const map = computeMatchStrokeMap(players, ['team_match_play'], teamMatchConfig)
    expect(map['p1'].relCH).toBe(0)
    expect(map['p2'].relCH).toBe(4)
    expect(map['p3'].relCH).toBe(8)
    expect(map['p4'].relCH).toBe(12)
    expect(map['p1'].mode).toBe('team')
  })
})

// ─── computeMatchPoints ──────────────────────────────────────────────────────
describe('computeMatchPoints', () => {
  it('closes the match early and awards the win with correct USGA status', () => {
    const p1 = makeEP('p1', 0)
    const p2 = makeEP('p2', 0)
    // p1 wins holes 1-10 outright, holes 11-18 halve → closes after hole 10 (10 up, 8 remaining)
    const scores = [
      ...scoresFor('p1', [...Array(10).fill(3), ...Array(8).fill(4)]),
      ...scoresFor('p2', [...Array(10).fill(5), ...Array(8).fill(4)]),
    ]
    const { pairings, playerPoints, teamPoints, hasTeams } = computeMatchPoints([p1, p2], scores, course)
    expect(pairings).toHaveLength(1)
    const result = pairings[0]
    expect(result.winner).toBe('A')
    expect(result.matchStatus).toBe('10&8')
    expect(result.matchClosed).toBe(true)
    expect(playerPoints['p1']).toBe(1)
    expect(playerPoints['p2']).toBe(0)
    // No flights on either player → not a team context
    expect(hasTeams).toBe(false)
    expect(teamPoints).toEqual({ A: 0, B: 0 })
  })

  it('splits points 0.5/0.5 on an all-square finish through 18 holes', () => {
    const p1 = makeEP('p1', 0)
    const p2 = makeEP('p2', 0)
    const scores = [...flatScores('p1', 4), ...flatScores('p2', 4)]
    const { pairings, playerPoints } = computeMatchPoints([p1, p2], scores, course)
    expect(pairings[0].matchStatus).toBe('All Square')
    expect(pairings[0].winner).toBe('halve')
    expect(playerPoints['p1']).toBe(0.5)
    expect(playerPoints['p2']).toBe(0.5)
  })

  it('uses storedPairings when provided and tags results with match_number', () => {
    const p1 = makeEP('p1', 0)
    const p2 = makeEP('p2', 0)
    const scores = [...flatScores('p1', 3), ...flatScores('p2', 5)]
    const storedPairings = [{ player_a_id: 'p1', player_b_id: 'p2', match_number: 7 }]
    const { pairings, teamPoints, hasTeams } = computeMatchPoints([p1, p2], scores, course, storedPairings)
    expect(pairings[0].groupNumber).toBe(7)
    // storedPairings always treated as a team context (playerA side vs playerB side)
    expect(hasTeams).toBe(true)
    expect(teamPoints).toEqual({ A: 1, B: 0 })
  })

  it('aggregates flight-based team points when players carry different flights', () => {
    const a1 = makeEP('a1', 0, { flight: 'A' })
    const b1 = makeEP('b1', 0, { flight: 'B' })
    const scores = [...flatScores('a1', 3), ...flatScores('b1', 5)]
    const { teamPoints, hasTeams } = computeMatchPoints([a1, b1], scores, course)
    expect(hasTeams).toBe(true)
    expect(teamPoints).toEqual({ A: 1, B: 0 })
  })
})

// ─── computeTeamMatchPoints ──────────────────────────────────────────────────
describe('computeTeamMatchPoints', () => {
  it('scores best-ball per hole and awards the match using sides config', () => {
    const players = [
      makeEP('a1', 0, { group: 1 }),
      makeEP('a2', 0, { group: 1 }),
      makeEP('b1', 0, { group: 1 }),
      makeEP('b2', 0, { group: 1 }),
    ]
    const teamMatchConfig = { sides: { a1: 'A', a2: 'A', b1: 'B', b2: 'B' }, teamA: 'Home', teamB: 'Away' }
    const scores = [
      // Team A's best ball is always a 3 (a1); team B's best ball is always a 5 (b1)
      ...flatScores('a1', 3),
      ...flatScores('a2', 6),
      ...flatScores('b1', 5),
      ...flatScores('b2', 6),
    ]
    const { groupMatches, totalA, totalB, teamAName, teamBName } =
      computeTeamMatchPoints(players, scores, course, teamMatchConfig)
    expect(groupMatches).toHaveLength(1)
    const match = groupMatches[0]
    expect(match.winner).toBe('A')
    expect(totalA).toBe(1)
    expect(totalB).toBe(0)
    expect(teamAName).toBe('Home')
    expect(teamBName).toBe('Away')
  })

  it('falls back to flight assignment when no team_match_config sides are given', () => {
    const players = [
      makeEP('a1', 0, { flight: 'A', group: 1 }),
      makeEP('b1', 0, { flight: 'B', group: 1 }),
    ]
    const scores = [...flatScores('a1', 3), ...flatScores('b1', 5)]
    const { groupMatches, totalA } = computeTeamMatchPoints(players, scores, course)
    expect(groupMatches).toHaveLength(1)
    expect(groupMatches[0].winner).toBe('A')
    expect(totalA).toBe(1)
  })

  it('skips groups where one side has no players', () => {
    const players = [
      makeEP('a1', 0, { flight: 'A', group: 1 }),
      makeEP('a2', 0, { flight: 'A', group: 1 }),
    ]
    const scores = [...flatScores('a1', 3), ...flatScores('a2', 4)]
    const { groupMatches } = computeTeamMatchPoints(players, scores, course)
    expect(groupMatches).toHaveLength(0)
  })

  it('marks a hole pending when one team has no score yet, without closing the match', () => {
    const players = [
      makeEP('a1', 0, { flight: 'A', group: 1 }),
      makeEP('b1', 0, { flight: 'B', group: 1 }),
    ]
    // Holes 1-17 halve (keeps the match open); hole 18 missing for team B
    const scores = [...flatScores('a1', 4), ...scoresFor('b1', Array(17).fill(4))]
    const { groupMatches } = computeTeamMatchPoints(players, scores, course)
    const hole18 = groupMatches[0].holes[17]
    expect(hole18.status).toBe('pending')
    expect(groupMatches[0].holesPlayed).toBe(17)
  })
})
