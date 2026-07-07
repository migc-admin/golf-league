/**
 * Tier-based feature gates for Scorify Golf.
 * Tiers: 'free' | 'pro' | 'elite'
 */

export const TIER_FEATURES = {
  free:  ['scoring', 'leaderboard', 'flights', 'side_games', 'skins'],
  pro:   ['scoring', 'leaderboard', 'flights', 'side_games', 'skins', 'tgl', 'trip_manager'],
  elite: ['scoring', 'leaderboard', 'flights', 'side_games', 'skins', 'tgl', 'trip_manager', 'registration', 'stripe', 'event_websites'],
}

export const TIER_LABELS = {
  free:  'Free',
  pro:   'Pro',
  elite: 'Elite',
}

export const FEATURE_TIER = {}
for (const [tier, features] of Object.entries(TIER_FEATURES)) {
  for (const f of features) {
    // Only record the LOWEST tier that unlocks a feature
    if (!FEATURE_TIER[f]) FEATURE_TIER[f] = tier
  }
}

/**
 * Returns true if the given tier has access to the given feature.
 */
export function hasFeature(tier, feature) {
  const tierFeatures = TIER_FEATURES[tier] ?? TIER_FEATURES.free
  return tierFeatures.includes(feature)
}

/**
 * Returns the minimum tier required for a feature.
 */
export function requiredTier(feature) {
  return FEATURE_TIER[feature] ?? 'elite'
}
