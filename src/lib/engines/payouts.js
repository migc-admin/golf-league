/**
 * Payout Calculation Engine
 *
 * payout_config values are $ PER PLAYER with these multipliers:
 * - low_putts, ctp_N      → × total field (all players)
 * - _a_ / long_drive_a / skins_a → × Flight A player count
 * - _b_ / long_drive_b / skins_b → × Flight B player count
 *
 * Example:
 * {
 *   "18_net_a_1st": 3,   // $3 × flightA players
 *   "18_net_b_1st": 3,   // $3 × flightB players
 *   "ctp_5": 1,          // $1 × all players (greenie pays whole field)
 *   "low_putts": 1,      // $1 × all players
 *   "long_drive_a": 1,   // $1 × flightA players
 *   "long_drive_b": 1,   // $1 × flightB players
 *   "skins_a": 2,        // $2 × flightA players → skins pool
 * }
 */

import { computeSkinsPayout } from './skins.js'

export const CATEGORY_LABELS = {
  '18_net_a_1st':  '18-Hole Net — Flight A, 1st',
  '18_net_a_2nd':  '18-Hole Net — Flight A, 2nd',
  '18_net_a_3rd':  '18-Hole Net — Flight A, 3rd',
  '18_net_b_1st':  '18-Hole Net — Flight B, 1st',
  '18_net_b_2nd':  '18-Hole Net — Flight B, 2nd',
  '18_net_b_3rd':  '18-Hole Net — Flight B, 3rd',
  'f9_a_1st':      'Front 9 Net — Flight A, 1st',
  'f9_a_2nd':      'Front 9 Net — Flight A, 2nd',
  'f9_b_1st':      'Front 9 Net — Flight B, 1st',
  'f9_b_2nd':      'Front 9 Net — Flight B, 2nd',
  'b9_a_1st':      'Back 9 Net — Flight A, 1st',
  'b9_a_2nd':      'Back 9 Net — Flight A, 2nd',
  'b9_b_1st':      'Back 9 Net — Flight B, 1st',
  'b9_b_2nd':      'Back 9 Net — Flight B, 2nd',
  'low_putts':     'Low Putts (Full Field)',
  'long_drive_a':  'Long Drive — Flight A',
  'long_drive_b':  'Long Drive — Flight B',
  'skins_a':       'Skins — Flight A',
  'skins_b':       'Skins — Flight B',
}

export function ctpLabel(holeNumber) {
  return `Closest to Pin — Hole ${holeNumber} (Full Field)`
}

/** Default per-player dollar amounts (admin adjusts as needed) */
export const DEFAULT_PAYOUT_CONFIG = {
  '18_net_a_1st': 3,
  '18_net_a_2nd': 2,
  '18_net_a_3rd': 1,
  '18_net_b_1st': 3,
  '18_net_b_2nd': 2,
  '18_net_b_3rd': 1,
  'f9_a_1st':     2,
  'f9_a_2nd':     1,
  'f9_b_1st':     2,
  'f9_b_2nd':     1,
  'b9_a_1st':     2,
  'b9_a_2nd':     1,
  'b9_b_1st':     2,
  'b9_b_2nd':     1,
  'long_drive_a': 0,
  'long_drive_b': 0,
  'low_putts':    0,
  'skins_a':      2,
  'skins_b':      2,
}

/**
 * Returns 'flight_a', 'flight_b', or 'field' (full player count).
 * low_putts and ctp_N use full field; everything else is per-flight.
 */
function keyMultiplier(key) {
  if (key === 'low_putts' || key.startsWith('ctp_')) return 'field'
  if (key === 'skins_b' || key.includes('_b_') || key === 'long_drive_b') return 'flight_b'
  return 'flight_a'
}

function resolveWinner(key, leaderboards, sideGames) {
  const rankMap = { '1st': 1, '2nd': 2, '3rd': 3 }

  if (key.startsWith('18_net_a_') || key.startsWith('18_net_b_')) {
    const flight = key.includes('_a_') ? 'A' : 'B'
    const rank   = rankMap[key.split('_').pop()]
    return leaderboards.full[flight]?.find(p => p.rank === rank)?.player_id ?? null
  }
  if (key.startsWith('f9_')) {
    const flight = key.includes('_a_') ? 'A' : 'B'
    const rank   = rankMap[key.split('_').pop()]
    return leaderboards.front9[flight]?.find(p => p.rank === rank)?.player_id ?? null
  }
  if (key.startsWith('b9_')) {
    const flight = key.includes('_a_') ? 'A' : 'B'
    const rank   = rankMap[key.split('_').pop()]
    return leaderboards.back9[flight]?.find(p => p.rank === rank)?.player_id ?? null
  }
  if (key === 'low_putts') {
    const manual = sideGames.find(g => g.game_type === 'low_putts')
    if (manual?.winner_player_id) return manual.winner_player_id
    return leaderboards.putts?.[0]?.player_id ?? null
  }
  if (key === 'long_drive_a') {
    const g = sideGames.find(g => g.game_type === 'long_drive' && g.flight === 'A')
    return g?.winner_player_id ?? null
  }
  if (key === 'long_drive_b') {
    const g = sideGames.find(g => g.game_type === 'long_drive' && g.flight === 'B')
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
 * @param {Object} event          — { entry_fee, payout_config }
 * @param {number} playerCount    — total players
 * @param {Object} leaderboards   — from scoring.computeLeaderboards
 * @param {Array}  sideGames
 * @param {Object} skinsResults   — { A: skinsResult, B: skinsResult }
 * @param {Object} flightCounts   — { A: number, B: number }  (optional, defaults to split)
 */
export function computePayouts(event, playerCount, leaderboards, sideGames, skinsResults, flightCounts) {
  const config  = event.payout_config ?? {}
  const totalPot = event.entry_fee * playerCount
  const fcA = flightCounts?.A ?? Math.ceil(playerCount / 2)
  const fcB = flightCounts?.B ?? Math.floor(playerCount / 2)

  const byCategory = []
  const byPlayer   = {}

  for (const [key, dollarVal] of Object.entries(config)) {
    if (!dollarVal || dollarVal <= 0) continue

    const multiplier = keyMultiplier(key)
    const count = multiplier === 'field' ? playerCount : multiplier === 'flight_b' ? fcB : fcA
    const amount = Math.round(dollarVal * count * 100) / 100

    // Skins handled separately
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

  const byPlayerSorted = Object.entries(byPlayer)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([playerId, data]) => ({ playerId, ...data }))

  const totalAllocated = byCategory.reduce((s, c) => s + c.amount, 0)

  return { totalPot, byCategory, byPlayer: byPlayerSorted, totalAllocated }
}
