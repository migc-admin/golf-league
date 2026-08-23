/**
 * TenantProvider — tenant resolution middleware for Scorify Golf.
 *
 * Identifies the current tenant on every page load via two strategies:
 *   1. Subdomain  — mulligans-island.scorifygolf.com  → slug = 'mulligans-island'
 *   2. URL param  — /mulligans-island/...             → slug from route context
 *
 * Fetches org + org_config from DB once, merges the three-layer config,
 * and exposes everything via useTenant().
 *
 * Components never need to know HOW the tenant was resolved — they just call
 * useTenant() and get the merged result.
 */

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'
import {
  resolveConfig,
  resolveFeature,
  resolveLimit,
  atLimit as atLimitFn,
} from './tenantConfig'

// ─── Context ─────────────────────────────────────────────────────────────────
const TenantContext = createContext(null)

// ─── Provider ─────────────────────────────────────────────────────────────────
/**
 * @param {string|null} orgSlug  — resolved by caller (from subdomain or route param)
 * @param {ReactNode}   children
 */
export function TenantProvider({ orgSlug, children }) {
  const [org,     setOrg]     = useState(null)
  const [config,  setConfig]  = useState(null)
  const [loading, setLoading] = useState(!!orgSlug)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    if (!orgSlug) {
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    supabase
      .from('organizations')
      .select('id, name, slug, logo_url, tier, org_config')
      .eq('slug', orgSlug)
      .single()
      .then(({ data, error: err }) => {
        if (cancelled) return
        if (err || !data) {
          setError('Organization not found')
          setLoading(false)
          return
        }
        const merged = resolveConfig(data.tier, data.org_config)
        setOrg(data)
        setConfig(merged)
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [orgSlug])

  // Convenience: check a feature flag for this tenant
  const hasFeature = useCallback(
    (feature) => resolveFeature(org?.tier, feature, config),
    [org, config]
  )

  // Convenience: get a resource limit for this tenant
  const getLimit = useCallback(
    (resource) => resolveLimit(org?.tier, resource),
    [org]
  )

  // Convenience: check if tenant is at a resource limit
  const isAtLimit = useCallback(
    (resource, currentCount) => atLimitFn(org?.tier, resource, currentCount),
    [org]
  )

  const value = {
    org,
    config,
    loading,
    error,
    hasFeature,
    getLimit,
    isAtLimit,
    // Raw tier for components that need it
    tier: org?.tier ?? 'free',
  }

  return (
    <TenantContext.Provider value={value}>
      {children}
    </TenantContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
/**
 * Access the current tenant anywhere in the tree.
 *
 * @returns {{
 *   org: Object|null,
 *   config: Object|null,
 *   loading: boolean,
 *   error: string|null,
 *   tier: string,
 *   hasFeature: (feature: string) => boolean,
 *   getLimit: (resource: string) => number,
 *   isAtLimit: (resource: string, currentCount: number) => boolean,
 * }}
 */
export function useTenant() {
  const ctx = useContext(TenantContext)
  // Return a safe no-op context when used outside a TenantProvider
  // (e.g. admin pages that don't have an org in context)
  if (!ctx) {
    return {
      org:        null,
      config:     null,
      loading:    false,
      error:      null,
      tier:       'free',
      hasFeature: () => false,
      getLimit:   () => 0,
      isAtLimit:  () => true,
    }
  }
  return ctx
}

// ─── Tenant-aware routing middleware ─────────────────────────────────────────
/**
 * Wraps children in TenantProvider using a slug from route params.
 * Drop this around any route group that has :orgSlug in the URL.
 *
 * Usage in App.jsx:
 *   <Route path="/:orgSlug/*" element={<TenantRouteWrapper />}>
 *     ...child routes...
 *   </Route>
 */
import { useParams } from 'react-router-dom'

export function TenantRouteWrapper({ children }) {
  const { orgSlug } = useParams()
  return <TenantProvider orgSlug={orgSlug}>{children}</TenantProvider>
}

/**
 * Wraps children in TenantProvider using a hardcoded slug.
 * Used for subdomain routing where the slug comes from useSubdomain().
 */
export function TenantSubdomainWrapper({ orgSlug, children }) {
  return <TenantProvider orgSlug={orgSlug}>{children}</TenantProvider>
}
