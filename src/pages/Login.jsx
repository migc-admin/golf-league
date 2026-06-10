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

  // Wait until profile is resolved before redirecting — prevents race where isAdmin is false
  if (user && !profileLoading) {
    return <Navigate to={from} replace />
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    try {
      await signIn(email, password)
      // redirect handled by Navigate above on re-render
    } catch (err) {
      toast.error(err.message ?? 'Sign-in failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Mulligan's Island Golf Club" className="w-28 h-28 rounded-full object-cover mx-auto mb-2 shadow-xl" />
          <h1 className="text-white mb-1" style={{ fontFamily: "'Playfair Display', serif", fontSize: '2rem', fontWeight: 700 }}>Mulligan's Island Golf Club</h1>
          <div className="mx-auto mb-2" style={{ width: 60, height: 2, background: '#D4AF37' }} />
          <p className="text-sm mt-1" style={{ color: 'rgba(255,255,255,0.55)' }}>Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
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
              ) : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
          Contact your league admin for access.
        </p>
      </div>
    </div>
  )
}
