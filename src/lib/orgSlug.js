import { supabase } from './supabase'

// Subdomains that must never be assignable to an org — either because they're
// already claimed by the app itself (app, www) or because they'd be confusing/
// unsafe as a tenant's public-facing subdomain (api, admin, auth, etc).
export const RESERVED_SLUGS = [
  'api', 'app', 'auth', 'admin', 'www', 'billing', 'support',
  'login', 'signup', 'register', 'docs', 'mail', 'status', 'help',
]

export function slugify(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 40)
}

/**
 * Resolves a base string (org name or a user-chosen custom slug) to a safe,
 * unique org slug — appending a random suffix if it collides with a reserved
 * word or an existing org's slug. Used where silent fallback is acceptable,
 * e.g. auto-deriving a slug from the org name during signup.
 *
 * @param {string} base            raw input to slugify
 * @param {string} [excludeOrgId]  org id to exclude from the uniqueness check
 *                                 (pass the org's own id when re-saving its slug)
 */
export async function resolveUniqueOrgSlug(base, excludeOrgId) {
  const baseSlug = slugify(base)

  let query = supabase.from('organizations').select('id').eq('slug', baseSlug)
  if (excludeOrgId) query = query.neq('id', excludeOrgId)
  const { data: existing } = await query.maybeSingle()

  const isTaken = !!existing || RESERVED_SLUGS.includes(baseSlug)
  return isTaken ? `${baseSlug}-${Math.random().toString(36).slice(2, 6)}` : baseSlug
}

/**
 * Checks whether a user-chosen slug is available, without silently altering
 * it. Used where the user deliberately picked a value and should be told
 * "no" rather than getting a different slug than what they asked for.
 *
 * @param {string} base            raw input to slugify
 * @param {string} [excludeOrgId]  org id to exclude from the uniqueness check
 * @returns {Promise<{ slug: string, available: boolean, reason?: string }>}
 */
export async function checkSlugAvailable(base, excludeOrgId) {
  const slug = slugify(base)

  if (RESERVED_SLUGS.includes(slug)) {
    return { slug, available: false, reason: `"${slug}" is a reserved word and can't be used.` }
  }

  let query = supabase.from('organizations').select('id').eq('slug', slug)
  if (excludeOrgId) query = query.neq('id', excludeOrgId)
  const { data: existing } = await query.maybeSingle()

  if (existing) {
    return { slug, available: false, reason: `"${slug}" is already taken by another organization.` }
  }

  return { slug, available: true }
}
