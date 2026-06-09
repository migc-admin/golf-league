import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

const PROFILE_TIMEOUT_MS = 7000  // if profile fetch hangs, unblock after 7s

export function AuthProvider({ children }) {
  const [user,           setUser]           = useState(null)
  const [profile,        setProfile]        = useState(null)
  const [loading,        setLoading]        = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // Track which userId we last successfully started a fetch for, to avoid
  // redundant concurrent fetches (e.g. getSession + SIGNED_IN both firing).
  const fetchingForRef = useRef(null)

  async function fetchProfile(userId) {
    // Deduplicate: if already fetching for this user, skip
    if (fetchingForRef.current === userId) return
    fetchingForRef.current = userId
    setProfileLoading(true)
    try {
      // Race the DB query against a timeout so a hung query never stalls the UI
      const dbQuery = supabase.from('profiles').select('*').eq('id', userId).single()
      const timeout = new Promise(resolve => setTimeout(() => resolve({ data: null }), PROFILE_TIMEOUT_MS))
      const { data } = await Promise.race([dbQuery, timeout])
      setProfile(data ?? null)
    } catch {
      setProfile(null)
    } finally {
      fetchingForRef.current = null
      setProfileLoading(false)
    }
  }

  useEffect(() => {
    let mounted = true

    // getSession() catches the existing session synchronously on reload.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      const u = session?.user ?? null
      setUser(u)
      if (u) {
        fetchProfile(u.id).finally(() => { if (mounted) setLoading(false) })
      } else {
        setLoading(false)
      }
    })

    // onAuthStateChange handles login, logout, and token refreshes.
    // INITIAL_SESSION is skipped (getSession handles initial load).
    // TOKEN_REFRESHED is now handled to cover expired-token-on-reload case.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          const u = session?.user ?? null
          setUser(u)
          if (u) fetchProfile(u.id)
        } else if (event === 'SIGNED_OUT') {
          fetchingForRef.current = null
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
        // INITIAL_SESSION handled by getSession() above; USER_UPDATED etc: no-op
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  function signOut() {
    setUser(null)
    setProfile(null)
    supabase.auth.signOut()
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
