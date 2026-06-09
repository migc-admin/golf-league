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
    // Use onAuthStateChange as single source of truth.
    // INITIAL_SESSION fires on page load (replaces getSession), SIGNED_IN on login,
    // SIGNED_OUT on logout. TOKEN_REFRESHED is ignored to avoid re-fetching profile.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
          const u = session?.user ?? null
          setUser(u)
          if (u) await fetchProfile(u.id)
          else   setProfile(null)
          setLoading(false)
        } else if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
        // TOKEN_REFRESHED and other events: no-op
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
