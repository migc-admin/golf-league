/**
 * Flight Assignment Engine
 *
 * Rules:
 *  1. Apply tournament-win handicap reductions before sorting.
 *  2. Sort all event_players by adjusted_handicap_index ascending.
 *  3. Top half → Flight A  (A gets the extra player if odd count).
 *  4. Admin can manually override any assignment after auto-assign.
 *  5. Course handicap computed per USGA formula.
 */

import { computeCourseHandicap } from './scoring.js'

/**
 * Apply tournament-win reductions to a handicap index.
 *
 * Reductions are applied BEFORE flight sorting:
 *   1 win  → multiply by 0.90
 *   2+ wins → multiply by 0.80, then subtract 1
 *
 * @param {number} handicapIndex
 * @param {number} tournamentWins
 * @returns {number}  adjusted handicap index (rounded to 1 decimal)
 */
export function adjustedHandicapIndex(handicapIndex, tournamentWins) {
  let adj = handicapIndex
  if (tournamentWins >= 2) {
    adj = adj * 0.80 - 1
  } else if (tournamentWins === 1) {
    adj = adj * 0.90
  }
  return Math.round(adj * 10) / 10
}

/**
 * Assign flights to all event players.
 *
 * @param {Array} eventPlayers   — raw event_players rows with handicap_index,
 *                                 tournament_wins_prior
 * @param {Object} course        — { slope, rating, par }
 * @returns {Array}  same rows with flight, adjusted_handicap_index, and
 *                   course_handicap filled in
 */
export function assignFlights(eventPlayers, course) {
  if (!eventPlayers || eventPlayers.length === 0) return []

  const { slope, rating, par } = course

  // 1. Compute adjusted index and course handicap for each player
  const withAdjustments = eventPlayers.map(ep => {
    const adj = adjustedHandicapIndex(
      ep.handicap_index,
      ep.tournament_wins_prior ?? 0
    )
    const ch = computeCourseHandicap(adj, slope, rating, par)
    return {
      ...ep,
      adjusted_handicap_index: adj,
      course_handicap:         ch,
    }
  })

  // 2. Sort ascending by adjusted index (lower = better = Flight A)
  const sorted = [...withAdjustments].sort(
    (a, b) => a.adjusted_handicap_index - b.adjusted_handicap_index
  )

  // 3. Split — Flight A gets the top half (ceiling for odd)
  const total      = sorted.length
  const flightACount = Math.ceil(total / 2)

  return sorted.map((ep, i) => ({
    ...ep,
    flight: i < flightACount ? 'A' : 'B',
  }))
}

/**
 * Re-run flight assignment but preserve any manual overrides.
 *
 * @param {Array}  eventPlayers    — current rows (may have manual flight set)
 * @param {Object} course
 * @param {Set}    manualOverrides — Set of player_id strings that have been
 *                                   manually overridden
 * @returns {Array}
 */
export function reassignFlights(eventPlayers, course, manualOverrides = new Set()) {
  // Players NOT manually overridden participate in auto-assignment
  const autoPlayers   = eventPlayers.filter(ep => !manualOverrides.has(ep.player_id))
  const manualPlayers = eventPlayers.filter(ep =>  manualOverrides.has(ep.player_id))

  // Recalculate adjustments for manual players too (handicap may have changed)
  const { slope, rating, par } = course
  const manualWithCalcs = manualPlayers.map(ep => {
    const adj = adjustedHandicapIndex(ep.handicap_index, ep.tournament_wins_prior ?? 0)
    return { ...ep, adjusted_handicap_index: adj, course_handicap: computeCourseHandicap(adj, slope, rating, par) }
  })

  const autoAssigned = assignFlights(autoPlayers, course)

  return [...autoAssigned, ...manualWithCalcs]
}

/**
 * Return a summary: { A: count, B: count, total }
 */
export function flightSummary(eventPlayers) {
  return eventPlayers.reduce(
    (acc, ep) => {
      if      (ep.flight === 'A') acc.A++
      else if (ep.flight === 'B') acc.B++
      acc.total++
      return acc
    },
    { A: 0, B: 0, total: 0 }
  )
}
