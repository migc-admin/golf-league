/**
 * Scoring Engine
 * All functions are pure — no side effects, no Supabase calls.
 */

/**
 * Compute course handicap per USGA formula.
 * Course Handicap = ROUND((HI × Slope / 113) + (Rating − Par))
 *
 * @param {number} handicapIndex
 * @param {number} slope
 * @param {number} rating
 * @param {number} par  — total course par (sum of par_per_hole)
 * @returns {number}
 */
export function computeCourseHandicap(handicapIndex, slope, rating, par) {
  return Math.round((handicapIndex * slope / 113) + (rating - par))
}

/**
 * How many strokes does a player receive on a given hole?
 *
 * Standard USGA allocation:
 *   - Full strokes = floor(courseHandicap / 18)  applied to every hole
 *   - Remainder    = courseHandicap % 18          applied to holes whose
 *                                                  strokeIndex ≤ remainder
 *
 * Negative course handicaps (scratch/plus players) subtract strokes
 * on the EASIEST holes first (highest stroke index).
 *
 * @param {number} courseHandicap
 * @param {number} holeStrokeIndex  — 1 (hardest) … 18 (easiest)
 * @returns {number}  strokes received (can be negative for + handicaps)
 */
export function getStrokesOnHole(courseHandicap, holeStrokeIndex) {
  if (courseHandicap >= 0) {
    const full      = Math.floor(courseHandicap / 18)
    const remainder = courseHandicap % 18
    return full + (holeStrokeIndex <= remainder ? 1 : 0)
  } else {
    // Plus handicap: give strokes BACK on easiest holes
    const abs       = Math.abs(courseHandicap)
    const full      = Math.floor(abs / 18)
    const remainder = abs % 18
    const deduction = full + (holeStrokeIndex > (18 - remainder) ? 1 : 0)
    return -deduction
  }
}

/**
 * Net score for a single hole.
 * @param {number} grossScore
 * @param {number} courseHandicap
 * @param {number} holeStrokeIndex
 * @returns {number}
 */
export function netScore(grossScore, courseHandicap, holeStrokeIndex) {
  return grossScore - getStrokesOnHole(courseHandicap, holeStrokeIndex)
}

/**
 * Build a complete net-score map for one player across all entered holes.
 *
 * @param {Array<{hole_number, gross_score}>} scores
 * @param {number} courseHandicap
 * @param {number[]} strokeIndexes  — 18-element array, index 0 = hole 1
 * @returns {Object}  { holeNumber: netScore, ... }
 */
export function buildPlayerNetMap(scores, courseHandicap, strokeIndexes) {
  const map = {}
  for (const s of scores) {
    const si = strokeIndexes[s.hole_number - 1]
    map[s.hole_number] = netScore(s.gross_score, courseHandicap, si)
  }
  return map
}

/**
 * Stableford points for a single net score vs par.
 * Eagle or better=4, Birdie=3, Par=2, Bogey=1, Double Bogey+=0
 * @param {number} netScore
 * @param {number} par
 * @returns {number}
 */
export function stablefordPoints(netScore, par) {
  const diff = netScore - par
  if (diff <= -2) return 4
  if (diff === -1) return 3
  if (diff === 0)  return 2
  if (diff === 1)  return 1
  return 0
}

/**
 * Compute Stableford leaderboard for an event.
 * Returns players ranked by total points descending (high score wins).
 *
 * @param {Array}  eventPlayers
 * @param {Array}  allScores
 * @param {Object} course
 * @returns {{ A: Array, B: Array }}
 */
export function computeStableford(eventPlayers, allScores, course) {
  const { stroke_index: strokeIndexes, par_per_hole: parPerHole } = course

  const players = eventPlayers.map(ep => {
    const playerScores = allScores.filter(s => s.player_id === ep.player_id)
    const ch = ep.course_handicap ?? 0

    let totalPoints = 0
    let holesPlayed = 0

    for (const s of playerScores) {
      const h   = s.hole_number
      const si  = strokeIndexes[h - 1]
      const par = parPerHole[h - 1]
      const strokes = getStrokesOnHole(ch, si)
      const net = s.gross_score - strokes
      totalPoints += stablefordPoints(net, par)
      holesPlayed++
    }

    return {
      player_id:      ep.player_id,
      player:         ep.player,
      flight:         ep.flight,
      course_handicap: ch,
      totalPoints,
      holesPlayed,
    }
  })

  const sorted = (list) =>
    [...list]
      .sort((a, b) => b.totalPoints - a.totalPoints || b.holesPlayed - a.holesPlayed)
      .map((p, i) => ({ ...p, rank: i + 1 }))

  return {
    A: sorted(players.filter(p => p.flight === 'A')),
    B: sorted(players.filter(p => p.flight === 'B')),
  }
}

