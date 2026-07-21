/**
 * Match Points Engine
 * Pure functions — no side effects, no Supabase calls.
 *
 * Supports formats:
 *   match_points      — individual head-to-head match play within groups
 *   ryder_cup         — team match play aggregate (Flight A vs B points)
 *   team_match_play   — Best Ball team match play (team's best net vs other team's best net)
 *
 * Handicap allocation (Option B — relative):
 *   Individual match: strokes given relative to the lower CH player in the pairing
 *     e.g. CH 8 vs CH 14 → 0 strokes vs 6 strokes
 *   Team match: strokes given relative to the lowest CH across all 4 players
 *     e.g. CH 4, 8, 12, 16 → 0, 4, 8, 12 strokes
 *
 * USGA match play scoring:
 *   Win a hole  → go 1 UP
 *   Halve a hole → status unchanged
 *   Lose a hole → go 1 DOWN
 *   Match ends when lead > holes remaining (e.g. 3&2, 1 UP, All Square)
 */

import { getStrokesOnHole } from './scoring'

/**
 * Format a USGA match play status string.
 * upBy > 0 means A leads, upBy < 0 means B leads.
 */
function matchStatusLabel(upBy, holesPlayed, closed = false) {
  const remaining = 18 - holesPlayed
  if (upBy === 0) return 'All Square'
  const leader = upBy > 0 ? 'A' : 'B'
  const margin = Math.abs(upBy)
  if (closed) {
    if (remaining > 0) return `${margin}&${remaining}`
    return `${margin} UP`
  }
  if (holesPlayed === 18) return `${margin} UP`
  if (margin === remaining) return `Dormie ${margin} (${leader})`
  return `${margin} UP (${leader})`
}

/**
 * Pair players within a group for match play.
 *
 * Strategy:
 *   1. If the group has both Flight A and Flight B → pair A vs B by handicap order
 *   2. Otherwise → pair by handicap order top-down (1v2, 3v4, …)
 */
function buildPairings(groupPlayers) {
  const hasA = groupPlayers.some(ep => ep.flight === 'A')
  const hasB = groupPlayers.some(ep => ep.flight === 'B')

  if (hasA && hasB) {
    const flightA = [...groupPlayers.filter(ep => ep.flight === 'A')]
      .sort((a, b) => (a.course_handicap ?? 99) - (b.course_handicap ?? 99))
    const flightB = [...groupPlayers.filter(ep => ep.flight === 'B')]
      .sort((a, b) => (a.course_handicap ?? 99) - (b.course_handicap ?? 99))

    const pairs = []
    const count = Math.max(flightA.length, flightB.length)
    for (let i = 0; i < count; i++) {
      if (flightA[i] && flightB[i]) pairs.push({ playerA: flightA[i], playerB: flightB[i] })
    }
    return pairs
  }

  const sorted = [...groupPlayers].sort((a, b) => (a.course_handicap ?? 99) - (b.course_handicap ?? 99))
  const pairs = []
  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push({ playerA: sorted[i], playerB: sorted[i + 1] })
  }
  return pairs
}

/**
 * Compute match play result for a single head-to-head pairing.
 * Uses relative handicaps: lower CH player gets 0 strokes, other gets the difference.
 *
 * @param {Object}   playerA
 * @param {Object}   playerB
 * @param {Array}    allScores
 * @param {number[]} strokeIndexes
 * @param {number[]} parPerHole
 * @param {number}   [baselineCH]  — optional external baseline (for team context); defaults to min of the two
 */
