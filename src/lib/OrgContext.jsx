import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { hasFeature } from './features'

const OrgContext = createContext(null)

export function OrgProvider({ orgSlug, children }) {
  const [org, setOrg] = useState(null)

  useEffect(() => {
    if (!orgSlug) return
    supabase
      .from('organizations')
      .select('id, name, slug, logo_url, tier')
      .eq('slug', orgSlug)
      .single()
      .then(({ data }) => { if (data) setOrg(data) })
  }, [orgSlug])

  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>
}

export function useOrg() {
  return useContext(OrgContext)
}

// Resolves effective tier — platform admins/owners always get 'club'
export async function getEffectiveTier(baseTier) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return baseTier
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_owner, is_platform_admin')
    .eq('id', user.id)
    .single()
  if (profile?.is_owner || profile?.is_platform_admin) return 'club'
  return baseTier
}

export function useFeatures() {
  const org = useContext(OrgContext)
  const tier = org?.tier ?? 'free'
  return (feature) => hasFeature(tier, feature)
}
