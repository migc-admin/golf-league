import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const OrgContext = createContext(null)

export function OrgProvider({ orgSlug, children }) {
  const [org, setOrg] = useState(null)

  useEffect(() => {
    if (!orgSlug) return
    supabase
      .from('organizations')
      .select('id, name, slug, logo_url')
      .eq('slug', orgSlug)
      .single()
      .then(({ data }) => { if (data) setOrg(data) })
  }, [orgSlug])

  return <OrgContext.Provider value={org}>{children}</OrgContext.Provider>
}

export function useOrg() {
  return useContext(OrgContext)
}
