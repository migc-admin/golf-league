/**
 * One event's Team Play results — the calculation the Team Play page has always run, moved here
 * unchanged so the season view can reuse the exact same numbers.
 *
 * Players are ranked within their own flight (Flight A competes with Flight A), points are assigned
 * from that ranking, and each team's total is the sum of its selected players' points. Returns
 * `{ teamResults, playerPoints }` (see `computeTGLEventResults`) or null when there is nothing to score.
 */

import { computeLeaderboards } from './scoring'
import { computeTGLEventResults, assignTGLPoints } from './tgl'

export function computeEventTglResults({ eventPlayers, allScores, course, tglSelections, tglTeams, tglMembers }) {
  if (!course || !allScores.length || !tglTeams.length) return null
  try {
    const lb = computeLeaderboards(eventPlayers, allScores, course)
    const epMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))

    const attachPlayer = r => ({ ...r, player: epMap[r.player_id]?.player ?? null })

    // Score TGL points per-flight so Flight A competes within Flight A, etc.
    const rankedA = (lb.full?.A ?? []).map(attachPlayer)
    const rankedB = (lb.full?.B ?? []).map(attachPlayer)

    // Field size = enrolled players per flight, so missing/unassigned players
    // don't shrink the denominator and deflate everyone else's points.
    const hasFlights = eventPlayers.some(ep => ep.flight === 'A' || ep.flight === 'B')
    const enrolledA = hasFlights ? eventPlayers.filter(ep => ep.flight === 'A').length : eventPlayers.length
    const enrolledB = eventPlayers.filter(ep => ep.flight === 'B').length
    const pointsA = rankedA.length ? assignTGLPoints(rankedA, Math.max(rankedA.length, enrolledA)) : {}
    const pointsB = rankedB.length ? assignTGLPoints(rankedB, Math.max(rankedB.length, enrolledB)) : {}
    const combinedPoints = { ...pointsA, ...pointsB }

    const allRanked = [...rankedA, ...rankedB]
    if (!allRanked.length) return null

    return computeTGLEventResults(allRanked, tglSelections, tglTeams, tglMembers, combinedPoints)
  } catch {
    return null
  }
}
