/**
 * Payout Calculation Engine
 *
 * payout_config (stored as JSON on events) — values are DOLLAR AMOUNTS:
 * - For flight-specific keys (_a_ / _b_): value = $ per player in that flight
 *   → payout total = value × flightPlayerCount
 * - For flat keys (ctp_*, long_drive_a, long_drive_b, long_drive, low_putts): value = flat $ total
 * - For skins keys: value = $ per player in that flight → total pool divided by skin winners
 *
 * Example:
 * {
 *   "18_net_a_1st": 3,   // $3 × flightA players
 *   "18_net_b_1st": 3,   // $3 × flightB players
 *   "ctp_5": 15,         // flat $15 for CTP hole 5
 *   "long_drive_a": 10,  // flat $10 Flight A long drive
 *   "long_drive_b": 10,  // flat $10 Flight B long drive
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
  'low_putts':     'Low Putts (Overall)',
  'long_drive_a':  'Long Drive — Flight A',
  'long_drive_b':  'Long Drive — Flight B',
  'long_drive':    'Long Drive (Overall)',
  'skins_a':       'Skins — Flight A',
  'skins_b':       'Skins — Flight B',
}

export function ctpLabel(holeNumber) {
  return `Closest to Pin — Hole ${holeNumber}`
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
 * Determine how a config key's value should be multiplied.
 * Returns 'flight_a', 'flight_b', or 'flat'.
 */
function keyMultiplier(key) {
  if (key === 'skins_a' || key.includes('_a_') || key === 'long_drive_a') return 'flight_a'
  if (key === 'skins_b' || key.includes('_b_') || key === 'long_drive_b') return 'flight_b'
  return 'flat'
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
    const count = multiplier === 'flight_a' ? fcA : multiplier === 'flight_b' ? fcB : playerCount
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

    const label    = key.startsWith('ctp_') ? ctpLabel(parseInt(key.replace('ctp_', ''), 10)) : (CATEGORY_LABELS[key] ?? key)
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