/**
 * Compute all leaderboard positions for one event.
 *
 * @param {Array} eventPlayers   — from event_players with player attached
 * @param {Array} allScores      — from scores table
 * @param {Object} course        — { par_per_hole, stroke_index }
 * @returns {{ full, front9, back9, putts }}  each is an array sorted by score asc
 */
export function computeLeaderboards(eventPlayers, allScores, course) {
  const { stroke_index: strokeIndexes, par_per_hole: parPerHole } = course

  const players = eventPlayers.map(ep => {
    const playerScores = allScores.filter(s => s.player_id === ep.player_id)
    const ch = ep.course_handicap ?? 0
    const netMap = buildPlayerNetMap(playerScores, ch, strokeIndexes)

    // Gross / net totals
    let gross18 = 0, net18 = 0
    let grossF9 = 0, netF9 = 0
    let grossB9 = 0, netB9 = 0
    let totalPutts = 0
    let holesCompleted = 0
    let f9Holes = 0, b9Holes = 0

    for (const s of playerScores) {
      const h = s.hole_number
      const g = s.gross_score
      const n = netMap[h]
      gross18 += g
      net18   += n
      holesCompleted++
      if (s.putts != null) totalPutts += s.putts
      if (h <= 9)  { grossF9 += g; netF9 += n; f9Holes++ }
      else         { grossB9 += g; netB9 += n; b9Holes++ }
    }

    // Relative to par for completed holes
    const parPlayed  = playerScores.reduce((acc, s) => acc + parPerHole[s.hole_number - 1], 0)
    const parF9      = playerScores.filter(s => s.hole_number <= 9) .reduce((acc, s) => acc + parPerHole[s.hole_number - 1], 0)
    const parB9      = playerScores.filter(s => s.hole_number >= 10).reduce((acc, s) => acc + parPerHole[s.hole_number - 1], 0)

    return {
      player_id:      ep.player_id,
      player:         ep.player,
      flight:         ep.flight,
      course_handicap: ch,
      holesCompleted,
      gross18, net18,
      grossF9, netF9, f9Holes,
      grossB9, netB9, b9Holes,
      netVsPar:  net18   - parPlayed,
      f9VsPar:   netF9   - parF9,
      b9VsPar:   netB9   - parB9,
      totalPutts: playerScores.length > 0 ? totalPutts : null,
    }
  })

  // Sort helpers
  const byNet18  = (a, b) => a.net18  - b.net18  || a.holesCompleted - b.holesCompleted
  const byNetF9  = (a, b) => a.netF9  - b.netF9  || a.f9Holes - b.f9Holes
  const byNetB9  = (a, b) => a.netB9  - b.netB9  || a.b9Holes - b.b9Holes
  const byPutts  = (a, b) => {
    if (a.totalPutts == null) return 1
    if (b.totalPutts == null) return -1
    return a.totalPutts - b.totalPutts
  }

  const withRank = (arr, sortFn) => {
    const sorted = [...arr].sort(sortFn)
    return sorted.map((p, i) => ({ ...p, rank: i + 1 }))
  }

  // Split by flight
  const flightA = players.filter(p => p.flight === 'A')
  const flightB = players.filter(p => p.flight === 'B')

  return {
    full: {
      A: withRank(flightA.filter(p => p.holesCompleted === 18), byNet18),
      B: withRank(flightB.filter(p => p.holesCompleted === 18), byNet18),
      AInProgress: withRank(flightA.filter(p => p.holesCompleted > 0 && p.holesCompleted < 18), byNet18),
      BInProgress: withRank(flightB.filter(p => p.holesCompleted > 0 && p.holesCompleted < 18), byNet18),
    },
    front9: {
      A: withRank(flightA.filter(p => p.f9Holes === 9), byNetF9),
      B: withRank(flightB.filter(p => p.f9Holes === 9), byNetF9),
    },
    back9: {
      A: withRank(flightA.filter(p => p.b9Holes === 9), byNetB9),
      B: withRank(flightB.filter(p => p.b9Holes === 9), byNetB9),
    },
    putts: withRank(players.filter(p => p.holesCompleted === 18 && p.totalPutts != null), byPutts),
  }
}
