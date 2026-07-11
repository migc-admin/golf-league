/**
 * Tier-based feature gates for Scorify Golf.
 * Tiers: 'free' | 'pro' | 'club'
 */

// ─── Limits ───────────────────────────────────────────────────────────────────
export const TIER_LIMITS = {
  free: {
    leagues:     1,
    players:     16,  // per league/event
    admins:      1,
  },
  pro: {
    leagues:     2,
    players:     Infinity,
    admins:      1,
  },
  club: {
    leagues:     Infinity,
    players:     Infinity,
    admins:      3,
  },
}

// ─── Feature flags ────────────────────────────────────────────────────────────
// Each feature lists the minimum tier required to access it.
export const FEATURE_MIN_TIER = {
  flights:           'pro',
  side_games:        'pro',
  skins:             'pro',
  csv_export:        'pro',
  tgl:               'club',
  custom_branding:   'club',
  registration:      'club',
  multiple_admins:   'club',
}

const TIER_ORDER = ['free', 'pro', 'club']

/**
 * Returns true if the given tier has access to the given feature.
 */
export function hasFeature(tier, feature) {
  const minTier = FEATURE_MIN_TIER[feature]
  if (!minTier) return true // unknown feature = unrestricted
  return TIER_ORDER.indexOf(tier ?? 'free') >= TIER_ORDER.indexOf(minTier)
}

/**
 * Returns the limit for a given resource on a given tier.
 */
export function getLimit(tier, resource) {
  return TIER_LIMITS[tier ?? 'free']?.[resource] ?? TIER_LIMITS.free[resource]
}

/**
 * Returns true if adding one more would exceed the tier limit.
 */
export function atLimit(tier, resource, currentCount) {
  const limit = getLimit(tier, resource)
  return currentCount >= limit
}

/**
 * Human-readable tier name.
 */
export const TIER_LABELS = {
  free:  'Starter',
  pro:   'Pro',
  club:  'Club',
}

/**
 * The next tier up from the given tier.
 */
export function nextTier(tier) {
  const idx = TIER_ORDER.indexOf(tier ?? 'free')
  return TIER_ORDER[idx + 1] ?? 'club'
}
