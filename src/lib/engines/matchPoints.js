/**
 * Match Points Engine
 * Pure functions — no side effects, no Supabase calls.
 *
 * Supports two formats:
 *   match_points — individual match play within groups (pairs by handicap order)
 *   ryder_cup    — team match play, Flight A vs Flight B
 *
 * Scoring per hole:
 *   Win  = 1.0 point
 *   Halve = 0.5 points each
 *   Loss = 0 points
 */

import { getStrokesOnHole } from './scoring'

/**
 * Pair players within a group for match play.
 * A players sorted by course_handicap asc vs B players sorted asc.
 * If uneven, unpaired players are tracked separately.
 *
 * @param {Array} groupPlayers — event_players with player attached
 * @returns {Array<{playerA, playerB}>}
 */
function buildPairings(groupPlayers) {
  const flightA = [...groupPlayers.filter(ep => ep.flight === 'A')]
    .sort((a, b) => (a.course_handicap ?? 99) - (b.course_handicap ?? 99))
  const flightB = [...groupPlayers.filter(ep => ep.flight === 'B')]
    .sort((a, b) => (a.course_handicap ?? 99) - (b.course_handicap ?? 99))

  const pairs = []
  const count = Math.max(flightA.length, flightB.length)
  for (let i = 0; i < count; i++) {
    if (flightA[i] && flightB[i]) {
      pairs.push({ playerA: flightA[i], playerB: flightB[i] })
    }
  }
  return pairs
}

/**
 * Compute match play result for a single pairing across all entered holes.
 *
 * @param {Object} playerA     — event_player record (flight A)
 * @param {Object} playerB     — event_player record (flight B)
 * @param {Array}  allScores   — all scores for the event
 * @param {number[]} strokeIndexes — 18-element array
 * @param {number[]} parPerHole    — 18-element array
 * @returns {Object}  matchResult
 */
function computePairingResult(playerA, playerB, allScores, strokeIndexes, parPerHole) {
  const scoresA = Object.fromEntries(
    allScores.filter(s => s.player_id === playerA.player_id).map(s => [s.hole_number, s])
  )
  const scoresB = Object.fromEntries(
    allScores.filter(s => s.player_id === playerB.player_id).map(s => [s.hole_number, s])
  )

  let pointsA = 0
  let pointsB = 0
  const holes = []

  for (let h = 1; h <= 18; h++) {
    const sA = scoresA[h]
    const sB = scoresB[h]
    if (!sA || !sB) {
      holes.push({ hole: h, status: 'pending', pointsA: null, pointsB: null, netA: null, netB: null })
      continue
    }

    const si  = strokeIndexes[h - 1]
    const par = parPerHole[h - 1]

    const strokesA = getStrokesOnHole(playerA.course_handicap ?? 0, si)
    const strokesB = getStrokesOnHole(playerB.course_handicap ?? 0, si)
    const netA = sA.gross_score - strokesA
    const netB = sB.gross_score - strokesB

    let holePointsA, holePointsB, result
    if (netA < netB)       { holePointsA = 1; holePointsB = 0; result = 'A' }
    else if (netB < netA)  { holePointsA = 0; holePointsB = 1; result = 'B' }
    else                   { holePointsA = 0.5; holePointsB = 0.5; result = 'halve' }

    pointsA += holePointsA
    pointsB += holePointsB

    holes.push({
      hole:     h,
      status:   'played',
      result,
      netA,
      netB,
      par,
      pointsA:  holePointsA,
      pointsB:  holePointsB,
    })
  }

  const holesPlayed = holes.filter(h => h.status === 'played').length
  let matchStatus
  if (pointsA > pointsB)  matchStatus = 'A leads'
  else if (pointsB > pointsA) matchStatus = 'B leads'
  else                        matchStatus = 'All square'

  return {
    playerA,
    playerB,
    pointsA,
    pointsB,
    holesPlayed,
    matchStatus,
    winner: holesPlayed === 18 ? (pointsA > pointsB ? 'A' : pointsB > pointsA ? 'B' : 'halve') : null,
    holes,
  }
}

/**
 * Compute match play results for an entire event.
 * Groups players by group_number, pairs A vs B within each group.
 *
 * @param {Array}  eventPlayers
 * @param {Array}  allScores
 * @param {Object} course
 * @returns {{ pairings, playerPoints, teamPoints }}
 */
export function computeMatchPoints(eventPlayers, allScores, course) {
  const { stroke_index: strokeIndexes, par_per_hole: parPerHole } = course

  // Group players
  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number ?? 0
    if (!groups[g]) groups[g] = []
    groups[g].push(ep)
  }

  const pairings = []
  const playerPoints = {}  // playerId → total points

  for (const [groupNum, members] of Object.entries(groups)) {
    const pairs = buildPairings(members)
    for (const { playerA, playerB } of pairs) {
      const result = computePairingResult(playerA, playerB, allScores, strokeIndexes, parPerHole)
      result.groupNumber = parseInt(groupNum, 10)
      pairings.push(result)

      playerPoints[playerA.player_id] = (playerPoints[playerA.player_id] ?? 0) + result.pointsA
      playerPoints[playerB.player_id] = (playerPoints[playerB.player_id] ?? 0) + result.pointsB
    }
  }

  // Team totals (Ryder Cup style: Flight A vs Flight B)
  let teamA = 0, teamB = 0
  for (const ep of eventPlayers) {
    const pts = playerPoints[ep.player_id] ?? 0
    if (ep.flight === 'A') teamA += pts
    else if (ep.flight === 'B') teamB += pts
  }

  // Individual rankings
  const ranked = eventPlayers
    .map(ep => ({
      ...ep,
      points: playerPoints[ep.player_id] ?? 0,
    }))
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  const rankedA = ranked.filter(p => p.flight === 'A').map((p, i) => ({ ...p, rank: i + 1 }))
  const rankedB = ranked.filter(p => p.flight === 'B').map((p, i) => ({ ...p, rank: i + 1 }))

  return {
    pairings,
    playerPoints,
    teamPoints: { A: teamA, B: teamB },
    ranked:     { A: rankedA, B: rankedB, overall: ranked },
  }
}

/**
 * Convenience: just get the team Ryder Cup score.
 * Returns { teamA, teamB, leader, margin, holesPlayed }
 */
export function computeRyderCupScore(eventPlayers, allScores, course) {
  const { teamPoints, pairings } = computeMatchPoints(eventPlayers, allScores, course)
  const holesPlayed = pairings.reduce((acc, p) => acc + p.holesPlayed, 0)

  let leader
  const diff = teamPoints.A - teamPoints.B
  if (diff > 0)       leader = 'Flight A'
  else if (diff < 0)  leader = 'Flight B'
  else                leader = 'All square'

  return {
    teamA:      teamPoints.A,
    teamB:      teamPoints.B,
    leader,
    margin:     Math.abs(diff),
    holesPlayed,
  }
}
