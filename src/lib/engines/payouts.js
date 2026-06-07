/**
 * Payout Calculation Engine
 *
 * payout_config (stored as JSON on events):
 * {
 *   "18_net_a_1st": 0.15,
 *   "18_net_a_2nd": 0.08,
 *   "18_net_a_3rd": 0.04,
 *   "18_net_b_1st": 0.15,
 *   "18_net_b_2nd": 0.08,
 *   "18_net_b_3rd": 0.04,
 *   "f9_a_1st":     0.05,
 *   "f9_a_2nd":     0.025,
 *   "f9_b_1st":     0.05,
 *   "f9_b_2nd":     0.025,
 *   "b9_a_1st":     0.05,
 *   "b9_a_2nd":     0.025,
 *   "b9_b_1st":     0.05,
 *   "b9_b_2nd":     0.025,
 *   "low_putts":    0.03,
 *   "long_drive":   0.02,
 *   "ctp_4":        0.02,    // CTP hole 4
 *   "ctp_7":        0.02,    // CTP hole 7 (any par-3 hole)
 *   "skins_a":      0.10,    // total pool → Flight A skins
 *   "skins_b":      0.10     // total pool → Flight B skins
 * }
 *
 * Percentages should sum to ≤ 1.0. Admin is responsible for the split.
 * Skins categories are distributed by the skins engine, not as fixed places.
 */

import { computeSkinsPayout } from './skins.js'

// Human-readable category labels
export const CATEGORY_LABELS = {
  '18_net_a_1st': '18-Hole Net — Flight A, 1st',
  '18_net_a_2nd': '18-Hole Net — Flight A, 2nd',
  '18_net_a_3rd': '18-Hole Net — Flight A, 3rd',
  '18_net_b_1st': '18-Hole Net — Flight B, 1st',
  '18_net_b_2nd': '18-Hole Net — Flight B, 2nd',
  '18_net_b_3rd': '18-Hole Net — Flight B, 3rd',
  'f9_a_1st':     'Front 9 Net — Flight A, 1st',
  'f9_a_2nd':     'Front 9 Net — Flight A, 2nd',
  'f9_b_1st':     'Front 9 Net — Flight B, 1st',
  'f9_b_2nd':     'Front 9 Net — Flight B, 2nd',
  'b9_a_1st':     'Back 9 Net — Flight A, 1st',
  'b9_a_2nd':     'Back 9 Net — Flight A, 2nd',
  'b9_b_1st':     'Back 9 Net — Flight B, 1st',
  'b9_b_2nd':     'Back 9 Net — Flight B, 2nd',
  'low_putts':    'Low Putts (Overall)',
  'long_drive':   'Long Drive',
  'skins_a':      'Skins — Flight A',
  'skins_b':      'Skins — Flight B',
}

export function ctpLabel(holeNumber) {
  return `Closest to Pin — Hole ${holeNumber}`
}

/** Default payout config percentages (admin can adjust) */
export const DEFAULT_PAYOUT_CONFIG = {
  '18_net_a_1st': 0.12,
  '18_net_a_2nd': 0.06,
  '18_net_a_3rd': 0.03,
  '18_net_b_1st': 0.12,
  '18_net_b_2nd': 0.06,
  '18_net_b_3rd': 0.03,
  'f9_a_1st':     0.05,
  'f9_a_2nd':     0.02,
  'f9_b_1st':     0.05,
  'f9_b_2nd':     0.02,
  'b9_a_1st':     0.05,
  'b9_a_2nd':     0.02,
  'b9_b_1st':     0.05,
  'b9_b_2nd':     0.02,
  'low_putts':    0.03,
  'long_drive':   0.03,
  'skins_a':      0.12,
  'skins_b':      0.12,
}

/**
 * Map a payout config key to a leaderboard result.
 *
 * @param {string} key
 * @param {Object} leaderboards  — from scoring.computeLeaderboards
 * @param {Array}  sideGames     — from side_games table
 * @returns {string|null}  player_id or null if not resolved
 */
