/**
 * Payout Calculation Engine
 *
 * payout_config values are $ PER PLAYER with these multipliers:
 * - low_putts, ctp_N, no-flight scoring → × total field (all players)
 * - skins_a / long_drive_a / 18_net_a_1st → × Flight A player count
 * - skins_b / long_drive_b / 18_net_b_1st → × Flight B player count
 * - skins_c / long_drive_c / 18_net_c_1st → × Flight C player count
 * (any letter works — dynamic based on num_flights)
 */

import { computeSkinsPayout } from './skins.js'

// Extract base competition and rank from a ranked key (e.g. '18_net_a_2nd' → { base: '18_net_a', rank: 2 })
function getRankInfo(key) {
  if (key.endsWith('_1st')) return { base: key.slice(0, -4), rank: 1 }
  if (key.endsWith('_2nd')) return { base: key.slice(0, -4), rank: 2 }
  if (key.endsWith('_3rd')) return { base: key.slice(0, -4), rank: 3 }
  return null
}

/** Extract flight letter (uppercase) from a per-flight key, or null for full-field keys */
function flightLetterOf(key) {
  // skins_a, long_drive_b, low_putts_c
  const sideMatch = key.match(/^(?:skins|long_drive|low_putts)_([a-z])$/)
  if (sideMatch) return sideMatch[1].toUpperCase()
  // 18_net_a_1st, 18_gross_a_1st, f9_b_2nd, b9_c_3rd
  const scoringMatch = key.match(/^(?:18_net|18_gross|f9|b9)_([a-z])_(?:1st|2nd|3rd)$/)
  if (scoringMatch) return scoringMatch[1].toUpperCase()
  return null
}

/** Human-readable label for any payout key */
export function getCategoryLabel(key) {
  // CTP handled separately
  if (key.startsWith('ctp_'))       return `Closest to Pin — Hole ${key.replace('ctp_', '')} (Full Field)`
  if (key.startsWith('super_ctp_')) return `Super CTP — Hole ${key.replace('super_ctp_', '')} (Full Field)`

  // Full-field side games
  if (key === 'skins')           return 'Skins (Full Field)'
  if (key === 'super_skins')     return 'Super Skins (Full Field)'
  if (key === 'long_drive')      return 'Long Drive (Full Field)'
  if (key === 'low_putts')       return 'Low Putts (Full Field)'
  if (key === 'blind_partners')  return 'Blind Partners'

  // No-flight scoring
  if (key === '18_net_1st') return '18-Hole Net — 1st'
  if (key === '18_net_2nd') return '18-Hole Net — 2nd'
  if (key === '18_net_3rd') return '18-Hole Net — 3rd'
  if (key === 'f9_1st')     return 'Front 9 Net — 1st'
  if (key === 'f9_2nd')     return 'Front 9 Net — 2nd'
  if (key === 'b9_1st')     return 'Back 9 Net — 1st'
  if (key === 'b9_2nd')     return 'Back 9 Net — 2nd'
  if (key === '18_gross_1st') return 'Low Gross — 1st'
  if (key === '18_gross_2nd') return 'Low Gross — 2nd'
  if (key === '18_gross_3rd') return 'Low Gross — 3rd'

  // Per-flight patterns — any letter
  const fl = flightLetterOf(key)
  if (fl) {
    if (key.startsWith('super_skins_')) return `Super Skins — Flight ${fl}`
    if (key.startsWith('skins_'))       return `Skins — Flight ${fl}`
    if (key.startsWith('long_drive_'))  return `Long Drive — Flight ${fl}`
    if (key.startsWith('low_putts_'))  return `Low Putts — Flight ${fl}`
    if (key.startsWith('18_net_')) {
      const rank = key.split('_').pop()
      return `18-Hole Net — Flight ${fl}, ${rank}`
    }
    if (key.startsWith('18_gross_')) {
      const rank = key.split('_').pop()
      return `Low Gross — Flight ${fl}, ${rank}`
    }
    if (key.startsWith('f9_')) {
      const rank = key.split('_').pop()
      return `Front 9 Net — Flight ${fl}, ${rank}`
    }
    if (key.startsWith('b9_')) {
      const rank = key.split('_').pop()
      return `Back 9 Net — Flight ${fl}, ${rank}`
    }
  }
  return key
}

// Legacy export kept for any remaining references
export const CATEGORY_LABELS = new Proxy({}, {
  get(_, key) { return getCategoryLabel(key) }
})

export function ctpLabel(holeNumber) {
  return `Closest to Pin — Hole ${holeNumber} (Full Field)`
}