function computePairingResult(playerA, playerB, allScores, strokeIndexes, parPerHole, baselineCH = null) {
  const scoresA = Object.fromEntries(
    allScores.filter(s => s.player_id === playerA.player_id).map(s => [s.hole_number, s])
  )
  const scoresB = Object.fromEntries(
    allScores.filter(s => s.player_id === playerB.player_id).map(s => [s.hole_number, s])
  )

  // Relative handicaps — Option B
  const chA = playerA.course_handicap ?? 0
  const chB = playerB.course_handicap ?? 0
  const baseline = baselineCH ?? Math.min(chA, chB)
  const relA = Math.max(0, chA - baseline)
  const relB = Math.max(0, chB - baseline)

  let upBy = 0
  let holesPlayed = 0
  let matchClosed = false
  let closedAfterHole = null
  const holes = []

  for (let h = 1; h <= 18; h++) {
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

    const strokesA = getStrokesOnHole(relA, si)
    const strokesB = getStrokesOnHole(relB, si)
    const netA = sA.gross_score - strokesA
    const netB = sB.gross_score - strokesB

    let result
    if (netA < netB)      { upBy++; result = 'A' }
    else if (netB < netA) { upBy--; result = 'B' }
    else                  { result = 'halve' }

    holesPlayed++
    const remaining = 18 - holesPlayed
    if (Math.abs(upBy) > remaining) {
      matchClosed = true
      closedAfterHole = h
    }

    holes.push({ hole: h, status: 'played', result, netA, netB, par, upByAfter: upBy })
  }

  const isClosed = matchClosed || holesPlayed === 18
  const matchStatus = holesPlayed === 0
    ? 'Not started'
    : matchStatusLabel(upBy, holesPlayed, isClosed && upBy !== 0)

  const winner = isClosed
    ? (upBy > 0 ? 'A' : upBy < 0 ? 'B' : 'halve')
    : null

  return {
    playerA,
    playerB,
    relHandicapA: relA,
    relHandicapB: relB,
    upBy,
    holesPlayed,
    matchClosed,
    closedAfterHole,
    matchStatus,
    winner,
    holes,
    pointsA: upBy > 0 ? 1 : upBy === 0 && holesPlayed === 18 ? 0.5 : 0,
    pointsB: upBy < 0 ? 1 : upBy === 0 && holesPlayed === 18 ? 0.5 : 0,
  }
}

/**
 * Compute individual match play results for an entire event.
 */
