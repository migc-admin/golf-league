/**
 * Match Points Engine
 * Pure functions — no side effects, no Supabase calls.
 *
 * Supports two formats:
 *   match_points — individual match play within groups (pairs by handicap order)
 *   ryder_cup    — team match play, Flight A vs Flight B
 *
 * USGA match play scoring:
 *   Win a hole  → go 1 UP
 *   Halve a hole → status unchanged
 *   Lose a hole → go 1 DOWN
 *   Match ends when lead > holes remaining (e.g. 3&2, 1 UP, All Square)
 */

/**
 * Format a USGA match play status string.
 * upBy > 0 means A leads, upBy < 0 means B leads.
 * holesRemaining = 18 - holesPlayed (before this hole) OR 0 if match is done.
 */
function matchStatusLabel(upBy, holesPlayed, closed = false) {
  const remaining = 18 - holesPlayed
  if (upBy === 0) return 'All Square'
  const leader = upBy > 0 ? 'A' : 'B'
  const margin = Math.abs(upBy)
  if (closed) {
    // Match ended early (e.g. 3&2)
    if (remaining > 0) return `${margin}&${remaining}`
    return `${margin} UP`  // won on 18th
  }
  if (holesPlayed === 18) {
    return `${margin} UP`
  }
  // Dormie: lead equals remaining holes
  if (margin === remaining) return `Dormie ${margin} (${leader})`
  return `${margin} UP (${leader})`
}

import { getStrokesOnHole } from './scoring'

/**
 * Pair players within a group for match play.
 *
 * Strategy:
 *   1. If the group has both Flight A and Flight B players → pair A vs B by handicap order (original behavior)
 *   2. Otherwise (same flight, mixed, or no flights) → pair by handicap order top-down (1v2, 3v4, …)
 *
 * @param {Array} groupPlayers — event_players with player attached
 * @returns {Array<{playerA, playerB}>}
 */
function buildPairings(groupPlayers) {
  const hasA = groupPlayers.some(ep => ep.flight === 'A')
  const hasB = groupPlayers.some(ep => ep.flight === 'B')

  if (hasA && hasB) {
    // Classic A vs B cross-flight pairing
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

  // Same-flight or no-flight: pair by handicap order (lowest vs next, etc.)
  const sorted = [...groupPlayers].sort((a, b) => (a.course_handicap ?? 99) - (b.course_handicap ?? 99))
  const pairs = []
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push({ playerA: sorted[i], playerB: sorted[i + 1] })
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

  // upBy > 0 = A leads, upBy < 0 = B leads
  let upBy = 0
  let holesPlayed = 0
  let matchClosed = false   // match ended before hole 18
  let closedAfterHole = null
  const holes = []

  for (let h = 1; h <= 18; h++) {
    // If match is already closed, remaining holes are moot
    if (matchClosed) {
      holes.push({ hole: h, status: 'conceded', result: null, netA: null, netB: null, upByAfter: upBy })
      continue
    }

    const sA = scoresA[h]
    const sB = scoresB[h]
    if (!sA || !sB) {
      holes.push({ hole: h, status: 'pending', result: null, netA: null, netB: null, upByAfter: upBy })
      continue
    }

    const si  = strokeIndexes[h - 1]
    const par = parPerHole[h - 1]

    const strokesA = getStrokesOnHole(playerA.course_handicap ?? 0, si)
    const strokesB = getStrokesOnHole(playerB.course_handicap ?? 0, si)
    const netA = sA.gross_score - strokesA
    const netB = sB.gross_score - strokesB

    let result
    if (netA < netB)      { upBy++; result = 'A' }
    else if (netB < netA) { upBy--; result = 'B' }
    else                  { result = 'halve' }

    holesPlayed++
    const remaining = 18 - holesPlayed

    // Check if match is over: lead > holes remaining
    if (Math.abs(upBy) > remaining) {
      matchClosed = true
      closedAfterHole = h
    }

    holes.push({ hole: h, status: 'played', result, netA, netB, par, upByAfter: upBy })
  }

  // Final status label
  const isClosed = matchClosed || holesPlayed === 18
  const matchStatusLabel_ = holesPlayed === 0
    ? 'Not started'
    : matchStatusLabel(upBy, holesPlayed, isClosed && upBy !== 0)

  const winner = isClosed
    ? (upBy > 0 ? 'A' : upBy < 0 ? 'B' : 'halve')
    : null

  return {
    playerA,
    playerB,
    upBy,           // net holes up (+ = A, - = B)
    holesPlayed,
    matchClosed,
    closedAfterHole,
    matchStatus: matchStatusLabel_,
    winner,
    holes,
    // Keep pointsA/B for backward compat with team totals
    pointsA: upBy > 0 ? 1 : upBy === 0 && holesPlayed === 18 ? 0.5 : 0,
    pointsB: upBy < 0 ? 1 : upBy === 0 && holesPlayed === 18 ? 0.5 : 0,
  }
}

/**
 * Compute match play results for an entire event.
 * Groups players by group_number, pairs A vs B within each group.
 * If storedPairings are provided (length > 0), use those instead of auto-pairing.
 *
 * @param {Array}  eventPlayers
 * @param {Array}  allScores
 * @param {Object} course
 * @param {Array}  storedPairings  — optional array of { player_a_id, player_b_id, match_number }
 * @returns {{ pairings, playerPoints, teamPoints }}
 */
export function computeMatchPoints(eventPlayers, allScores, course, storedPairings = []) {
  const { stroke_index: strokeIndexes, par_per_hole: parPerHole } = course

  const pairings = []
  const playerPoints = {}  // playerId → total points

  if (storedPairings.length > 0) {
    // Use explicit stored pairings
    const playerMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
    for (const pairing of storedPairings) {
      const playerA = playerMap[pairing.player_a_id]
      const playerB = playerMap[pairing.player_b_id]
      if (!playerA || !playerB) continue
      const result = computePairingResult(playerA, playerB, allScores, strokeIndexes, parPerHole)
      result.groupNumber = pairing.match_number
      pairings.push(result)

      playerPoints[playerA.player_id] = (playerPoints[playerA.player_id] ?? 0) + result.pointsA
      playerPoints[playerB.player_id] = (playerPoints[playerB.player_id] ?? 0) + result.pointsB
    }
  } else {
  // Group players
  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number ?? 0
    if (!groups[g]) groups[g] = []
    groups[g].push(ep)
  }

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
  }

  // Team totals — only meaningful when pairings cross flights (A vs B)
  const hasTeams = pairings.some(p => p.playerA.flight !== p.playerB.flight)
  let teamA = 0, teamB = 0
  if (hasTeams) {
    for (const ep of eventPlayers) {
      const pts = playerPoints[ep.player_id] ?? 0
      if (ep.flight === 'A') teamA += pts
      else if (ep.flight === 'B') teamB += pts
    }
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
    hasTeams,
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
