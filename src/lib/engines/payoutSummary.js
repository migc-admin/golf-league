/**
 * Per-player payout totals for an event — who won what.
 *
 * Mirrors the computation behind the admin Payout Summary tab so every
 * consumer (printed Payouts per Player sheet, results email) agrees with it.
 *
 * @returns {Array<{ playerId, name, total, items: Array<{category, amount}> }>}
 */
import { computePayouts } from './payouts'
import { computeLeaderboards, computeStableford, computeBlindPartners } from './scoring'
import { computeAllSkins, computeSuperSkins } from './skins'

export function computePlayerPayouts(event, eventPlayers, allScores, course, sideGames) {
  if (!course) return []
  const nonGuestEPs  = eventPlayers.filter(ep => !ep.is_guest)
  const flightCounts = {}
  nonGuestEPs.forEach(ep => { if (ep.flight) flightCounts[ep.flight] = (flightCounts[ep.flight] ?? 0) + 1 })
  const leaderboards        = computeLeaderboards(nonGuestEPs, allScores, course)
  const skinsResults        = computeAllSkins(nonGuestEPs, allScores, course)
  const stablefordData      = computeStableford(nonGuestEPs, allScores, course)
  const stablefordGrossData = computeStableford(nonGuestEPs, allScores, course, true)
  const blindPartnersData   = computeBlindPartners(event, nonGuestEPs, allScores, course)
  const superSkinsResult    = computeSuperSkins(event, nonGuestEPs, allScores, course)
  const { byPlayer } = computePayouts(
    event, nonGuestEPs.length, leaderboards, sideGames, skinsResults, flightCounts, {
      stablefordData, blindPartnersData, superSkinsResult, stablefordGrossData, eventPlayers: nonGuestEPs,
    }
  )
  const playerMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.player]))
  return byPlayer.map(({ playerId, total, items }) => {
    const p = playerMap[playerId]
    return { playerId, name: p ? `${p.first_name} ${p.last_name}` : playerId, total, items }
  })
}
