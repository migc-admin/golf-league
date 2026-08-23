/**
 * Tenant Configuration System
 *
 * Three-layer inheritance (each layer overrides the one above):
 *   1. BASE_DEFAULTS   — applies to every org regardless of tier
 *   2. TIER_DEFAULTS   — applied based on org.tier (free / pro / club)
 *   3. org_config      — per-org overrides stored in DB (sparse — only what differs)
 *
 * Usage:
 *   const { config, hasFeature, getLimit } = useTenant()
 *   config.scoring.handicap_method  → 'usga'
 *   hasFeature('electronic_scoring') → true/false
 */

// ─── 1. Base defaults — all orgs ─────────────────────────────────────────────
export const BASE_DEFAULTS = {
  scoring: {
    handicap_method:    'usga',   // 'usga' | 'callaway' | 'none'
    allowance_pct:      90,
    max_handicap:       36,
    holes_default:      18,       // 9 | 18
  },
  display: {
    show_money_list:      true,
    leaderboard_public:   true,
    show_course_handicap: true,
    show_flight_labels:   true,
  },
  registration: {
    public_registration:  false,
    require_approval:     false,
  },
  branding: {
    primary_color: '#1B4332',
    accent_color:  '#D4AF37',
    custom_allowed: false,
  },
  features: {
    // Per-org feature flag overrides on top of tier gates
    // e.g. { electronic_scoring: true } to grant a free org early access
  },
}

// ─── 2. Tier defaults — layered on top of base ────────────────────────────────
export const TIER_DEFAULTS = {
  free: {
    // No changes from base
  },
  pro: {
    registration: {
      public_registration: true,
    },
    display: {
      show_money_list: true,
    },
  },
  club: {
    registration: {
      public_registration:  true,
      require_approval:     false,
    },
    branding: {
      custom_allowed: true,
    },
  },
}

// ─── Feature flags — tier-gated + per-org overridable ────────────────────────
export const FEATURE_TIERS = {
  // key: minimum tier required
  flights:              'pro',
  side_games:           'pro',
  skins:                'pro',
  csv_export:           'pro',
  electronic_scoring:   'pro',
  print_assets:         'pro',
  tgl:                  'club',
  custom_branding:      'club',
  registration:         'club',
  multiple_admins:      'club',
  season_standings:     'pro',
  subdomain:            'club',
}

// ─── Limits per tier ─────────────────────────────────────────────────────────
export const TIER_LIMITS = {
  free: {
    leagues:  1,
    players:  16,
    events:   2,
    admins:   1,
  },
  pro: {
    leagues:  5,
    players:  Infinity,
    events:   Infinity,
    admins:   1,
  },
  club: {
    leagues:  Infinity,
    players:  Infinity,
    events:   Infinity,
    admins:   3,
  },
}

const TIER_ORDER = ['free', 'pro', 'club']

// ─── Deep merge utility ──────────────────────────────────────────────────────
function deepMerge(base, override) {
  if (!override) return base
  const result = { ...base }
  for (const key of Object.keys(override)) {
    if (
      override[key] !== null &&
      typeof override[key] === 'object' &&
      !Array.isArray(override[key]) &&
      typeof base[key] === 'object'
    ) {
      result[key] = deepMerge(base[key] ?? {}, override[key])
    } else {
      result[key] = override[key]
    }
  }
  return result
}

// ─── Resolve merged config for an org ────────────────────────────────────────
/**
 * Merges base → tier → org_config in order.
 * @param {string} tier           — 'free' | 'pro' | 'club'
 * @param {Object} orgConfig      — raw org_config from DB (may be null)
 * @returns {Object}              — fully resolved config
 */
export function resolveConfig(tier, orgConfig) {
  const tierLayer = TIER_DEFAULTS[tier ?? 'free'] ?? {}
  const withTier  = deepMerge(BASE_DEFAULTS, tierLayer)
  return deepMerge(withTier, orgConfig ?? {})
}

// ─── Feature resolution ───────────────────────────────────────────────────────
/**
 * Returns true if org has access to a feature.
 * Tier gate is checked first, then per-org override in config.features.
 *
 * @param {string} tier
 * @param {string} feature
 * @param {Object} config     — resolved config (from resolveConfig)
 */
export function resolveFeature(tier, feature, config) {
  // Per-org override takes precedence (grants OR revokes)
  if (config?.features?.[feature] !== undefined) {
    return Boolean(config.features[feature])
  }
  const minTier = FEATURE_TIERS[feature]
  if (!minTier) return true  // unknown feature = unrestricted
  return TIER_ORDER.indexOf(tier ?? 'free') >= TIER_ORDER.indexOf(minTier)
}

/**
 * Returns the resource limit for a tier.
 */
export function resolveLimit(tier, resource) {
  return TIER_LIMITS[tier ?? 'free']?.[resource] ?? TIER_LIMITS.free[resource]
}

/**
 * Returns true if adding one more would exceed the limit.
 */
export function atLimit(tier, resource, currentCount) {
  const limit = resolveLimit(tier, resource)
  return currentCount >= limit
}

export const TIER_LABELS = { free: 'Starter', pro: 'Pro', club: 'Club' }
export function nextTier(tier) {
  const idx = TIER_ORDER.indexOf(tier ?? 'free')
  return TIER_ORDER[idx + 1] ?? 'club'
}