export function computeMatchPoints(eventPlayers, allScores, course, storedPairings = []) {
  const { stroke_index: strokeIndexes, par_per_hole: parPerHole } = course

  const pairings = []
  const playerPoints = {}

  if (storedPairings.length > 0) {
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

  const hasTeams = pairings.some(p => p.playerA.flight !== p.playerB.flight)
  let teamA = 0, teamB = 0
  if (hasTeams) {
    for (const ep of eventPlayers) {
      const pts = playerPoints[ep.player_id] ?? 0
      if (ep.flight === 'A') teamA += pts
      else if (ep.flight === 'B') teamB += pts
    }
  }

  const ranked = eventPlayers
    .map(ep => ({ ...ep, points: playerPoints[ep.player_id] ?? 0 }))
    .sort((a, b) => b.points - a.points)
    .map((p, i) => ({ ...p, rank: i + 1 }))

  const rankedA = ranked.filter(p => p.flight === 'A').map((p, i) => ({ ...p, rank: i + 1 }))
  const rankedB = ranked.filter(p => p.flight === 'B').map((p, i) => ({ ...p, rank: i + 1 }))

  return { pairings, playerPoints, teamPoints: { A: teamA, B: teamB }, hasTeams, ranked: { A: rankedA, B: rankedB, overall: ranked } }
}

/**
 * Compute Best Ball team match play results per group.
 *
 * Teams are defined by team_match_config.sides: { [player_id]: 'A' | 'B' }
 * Falls back to flight assignments if no config provided.
 *
 * Relative handicaps: each player's strokes = their CH minus the lowest CH in the group.
 * Each hole: team's score = best (lowest) net among its players.
 * Standard USGA match play rules applied to the team scores.
 *
 * @param {Array}   eventPlayers
 * @param {Array}   allScores
 * @param {Object}  course
 * @param {Object}  [teamMatchConfig]  — event.team_match_config
 * @returns {{ groupMatches, totalA, totalB, teamAName, teamBName }}
 */
export function computeTeamMatchPoints(eventPlayers, allScores, course, teamMatchConfig = null) {
  const { stroke_index: strokeIndexes, par_per_hole: parPerHole } = course
  const sides    = teamMatchConfig?.sides    ?? {}
  const teamAName = teamMatchConfig?.teamA   || 'Team A'
  const teamBName = teamMatchConfig?.teamB   || 'Team B'
  const hasSides = Object.keys(sides).length > 0

  // Build score lookup
  const scoreMap = {}
  for (const s of allScores) {
    if (!scoreMap[s.player_id]) scoreMap[s.player_id] = {}
    scoreMap[s.player_id][s.hole_number] = s
  }

  // Group players
  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number ?? 0
    if (!groups[g]) groups[g] = []
    groups[g].push(ep)
  }

  const groupMatches = []

  for (const [groupNum, members] of Object.entries(groups)) {
    // Use team_match_config sides if available, otherwise fall back to flights
    const teamA = hasSides
      ? members.filter(ep => sides[ep.player_id] === 'A')
      : members.filter(ep => ep.flight === 'A')
    const teamB = hasSides
      ? members.filter(ep => sides[ep.player_id] === 'B')
      : members.filter(ep => ep.flight === 'B')
    if (teamA.length === 0 || teamB.length === 0) continue

    // Baseline = lowest CH across all players in the group
    const allCHs = members.map(ep => ep.course_handicap ?? 0)
    const baseline = Math.min(...allCHs)

    // Assign relative handicaps
    const relCH = Object.fromEntries(
      members.map(ep => [ep.player_id, Math.max(0, (ep.course_handicap ?? 0) - baseline)])
    )

    let upBy = 0
    let holesPlayed = 0
    let matchClosed = false
    let closedAfterHole = null
    const holes = []

    for (let h = 1; h <= 18; h++) {
      if (matchClosed) {
        holes.push({ hole: h, status: 'conceded', result: null, bestNetA: null, bestNetB: null, upByAfter: upBy, contributorA: null, contributorB: null })
        continue
      }

      const si  = strokeIndexes[h - 1]
      const par = parPerHole[h - 1]

      // Compute net for each player; track who had the best ball
      let bestNetA = Infinity, contributorA = null
      for (const ep of teamA) {
        const s = scoreMap[ep.player_id]?.[h]
        if (!s) continue
        const strokes = getStrokesOnHole(relCH[ep.player_id], si)
        const net = s.gross_score - strokes
        if (net < bestNetA) { bestNetA = net; contributorA = ep }
      }

      let bestNetB = Infinity, contributorB = null
      for (const ep of teamB) {
        const s = scoreMap[ep.player_id]?.[h]
        if (!s) continue
        const strokes = getStrokesOnHole(relCH[ep.player_id], si)
        const net = s.gross_score - strokes
        if (net < bestNetB) { bestNetB = net; contributorB = ep }
      }

      // Both teams need at least one score
      if (bestNetA === Infinity || bestNetB === Infinity) {
        holes.push({ hole: h, status: 'pending', result: null, bestNetA: bestNetA === Infinity ? null : bestNetA, bestNetB: bestNetB === Infinity ? null : bestNetB, upByAfter: upBy, contributorA, contributorB })
        continue
      }

      let result
      if (bestNetA < bestNetB)      { upBy++; result = 'A' }
      else if (bestNetB < bestNetA) { upBy--; result = 'B' }
      else                          { result = 'halve' }

      holesPlayed++
      const remaining = 18 - holesPlayed
      if (Math.abs(upBy) > remaining) {
        matchClosed = true
        closedAfterHole = h
      }

      holes.push({ hole: h, status: 'played', result, bestNetA, bestNetB, par, upByAfter: upBy, contributorA, contributorB })
    }

    const isClosed = matchClosed || holesPlayed === 18
    const matchStatus = holesPlayed === 0
      ? 'Not started'
      : matchStatusLabel(upBy, holesPlayed, isClosed && upBy !== 0)

    const winner = isClosed ? (upBy > 0 ? 'A' : upBy < 0 ? 'B' : 'halve') : null

    groupMatches.push({
      groupNumber: parseInt(groupNum, 10),
      teamA,
      teamB,
      relCH,
      baseline,
      upBy,
      holesPlayed,
      matchClosed,
      closedAfterHole,
      matchStatus,
      winner,
      holes,
      pointsA: upBy > 0 ? 1 : upBy === 0 && holesPlayed === 18 ? 0.5 : 0,
      pointsB: upBy < 0 ? 1 : upBy === 0 && holesPlayed === 18 ? 0.5 : 0,
    })
  }

  groupMatches.sort((a, b) => a.groupNumber - b.groupNumber)

  const totalA = groupMatches.reduce((s, m) => s + m.pointsA, 0)
  const totalB = groupMatches.reduce((s, m) => s + m.pointsB, 0)

  return { groupMatches, totalA, totalB, teamAName, teamBName }
}

/**
 * Convenience: just get the team Ryder Cup score.
 */
export function computeRyderCupScore(eventPlayers, allScores, course) {
  const { teamPoints, pairings } = computeMatchPoints(eventPlayers, allScores, course)
  const holesPlayed = pairings.reduce((acc, p) => acc + p.holesPlayed, 0)

  let leader
  const diff = teamPoints.A - teamPoints.B
  if (diff > 0)      leader = 'Flight A'
  else if (diff < 0) leader = 'Flight B'
  else               leader = 'All square'

  return { teamA: teamPoints.A, teamB: teamPoints.B, leader, margin: Math.abs(diff), holesPlayed }
}
