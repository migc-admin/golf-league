// Which games count toward a league's season standings.
//
// Every payout belongs to one "bucket". The league's standings settings (leagues.standings_config)
// switch each bucket on or off. Standings are calculated for one league at a time, so events in
// another league (including trips and special-event leagues) never count here.
//
// Pure functions — no React, no Supabase.

/** One row per switch in the league's Standings Settings. `bucket` is what payouts are sorted into. */
export const STANDINGS_TOGGLES = [
  { key: 'include_scoring',        bucket: 'scoring',        label: 'Scoring (Net / Gross / Stableford)', short: 'Scoring',        description: 'Place finishes from net, gross and Stableford formats count toward season earnings' },
  { key: 'include_skins',          bucket: 'skins',          label: 'Skins',                              short: 'Skins',          description: 'Skins hole winnings count toward season earnings' },
  { key: 'include_ctp',            bucket: 'ctp',            label: 'Closest to Pin (CTP)',               short: 'Closest to pin', description: 'CTP winnings count toward season earnings' },
  { key: 'include_long_drive',     bucket: 'long_drive',     label: 'Long Drive',                         short: 'Long drive',     description: 'Long Drive winnings count toward season earnings' },
  { key: 'include_low_putts',      bucket: 'low_putts',      label: 'Low Putts',                          short: 'Low putts',      description: 'Low Putts winnings count toward season earnings' },
  { key: 'include_super_games',    bucket: 'super_games',    label: 'Super Skins and Super CTP',          short: 'Super games',    description: 'Super Skins and Super CTP winnings count toward season earnings' },
  { key: 'include_blind_partners', bucket: 'blind_partners', label: 'Blind Partners',                     short: 'Blind Partners', description: 'Blind Partners winnings count toward season earnings' },
  { key: 'include_nassau',         bucket: 'nassau',         label: 'Nassau',                             short: 'Nassau',         description: 'Nassau bet winnings count toward season earnings' },
]

export const DEFAULT_STANDINGS_CONFIG = {
  include_scoring:        true,
  include_skins:          true,
  include_ctp:            true,
  include_long_drive:     true,
  include_low_putts:      false,
  include_super_games:    false,
  include_blind_partners: false,
  include_nassau:         true,
}

const INCLUDE_KEY = Object.fromEntries(STANDINGS_TOGGLES.map(t => [t.bucket, t.key]))
const SHORT = Object.fromEntries(STANDINGS_TOGGLES.map(t => [t.bucket, t.short]))

/** A league's stored settings with defaults filled in for anything it hasn't set. */
export function standingsConfig(raw) {
  return { ...DEFAULT_STANDINGS_CONFIG, ...(raw ?? {}) }
}

/** Bucket for a payout line's label, e.g. "Super Skins — Flight A (2 skins)" -> 'super_games'. */
export function bucketOfCategory(category = '') {
  if (category.startsWith('Super Skins') || category.startsWith('Super CTP')) return 'super_games'
  if (category.startsWith('Blind Partners')) return 'blind_partners'
  if (category.startsWith('Nassau')) return 'nassau'
  if (category.startsWith('Skins')) return 'skins'
  if (category.startsWith('Closest')) return 'ctp'
  if (category.startsWith('Long Drive')) return 'long_drive'
  if (category.startsWith('Low Putts')) return 'low_putts'
  return 'scoring'
}

/** Bucket for a payout_config / side_game key, e.g. 'super_ctp_a_7' -> 'super_games', '18_net_a_1st' -> 'scoring'. */
export function bucketOfKey(key = '') {
  if (/^super_(skins|ctp)/.test(key)) return 'super_games'
  if (/^blind_partners/.test(key)) return 'blind_partners'
  if (/^nassau/.test(key)) return 'nassau'
  if (/^skins/.test(key)) return 'skins'
  if (/^ctp/.test(key)) return 'ctp'
  if (/^long_drive/.test(key)) return 'long_drive'
  if (/^low_putts/.test(key)) return 'low_putts'
  return 'scoring'
}

/** Does this bucket count toward the league's season standings? */
export function countsTowardStandings(bucket, config) {
  const key = INCLUDE_KEY[bucket]
  return key ? !!standingsConfig(config)[key] : false
}

/** Name of the bucket's switch, for tooltips and legends ("Super games"). */
export function bucketName(bucket) {
  return SHORT[bucket] ?? bucket
}

// ─── Per-event exceptions ─────────────────────────────────────────────────────
// An event can count a game differently from its league. events.standings_overrides holds only the
// games that differ, keyed by bucket: { skins: true } means "count skins for this event even though
// the league doesn't"; { blind_partners: false } is the opposite.

/** Does this bucket count for one event? The event's exception wins; otherwise the league's setting. */
export function countsForEvent(bucket, leagueConfig, overrides) {
  const o = overrides?.[bucket]
  return typeof o === 'boolean' ? o : countsTowardStandings(bucket, leagueConfig)
}

/** The league's settings with an event's exceptions applied (what the standings use for that event). */
export function eventStandingsConfig(leagueConfig, overrides) {
  const cfg = standingsConfig(leagueConfig)
  for (const [bucket, value] of Object.entries(overrides ?? {})) {
    if (typeof value === 'boolean' && INCLUDE_KEY[bucket]) cfg[INCLUDE_KEY[bucket]] = value
  }
  return cfg
}

/** Flip one game for an event. Stores nothing when the result matches the league (so the event follows the league again). */
export function toggleOverride(overrides, bucket, leagueConfig) {
  const next = { ...(overrides ?? {}) }
  const flipped = !countsForEvent(bucket, leagueConfig, overrides)
  if (flipped === countsTowardStandings(bucket, leagueConfig)) delete next[bucket]
  else next[bucket] = flipped
  return next
}