/** Default per-player dollar amounts */
export const DEFAULT_PAYOUT_CONFIG = {
  // Per-flight (A/B defaults — applied to any letter)
  '18_net_a_1st': 3, '18_net_a_2nd': 2, '18_net_a_3rd': 1,
  '18_net_b_1st': 3, '18_net_b_2nd': 2, '18_net_b_3rd': 1,
  '18_gross_a_1st': 3, '18_gross_a_2nd': 2, '18_gross_a_3rd': 1,
  '18_gross_b_1st': 3, '18_gross_b_2nd': 2, '18_gross_b_3rd': 1,
  'f9_a_1st': 2, 'f9_a_2nd': 1,
  'f9_b_1st': 2, 'f9_b_2nd': 1,
  'b9_a_1st': 2, 'b9_a_2nd': 1,
  'b9_b_1st': 2, 'b9_b_2nd': 1,
  'skins_a': 2, 'skins_b': 2,
  'long_drive_a': 0, 'long_drive_b': 0,
  // No-flight
  '18_net_1st': 3, '18_net_2nd': 2, '18_net_3rd': 1,
  '18_gross_1st': 3, '18_gross_2nd': 2, '18_gross_3rd': 1,
  'f9_1st': 2, 'f9_2nd': 1,
  'b9_1st': 2, 'b9_2nd': 1,
  'skins': 2,
  'long_drive': 0,
  // Full field
  'low_putts': 0,
}

function defaultForKey(key) {
  if (DEFAULT_PAYOUT_CONFIG[key] !== undefined) return DEFAULT_PAYOUT_CONFIG[key]
  // For flights C+ use same defaults as A
  const fl = flightLetterOf(key)
  if (fl && fl !== 'A' && fl !== 'B') {
    const aKey = key.replace(`_${fl.toLowerCase()}`, '_a')
    return DEFAULT_PAYOUT_CONFIG[aKey] ?? 0
  }
  return 0
}

/**
 * Build the set of active payout keys for an event based on its formats/side games.
 * Uses num_flights (integer) for number of competitive flights.
 * Uses payout_places (jsonb) for how many places to pay per format.
 *
 * Format keys without a flight-letter suffix (e.g. 'net_stroke') indicate
 * "whole group" scoring. Flight-suffixed keys (e.g. 'net_stroke_a') indicate
 * per-flight scoring for that specific flight.
 */
export function activePayoutKeys(event) {
  const formats    = event.formats ?? (event.format ? [event.format] : ['net_stroke'])
  const sides      = event.side_game_options ?? []
  const numFlights = event.num_flights ?? (event.use_flights ? 2 : 0)
  const hasFlights = numFlights > 0
  const flightLetters = hasFlights
    ? Array.from({ length: numFlights }, (_, i) => String.fromCharCode(97 + i))  // ['a','b','c',...]
    : []
  const payoutPlaces = event.payout_places ?? {}
  const keys = []

  // Helper: push ranked keys (e.g. baseKey='18_net_a', placeCount=3 → '18_net_a_1st' etc.)
  function addRanked(baseKey, placeCount, maxPlaces) {
    const n = Math.min(placeCount, maxPlaces)
    Array.from({ length: n }, (_, i) => ['1st','2nd','3rd'][i]).forEach(p => keys.push(`${baseKey}_${p}`))
  }

  for (const fmt of formats) {
    // Net Stroke Play — Full 18
    if (fmt === 'net_stroke') {
      // Whole-group (no flight letter): always use full-field keys
      addRanked('18_net', payoutPlaces.net_stroke ?? 3, 3)
    } else if (/^net_stroke_[a-z]$/.test(fmt)) {
      // Per-flight: one format key per flight letter
      addRanked(`18_net_${fmt.slice(-1)}`, payoutPlaces.net_stroke ?? 3, 3)
    }

    // Low Gross — Full 18
    else if (fmt === 'low_gross') {
      addRanked('18_gross', payoutPlaces.low_gross ?? 3, 3)
    } else if (/^low_gross_[a-z]$/.test(fmt)) {
      addRanked(`18_gross_${fmt.slice(-1)}`, payoutPlaces.low_gross ?? 3, 3)
    }

    // Net Front 9
    else if (fmt === 'net_stroke_front9') {
      addRanked('f9', payoutPlaces.net_stroke_front9 ?? 2, 2)
    } else if (/^net_stroke_front9_[a-z]$/.test(fmt)) {
      addRanked(`f9_${fmt.slice(-1)}`, payoutPlaces.net_stroke_front9 ?? 2, 2)
    }

    // Net Back 9
    else if (fmt === 'net_stroke_back9') {
      addRanked('b9', payoutPlaces.net_stroke_back9 ?? 2, 2)
    } else if (/^net_stroke_back9_[a-z]$/.test(fmt)) {
      addRanked(`b9_${fmt.slice(-1)}`, payoutPlaces.net_stroke_back9 ?? 2, 2)
    }

    // Gross Front 9 / Gross Back 9 — scoring only, no dedicated payout keys
  }

  // Skins — any flight letter or whole-group (from side_game_options)
  sides.filter(s => s === 'skins' || s.match(/^skins_[a-z]$/)).forEach(s => keys.push(s))
  // Long Drive
  sides.filter(s => s === 'long_drive' || s.match(/^long_drive_[a-z]$/)).forEach(s => keys.push(s))
  // Low Putts — whole-group or per-flight
  sides.filter(s => s === 'low_putts' || s.match(/^low_putts_[a-z]$/)).forEach(s => keys.push(s))
  // CTP keys are dynamic (added by hole number) — handled separately in TabPayoutConfig

  return keys
}

