import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null)
  const [profile,        setProfile]        = useState(null)
  const [loading,        setLoading]        = useState(true)   // true while getSession + fetchProfile runs
  const [profileLoading, setProfileLoading] = useState(false)  // true while fetchProfile alone runs

  async function fetchProfile(userId) {
    setProfileLoading(true)
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(data ?? null)
    } catch {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) fetchProfile(u.id).finally(() => setLoading(false))
      else   setLoading(false)
    })

    // Listen for auth changes — only act on meaningful events, not token refreshes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
        } else if (event === 'SIGNED_IN') {
          const u = session?.user ?? null
          setUser(u)
          if (u) await fetchProfile(u.id)
        }
        // TOKEN_REFRESHED and other events: do nothing, session is already valid
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  function signOut() {
    setUser(null)
    setProfile(null)
    supabase.auth.signOut() // fire and forget — don't block UI on network call
  }

  const isAdmin       = profile?.role === 'admin'
  const isScorekeeper = profile?.role === 'scorekeeper'

  return (
    <AuthContext.Provider value={{ user, profile, loading, profileLoading, isAdmin, isScorekeeper, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
