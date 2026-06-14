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
  // With flights
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
  'skins_a':       'Skins — Flight A',
  'skins_b':       'Skins — Flight B',
  'long_drive_a':  'Long Drive — Flight A',
  'long_drive_b':  'Long Drive — Flight B',
  // No flights (full field)
  '18_net_1st':    '18-Hole Net — 1st',
  '18_net_2nd':    '18-Hole Net — 2nd',
  '18_net_3rd':    '18-Hole Net — 3rd',
  'f9_1st':        'Front 9 Net — 1st',
  'f9_2nd':        'Front 9 Net — 2nd',
  'b9_1st':        'Back 9 Net — 1st',
  'b9_2nd':        'Back 9 Net — 2nd',
  'skins':         'Skins (Full Field)',
  'long_drive':    'Long Drive (Full Field)',
  // Full field regardless
  'low_putts':     'Low Putts (Full Field)',
}

export function ctpLabel(holeNumber) {
  return `Closest to Pin — Hole ${holeNumber} (Full Field)`
}

/** Default per-player dollar amounts for each key */
export const DEFAULT_PAYOUT_CONFIG = {
  // Flight-based
  '18_net_a_1st': 3, '18_net_a_2nd': 2, '18_net_a_3rd': 1,
  '18_net_b_1st': 3, '18_net_b_2nd': 2, '18_net_b_3rd': 1,
  'f9_a_1st': 2, 'f9_a_2nd': 1,
  'f9_b_1st': 2, 'f9_b_2nd': 1,
  'b9_a_1st': 2, 'b9_a_2nd': 1,
  'b9_b_1st': 2, 'b9_b_2nd': 1,
  'skins_a': 2, 'skins_b': 2,
  'long_drive_a': 0, 'long_drive_b': 0,
  // No-flight
  '18_net_1st': 3, '18_net_2nd': 2, '18_net_3rd': 1,
  'f9_1st': 2, 'f9_2nd': 1,
  'b9_1st': 2, 'b9_2nd': 1,
  'skins': 2,
  'long_drive': 0,
  // Full field
  'low_putts': 0,
}

/**
 * Build the set of active payout keys for an event based on its formats/side games.
 * useFlights controls whether flight-split or full-field scoring keys are used.
 */
export function activePayoutKeys(event) {
  const formats  = event.formats ?? (event.format ? [event.format] : ['net_stroke'])
  const sides    = event.side_game_options ?? []
  const flights  = event.use_flights ?? false
  const keys = []

  if (formats.includes('net_stroke')) {
    keys.push(...(flights
      ? ['18_net_a_1st','18_net_a_2nd','18_net_a_3rd','18_net_b_1st','18_net_b_2nd','18_net_b_3rd']
      : ['18_net_1st','18_net_2nd','18_net_3rd']))
  }
  if (formats.includes('net_stroke_front9')) {
    keys.push(...(flights ? ['f9_a_1st','f9_a_2nd','f9_b_1st','f9_b_2nd'] : ['f9_1st','f9_2nd']))
  }
  if (formats.includes('net_stroke_back9')) {
    keys.push(...(flights ? ['b9_a_1st','b9_a_2nd','b9_b_1st','b9_b_2nd'] : ['b9_1st','b9_2nd']))
  }
  if (sides.includes('skins_a'))      keys.push('skins_a')
  if (sides.includes('skins_b'))      keys.push('skins_b')
  if (sides.includes('skins'))        keys.push('skins')
  if (sides.includes('long_drive_a')) keys.push('long_drive_a')
  if (sides.includes('long_drive_b')) keys.push('long_drive_b')
  if (sides.includes('long_drive'))   keys.push('long_drive')
  if (sides.includes('low_putts'))    keys.push('low_putts')
  // CTP keys are dynamic (added by hole number) — handled separately in TabPayoutConfig

  return keys
}

/**
 * Returns 'flight_a', 'flight_b', or 'field' (full player count).
 * No-flight keys and ctp_N / low_putts use full field.
 */
function keyMultiplier(key) {
  if (key === 'low_putts' || key.startsWith('ctp_')) return 'field'
  if (key === 'skins' || key === 'long_drive') return 'field'
  if (key === 'skins_b' || key.includes('_b_') || key === 'long_drive_b') return 'flight_b'
  // No-flight scoring keys (18_net_1st, f9_1st, b9_1st etc.) → full field
  if (!key.includes('_a_') && !key.endsWith('_a') && !key.endsWith('_a_1st') && !key.endsWith('_a_2nd') && !key.endsWith('_a_3rd')) {
    if (key.startsWith('18_net_') || key.startsWith('f9_') || key.startsWith('b9_')) return 'field'
  }
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
  const config   = event.payout_config ?? {}
  const totalPot = (event.payout_basis === 'fixed' && event.payout_fixed_total)
    ? event.payout_fixed_total
    : event.entry_fee * playerCount
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