/**
 * Returns 'field' or 'flight_X' (where X is the lowercase letter).
 */
function keyMultiplier(key) {
  const fl = flightLetterOf(key)
  if (fl) return `flight_${fl.toLowerCase()}`
  return 'field'
}

// Returns array of player_ids (multiple when tied)
function resolveWinners(key, leaderboards, sideGames) {
  const rankMap = { '1st': 1, '2nd': 2, '3rd': 3 }

  // 18-hole net (per-flight or full field)
  if (key.startsWith('18_net_')) {
    const fl = flightLetterOf(key)
    const suffix = key.split('_').pop()
    const rank = rankMap[suffix]
    const list = fl
      ? (leaderboards.full?.[fl] ?? [])
      : Object.values(leaderboards.full ?? {}).flat()
    return list.filter(p => p.rank === rank).map(p => p.player_id)
  }
  // Low Gross (18-hole, per-flight or full field)
  if (key.startsWith('18_gross_')) {
    const fl = flightLetterOf(key)
    const suffix = key.split('_').pop()
    const rank = rankMap[suffix]
    const list = fl
      ? (leaderboards.grossFull?.[fl] ?? [])
      : Object.values(leaderboards.grossFull ?? {}).flat()
    return list.filter(p => p.rank === rank).map(p => p.player_id)
  }
  // Front 9
  if (key.startsWith('f9_')) {
    const fl = flightLetterOf(key)
    const rank = rankMap[key.split('_').pop()]
    const list = fl
      ? (leaderboards.front9?.[fl] ?? [])
      : Object.values(leaderboards.front9 ?? {}).flat()
    return list.filter(p => p.rank === rank).map(p => p.player_id)
  }
  // Back 9
  if (key.startsWith('b9_')) {
    const fl = flightLetterOf(key)
    const rank = rankMap[key.split('_').pop()]
    const list = fl
      ? (leaderboards.back9?.[fl] ?? [])
      : Object.values(leaderboards.back9 ?? {}).flat()
    return list.filter(p => p.rank === rank).map(p => p.player_id)
  }
  // Low Putts (full field)
  if (key === 'low_putts') {
    const manual = sideGames.find(g => g.game_type === 'low_putts')
    if (manual?.winner_player_id) return [manual.winner_player_id]
    const top = leaderboards.putts?.[0]
    if (!top) return []
    return leaderboards.putts.filter(p => p.rank === top.rank).map(p => p.player_id)
  }
  // Long Drive — any flight letter or full field
  if (key.startsWith('long_drive')) {
    const fl = flightLetterOf(key)
    const g = sideGames.find(g =>
      g.game_type === 'long_drive' && (fl ? g.flight === fl : !g.flight || g.flight === 'overall')
    )
    return g?.winner_player_id ? [g.winner_player_id] : []
  }
  // CTP
  if (key.startsWith('ctp_')) {
    const holeNum = parseInt(key.replace('ctp_', ''), 10)
    const g = sideGames.find(g => g.game_type === 'ctp' && g.hole_number === holeNum)
    return g?.winner_player_id ? [g.winner_player_id] : []
  }
  return []
}

/**
 * Compute full payout summary for an event.
 *
 * @param {Object} event          — { entry_fee, payout_config }
 * @param {number} playerCount    — total non-guest players
 * @param {Object} leaderboards   — from scoring.computeLeaderboards
 * @param {Array}  sideGames
 * @param {Object} skinsResults   — { A: skinsResult, B: skinsResult, ... }
 * @param {Object} flightCounts   — { A: number, B: number, C: number, ... }
 */
