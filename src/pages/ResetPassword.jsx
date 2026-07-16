/**
 * ResetPassword — user lands here from the password reset email link.
 * Supabase auto-establishes a session from the URL hash on load.
 * User enters a new password and we call updateUser.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'

export default function ResetPassword() {
  const navigate  = useNavigate()
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [ready,     setReady]     = useState(false)

  useEffect(() => {
    // Supabase fires PASSWORD_RECOVERY when the reset link is opened
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match.')
      return
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Password updated! Signing you in…')
      navigate('/admin', { replace: true })
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6" style={{ background: '#fbfaf8' }}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-10">
          <img src="/logo.png" alt="Scorify Golf" className="w-16 h-16 object-contain mx-auto mb-4" />
          <h1 className="text-ink font-bold mb-1" style={{ fontSize: '1.5rem', letterSpacing: '-0.03em' }}>
            Scorify Golf
          </h1>
          <p className="text-sm text-ink-muted">Set a new password</p>
        </div>

        <div style={{
          background: '#ffffff',
          borderRadius: '1.5rem',
          border: '1px solid #ebe9e4',
          boxShadow: '0 20px 60px rgba(0,0,0,.08)',
          padding: '32px 28px',
        }}>
          {!ready ? (
            <p className="text-sm text-center text-ink-muted">Verifying reset link…</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
                <p className="text-xs text-gray-400 mt-1">Minimum 8 characters</p>
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••"
                  className="input"
                  autoComplete="new-password"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="btn-primary btn-lg w-full mt-2"
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
