/**
 * AuthCallback — landing page for OAuth redirects (Google, etc).
 * Supabase auto-establishes the session from the URL on load; once useAuth
 * picks it up, route based on org_id/role same as the email sign-in flow.
 */
import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { safeInternalPath } from '../lib/safeRedirect'

export default function AuthCallback() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // `from` comes from the URL query string, so it's attacker-influenceable —
  // constrain it to an internal path before ever navigating to it.
  const from = safeInternalPath(searchParams.get('from'), null)

  useEffect(() => {
    if (loading) return
    if (!user) {
      navigate('/login', { replace: true })
      return
    }

    let cancelled = false
    async function route() {
      const { data: prof } = await supabase
        .from('profiles')
        .select('org_id, role')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return

      if (!prof?.org_id) {
        navigate('/onboarding', { replace: true })
      } else if (prof?.role === 'admin') {
        navigate(from && from !== '/login' ? from : '/admin', { replace: true })
      } else {
        navigate(from && from !== '/login' ? from : '/home', { replace: true })
      }
    }
    route()

    return () => { cancelled = true }
  }, [user, loading, from, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3 text-gray-500">
        <svg className="animate-spin h-8 w-8 text-fairway-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <span className="text-sm">Signing you in…</span>
      </div>
    </div>
  )
}
