import { useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import toast from 'react-hot-toast'

export default function Login() {
  const { user, profileLoading, isAdmin, signIn } = useAuth()
  const location = useLocation()
  const from = location.state?.from?.pathname ?? '/home'

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)

  if (user && !profileLoading) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      await signIn(email, password)
    } catch (err) {
      toast.error(err.message ?? 'Sign-in failed')
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
          <p className="text-sm text-ink-muted">Sign in to continue</p>
        </div>

        {/* Card — floats slightly over bone background */}
        <div style={{
          background: '#ffffff',
          borderRadius: '1.5rem',
          border: '1px solid #ebe9e4',
          boxShadow: '0 20px 60px rgba(0,0,0,.08)',
          padding: '32px 28px',
        }}>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
                required
              />
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
                  Signing in…
                </span>
              ) : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6 text-ink-muted">
          Contact your league admin for access.
        </p>
      </div>
    </div>
  )
}
