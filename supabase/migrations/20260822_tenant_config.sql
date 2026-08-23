-- Add per-tenant configuration column to organizations
-- org_config stores ONLY the overrides from base/tier defaults (sparse).
-- The app merges: BASE_DEFAULTS → TIER_DEFAULTS[tier] → org_config

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS org_config JSONB DEFAULT '{}';

COMMENT ON COLUMN organizations.org_config IS
  'Per-tenant config overrides. Merged on top of base+tier defaults in tenantConfig.js.
   Only store keys that differ from the defaults — keep it sparse.
   Example: {"scoring":{"handicap_method":"callaway"},"features":{"electronic_scoring":true}}';

-- Index for fast JSONB lookups (e.g. querying all orgs with a specific feature enabled)
CREATE INDEX IF NOT EXISTS idx_organizations_org_config
  ON organizations USING GIN (org_config);
