// Side Games — shared constants & helpers for "Separate buy-in" games.
//
// Any of the 7 side games below can be flagged "Separate buy-in" on an event
// (via event.side_game_buy_ins[baseKey].enabled). Nothing is assumed — the flag
// is always an explicit admin choice. When flagged, the game:
//   1. Gets an opt-in roster + paid-tracking in the Side Games admin tab.
//   2. Gets its own row(s) in the Payout tab's "Separate Buy-in" tables,
//      funded by actual opted-in entrants (not the full field/flight count).
//   3. Is offered on the public QR self-serve opt-in page (OptIn.jsx).
// When NOT flagged, the game is funded out of the event entry fee and the whole
// field (or whole flight, per its scope) is eligible — no opt-in roster.
//
// Scope ("Per flight" vs "Whole group", encoded as a flight suffix in
// side_game_options, e.g. super_skins_a) is orthogonal to the buy-in flag: it
// only decides how the competition is pooled. A per-flight game pays out an
// independent pot per flight, and only players in that flight can win it.
//
// Shared between admin (EventDetail.jsx), the payout engine (engines/payouts.js),
// the public event page (EventPage.jsx), the public opt-in page (OptIn.jsx),
// and printable Check-In QR signage (PrintAssets.jsx).

export const BUY_IN_ELIGIBLE_KEYS = new Set([
  'skins', 'long_drive', 'low_putts', 'ctp', 'super_ctp', 'super_skins', 'blind_partners',
])

export const OPT_IN_GAME_LABELS = {
  skins:          'Skins',
  long_drive:     'Long Drive',
  low_putts:      'Low Putts',
  ctp:            'Closest to Pin',
  super_ctp:      'Super CTP',
  super_skins:    'Super Skins',
  blind_partners: 'Blind Partners',
}

/** Is `baseKey` explicitly flagged "Separate buy-in" on this event? */
export function isBuyInEnabled(event, baseKey) {
  return !!(event?.side_game_buy_ins?.[baseKey]?.enabled)
}

/**
 * Map any payout_config / side_game key back to its base game key
 * (e.g. 'skins_a' → 'skins', 'super_ctp_a_7' → 'super_ctp', 'ctp_7' → 'ctp'),
 * or null when the key isn't one of the 7 buy-in-eligible side games
 * (e.g. scoring-format keys like '18_net_a_1st').
 */
export function baseSideGameKey(key) {
  if (/^super_ctp(?:_[a-z])?_\d+$/.test(key)) return 'super_ctp'
  if (/^ctp_\d+$/.test(key)) return 'ctp'
  const m = key.match(/^(super_skins|blind_partners|skins|long_drive|low_putts)(?:_[a-z])?$/)
  if (m) return m[1]
  return null
}

/**
 * Every side game key that resolves to `baseKey` on this event, suffixed or not
 * (e.g. baseKey 'blind_partners' → ['blind_partners_a','blind_partners_b']).
 * Use this instead of `side_game_options.includes('blind_partners')` so a game
 * doesn't silently vanish once an admin scopes it per flight.
 */
export function sideGameKeysFor(event, baseKey) {
  return (event?.side_game_options ?? []).filter(k => baseSideGameKey(k) === baseKey)
}

/** Is `baseKey` enabled on this event at all, under any scope? */
export function isSideGameEnabled(event, baseKey) {
  return sideGameKeysFor(event, baseKey).length > 0
}

/** Is `baseKey` scoped "Per flight" (independent pot per flight) on this event? */
export function isPerFlight(event, baseKey) {
  return sideGameKeysFor(event, baseKey).some(k => sideKeyFlight(k) !== null)
}

/** Flight letter (uppercase) encoded in a side-game key, or null for whole-group/flat keys. */
export function sideKeyFlight(key) {
  const m = key.match(/^(?:skins|super_skins|long_drive|low_putts|blind_partners)_([a-z])$/)
  if (m) return m[1].toUpperCase()
  const sc = key.match(/^super_ctp_([a-z])_\d+$/)
  if (sc) return sc[1].toUpperCase()
  return null
}

/**
 * $ per entrant for a buy-in game, read from Payout Config (the single source
 * of truth — never side_game_buy_ins.amount). Pass `flight` ('A'/'B'/...) to
 * resolve a per-flight rate; omit it for the flat/whole-group rate (or, for
 * display purposes on a flight-scoped game, whichever rate happens to be set).
 */
export function optInAmount(event, key, flight = null) {
  const config = event?.payout_config ?? {}
  const fl = flight ? flight.toLowerCase() : null

  if (key === 'ctp') {
    // Regular CTP can span multiple holes — the roster is one combined pool,
    // so the total buy-in amount is the sum of all configured ctp_N rates.
    const total = Object.entries(config)
      .filter(([k]) => k.startsWith('ctp_'))
      .reduce((sum, [, v]) => sum + (v || 0), 0)
    return total > 0 ? total : null
  }
  if (key === 'super_ctp') {
    const hole = event?.super_ctp_hole
    if (hole == null) return null
    if (fl) return config[`super_ctp_${fl}_${hole}`] ?? config[`super_ctp_${hole}`] ?? null
    return config[`super_ctp_${hole}`] ?? config[`super_ctp_a_${hole}`] ?? config[`super_ctp_b_${hole}`] ?? null
  }
  // skins, long_drive, low_putts, super_skins, blind_partners — single
  // per-flight-or-flat key
  if (fl) return config[`${key}_${fl}`] ?? config[key] ?? null
  return config[key] ?? config[`${key}_a`] ?? config[`${key}_b`] ?? null
}