function resolveWinner(key, leaderboards, sideGames) {
  const rankMap = { '1st': 1, '2nd': 2, '3rd': 3 }

  if (key.startsWith('18_net_a_') || key.startsWith('18_net_b_')) {
    const flight = key.includes('_a_') ? 'A' : 'B'
    const rank   = rankMap[key.split('_').pop()]
    const entry  = leaderboards.full[flight]?.find(p => p.rank === rank)
    return entry?.player_id ?? null
  }

  if (key.startsWith('f9_')) {
    const flight = key.includes('_a_') ? 'A' : 'B'
    const rank   = rankMap[key.split('_').pop()]
    const entry  = leaderboards.front9[flight]?.find(p => p.rank === rank)
    return entry?.player_id ?? null
  }

  if (key.startsWith('b9_')) {
    const flight = key.includes('_a_') ? 'A' : 'B'
    const rank   = rankMap[key.split('_').pop()]
    const entry  = leaderboards.back9[flight]?.find(p => p.rank === rank)
    return entry?.player_id ?? null
  }

  if (key === 'low_putts') {
    // Check side_games table first; fall back to leaderboard
    const manual = sideGames.find(g => g.game_type === 'low_putts')
    if (manual?.winner_player_id) return manual.winner_player_id
    return leaderboards.putts?.[0]?.player_id ?? null
  }

  if (key === 'long_drive') {
    const g = sideGames.find(g => g.game_type === 'long_drive')
    return g?.winner_player_id ?? null
  }

  if (key.startsWith('ctp_')) {
    const holeNum = parseInt(key.replace('ctp_', ''), 10)
    const g = sideGames.find(g => g.game_type === 'ctp' && g.hole_number === holeNum)
    return g?.winner_player_id ?? null
  }

  return null
}

/**
 * Compute full payout summary for an event.
 *
 * @param {Object} event         — { entry_fee, payout_config }
 * @param {number} playerCount
 * @param {Object} leaderboards  — from scoring.computeLeaderboards
 * @param {Array}  sideGames
 * @param {Object} skinsResults  — { A: skinsResult, B: skinsResult }
 * @returns {Object}  { totalPot, byCategory, byPlayer, allocationPct }
 */
export function computePayouts(event, playerCount, leaderboards, sideGames, skinsResults) {
  const config    = event.payout_config ?? {}
  const totalPot  = event.entry_fee * playerCount
  const byCategory = []
  const byPlayer   = {}  // playerId → { total, items[] }

  const allocationPct = Object.values(config).reduce((a, b) => a + b, 0)

  for (const [key, pct] of Object.entries(config)) {
    const amount = Math.round(totalPot * pct * 100) / 100
    if (amount <= 0) continue

    // Skins are handled separately
    if (key === 'skins_a' || key === 'skins_b') {
      const flight      = key === 'skins_a' ? 'A' : 'B'
      const skinsResult = skinsResults?.[flight]
      if (!skinsResult) continue

      const skinPayouts = computeSkinsPayout(skinsResult, amount)
      for (const sp of skinPayouts) {
        const label = `${CATEGORY_LABELS[key]} (${sp.skinsWon} skin${sp.skinsWon !== 1 ? 's' : ''})`
        byCategory.push({ key: `${key}_${sp.playerId}`, label, amount: sp.total, playerId: sp.playerId, isSkin: true })
        if (!byPlayer[sp.playerId]) byPlayer[sp.playerId] = { total: 0, items: [] }
        byPlayer[sp.playerId].total += sp.total
        byPlayer[sp.playerId].items.push({ category: label, amount: sp.total })
      }
      continue
    }

    const label    = key.startsWith('ctp_')
      ? ctpLabel(parseInt(key.replace('ctp_', ''), 10))
      : (CATEGORY_LABELS[key] ?? key)
    const playerId = resolveWinner(key, leaderboards, sideGames)

    byCategory.push({ key, label, amount, playerId, isSkin: false })

    if (playerId) {
      if (!byPlayer[playerId]) byPlayer[playerId] = { total: 0, items: [] }
      byPlayer[playerId].total += amount
      byPlayer[playerId].items.push({ category: label, amount })
    }
  }

  // Sort byPlayer descending
  const byPlayerSorted = Object.entries(byPlayer)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([playerId, data]) => ({ playerId, ...data }))

  return { totalPot, byCategory, byPlayer: byPlayerSorted, allocationPct }
}
