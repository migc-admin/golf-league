import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useTenant } from '../lib/TenantProvider'
import AdminLayout from './AdminLayout'

// Same gate as AdminRoute, plus one extra check: the logged-in admin's own
// org must match the org this subdomain belongs to. Without this, an admin
// for Org A could sign in and manage Org B just by visiting Org B's subdomain.
export default function SubdomainAdminRoute() {
  const { user, profile, loading, profileLoading, isAdmin } = useAuth()
  const { org, loading: orgLoading } = useTenant()
  const location = useLocation()

  if (loading || profileLoading || orgLoading) {
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
  if (!isAdmin) return <Navigate to="/" replace />

  if (!org || profile?.org_id !== org.id) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-ink mb-2">Access denied</p>
          <p className="text-sm text-ink-muted">
            Your admin account isn't associated with{org?.name ? ` ${org.name}` : ' this organization'}.
          </p>
        </div>
      </div>
    )
  }

  return (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  )
}
