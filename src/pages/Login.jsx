import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function Login() {
  const { user, profile, profileLoading, signIn } = useAuth()
  const location = useLocation()
  const from = location.state?.from?.pathname ?? '/home'

  const [mode,     setMode]     = useState('signin') // 'signin' | 'signup'
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState('')
  const [loading,  setLoading]  = useState(false)

  if (user && !profileLoading) {
    // New user with no org/profile — send to onboarding
    if (profile === null) return <Navigate to="/onboarding" replace />
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      if (mode === 'signin') {
        await signIn(email, password)
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: name.trim() || undefined } },
        })
        if (error) throw error
        toast.success('Account created! Check your email to confirm, then sign in.')
        setMode('signin')
        setPassword('')
      }
    } catch (err) {
      toast.error(err.message ?? (mode === 'signin' ? 'Sign-in failed' : 'Sign-up failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#fbfaf8' }}>
      <div className="w-full max-w-sm">

        {/* Logo + wordmark */}
        <div className="text-center mb-10">
          <img src="/logo.png" alt="Scorify Golf" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="text-ink font-bold mb-1" style={{ fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
            Scorify Golf
          </h1>
          <p className="text-sm text-ink-muted">
            {mode === 'signin' ? 'Sign in to continue' : 'Create your account'}
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: '#ffffff',
          borderRadius: '1.5rem',
          border: '1px solid #ebe9e4',
          boxShadow: '0 20px 60px rgba(0,0,0,.08)',
          padding: '32px 28px',
        }}>
          {/* Mode toggle */}
          <div className="flex rounded-xl p-1 mb-6" style={{ background: '#f3f4f6' }}>
            {[['signin', 'Sign in'], ['signup', 'Create account']].map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setPassword('') }}
                className="flex-1 py-2 text-sm font-semibold rounded-lg transition-all"
                style={mode === m
                  ? { background: '#ffffff', color: '#1d1d1f', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                  : { color: '#6b7280' }}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="input"
                  autoComplete="name"
                />
              </div>
            )}

            <div>
              <label className="label">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="input"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                minLength={mode === 'signup' ? 8 : undefined}
                required
              />
              {mode === 'signup' && (
                <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary btn-lg w-full mt-2"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {mode === 'signin' ? 'Signing in…' : 'Creating account…'}
                </span>
              ) : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6 text-ink-muted">
          {mode === 'signin'
            ? "Don't have an account? "
            : 'Already have an account? '}
          <button
            onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setPassword('') }}
            className="underline font-semibold text-ink-muted hover:text-ink"
          >
            {mode === 'signin' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