export function computePayouts(event, playerCount, leaderboards, sideGames, skinsResults, flightCounts) {
  const config   = event.payout_config ?? {}
  const totalPot = (event.payout_basis === 'fixed' && event.payout_fixed_total)
    ? event.payout_fixed_total
    : event.entry_fee * playerCount

  function getFlightCount(fl) {
    if (!fl) return playerCount
    // fl is uppercase letter
    if (flightCounts?.[fl] !== undefined) return flightCounts[fl]
    // Fallback: split evenly
    const numFlights = Object.keys(flightCounts ?? {}).length || 2
    return Math.round(playerCount / numFlights)
  }

  const byCategory = []
  const byPlayer   = {}

  const rankedGroups = {}
  const standaloneEntries = []

  for (const [key, dollarVal] of Object.entries(config)) {
    if (!dollarVal || dollarVal <= 0) continue
    const multiplier = keyMultiplier(key)
    const fl = multiplier.startsWith('flight_') ? multiplier.replace('flight_', '').toUpperCase() : null
    const count = getFlightCount(fl)
    const amount = Math.round(dollarVal * count * 100) / 100
    const rankInfo = getRankInfo(key)
    if (rankInfo) {
      if (!rankedGroups[rankInfo.base]) rankedGroups[rankInfo.base] = []
      rankedGroups[rankInfo.base].push({ key, rank: rankInfo.rank, amount })
    } else {
      standaloneEntries.push({ key, amount })
    }
  }

  // Process ranked groups with tie-absorption
  for (const places of Object.values(rankedGroups)) {
    places.sort((a, b) => a.rank - b.rank)
    const absorbed = new Set()

    for (let i = 0; i < places.length; i++) {
      const place = places[i]
      if (absorbed.has(place.rank)) continue

      const winners = resolveWinners(place.key, leaderboards, sideGames)
      const label = getCategoryLabel(place.key)

      if (winners.length > 1) {
        let combinedAmount = place.amount
        for (let j = 1; j < winners.length && i + j < places.length; j++) {
          absorbed.add(places[i + j].rank)
          combinedAmount += places[i + j].amount
        }
        const split = Math.round((combinedAmount / winners.length) * 100) / 100
        const tieLabel = `${label} (Tied — split ${winners.length} ways)`
        byCategory.push({ key: place.key, label: tieLabel, amount: combinedAmount, playerIds: winners, isSkin: false, isTied: true })
        for (const pid of winners) {
          if (!byPlayer[pid]) byPlayer[pid] = { total: 0, items: [] }
          byPlayer[pid].total += split
          byPlayer[pid].items.push({ category: tieLabel, amount: split })
        }
      } else {
        byCategory.push({ key: place.key, label, amount: place.amount, playerId: winners[0] ?? null, playerIds: winners, isSkin: false, isTied: false })
        if (winners[0]) {
          if (!byPlayer[winners[0]]) byPlayer[winners[0]] = { total: 0, items: [] }
          byPlayer[winners[0]].total += place.amount
          byPlayer[winners[0]].items.push({ category: label, amount: place.amount })
        }
      }
    }
  }

  // Process standalone keys (skins, long drive, low putts, ctp)
  for (const { key, amount } of standaloneEntries) {
    // Skins — any flight letter
    const skinsFlightMatch = key.match(/^skins_([a-z])$/)
    if (key === 'skins' || skinsFlightMatch) {
      const fl = skinsFlightMatch ? skinsFlightMatch[1].toUpperCase() : null
      const skinsResult = fl ? skinsResults?.[fl] : skinsResults?.[''] ?? Object.values(skinsResults ?? {})[0]
      if (!skinsResult) continue
      const skinPayouts = computeSkinsPayout(skinsResult, amount)
      for (const sp of skinPayouts) {
        const label = `${getCategoryLabel(key)} (${sp.skinsWon} skin${sp.skinsWon !== 1 ? 's' : ''})`
        byCategory.push({ key: `${key}_${sp.playerId}`, label, amount: sp.total, playerId: sp.playerId, isSkin: true })
        if (!byPlayer[sp.playerId]) byPlayer[sp.playerId] = { total: 0, items: [] }
        byPlayer[sp.playerId].total += sp.total
        byPlayer[sp.playerId].items.push({ category: label, amount: sp.total })
      }
      continue
    }

    const label   = getCategoryLabel(key)
    const winners = resolveWinners(key, leaderboards, sideGames)
    const isTied  = winners.length > 1
    const split   = winners.length > 0 ? Math.round((amount / winners.length) * 100) / 100 : 0
    const tieLabel = isTied ? `${label} (Tied — split ${winners.length} ways)` : label

    byCategory.push({ key, label: tieLabel, amount, playerId: winners[0] ?? null, playerIds: winners, isSkin: false, isTied })
    for (const pid of winners) {
      if (!byPlayer[pid]) byPlayer[pid] = { total: 0, items: [] }
      byPlayer[pid].total += split
      byPlayer[pid].items.push({ category: tieLabel, amount: split })
    }
  }

  const byPlayerSorted = Object.entries(byPlayer)
    .sort(([, a], [, b]) => b.total - a.total)
    .map(([playerId, data]) => ({ playerId, ...data }))

  const totalAllocated = byCategory.reduce((s, c) => s + c.amount, 0)

  return { totalPot, byCategory, byPlayer: byPlayerSorted, totalAllocated }
}

// Re-export for backwards compat
export { defaultForKey }
