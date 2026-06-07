import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import Layout from './Layout'

export default function AdminRoute() {
  const { user, profile, loading, isAdmin } = useAuth()
  const location = useLocation()

  // Still resolving auth session
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg className="animate-spin h-8 w-8 text-fairway-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />

  // Profile still loading from DB — show spinner rather than redirecting on null profile
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <svg className="animate-spin h-8 w-8 text-fairway-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    )
  }

  // Scorekeepers get redirected to their scorecard entry
  if (!isAdmin) {
    return <Navigate to="/scorecard/me" replace />
  }

  return (
    <Layout>
      <Outlet />
    </Layout>
  )
}
