import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute     from './components/AdminRoute'
import { OrgProvider } from './lib/OrgContext'
import { useSubdomain } from './lib/useSubdomain'
import { SubdomainContext } from './lib/SubdomainContext'
import { TenantProvider, TenantRouteWrapper } from './lib/TenantProvider'
import OrgHome        from './pages/league/OrgHome'
import LeagueHome     from './pages/league/LeagueHome'
import Login          from './pages/Login'
import Home           from './pages/Home'
import Dashboard      from './pages/admin/Dashboard'
import Leagues        from './pages/admin/Leagues'
import LeagueDetail   from './pages/admin/LeagueDetail'
import Courses        from './pages/admin/Courses'
import Players        from './pages/admin/Players'
import EventDetail    from './pages/admin/EventDetail'
import Scorecard      from './pages/Scorecard'
import ScorecardJoin  from './pages/ScorecardJoin'
import Leaderboard    from './pages/Leaderboard'
import Schedule       from './pages/Schedule'
import EventPage      from './pages/EventPage'
import Import         from './pages/admin/Import'
import Settings       from './pages/admin/Settings'
import Register       from './pages/Register'
import Onboarding     from './pages/Onboarding'
import Upgrade        from './pages/Upgrade'
import ResetPassword  from './pages/ResetPassword'
import FAQ            from './pages/FAQ'
import Help           from './pages/Help'
import Privacy        from './pages/Privacy'
import RefundPolicy   from './pages/RefundPolicy'
import DisputeTemplate from './pages/admin/DisputeTemplate'
import Roadmap        from './pages/Roadmap'

function OrgRouteWrapper({ children }) {
  const { orgSlug } = useParams()
  return (
    <TenantProvider orgSlug={orgSlug}>
      <OrgProvider orgSlug={orgSlug}>{children}</OrgProvider>
    </TenantProvider>
  )
}

function LeagueHomeRoute({ orgSlug, initialTab }) {
  const { leagueSlug } = useParams()
  return <LeagueHome orgSlug={orgSlug} leagueSlug={leagueSlug} initialTab={initialTab} />
}

function LeagueStandingsRoute() {
  const { orgSlug, leagueSlug } = useParams()
  return <OrgProvider orgSlug={orgSlug}><LeagueHome orgSlug={orgSlug} leagueSlug={leagueSlug} initialTab="standings" /></OrgProvider>
}

export default function App() {
  const subdomainSlug = useSubdomain()

  if (subdomainSlug) {
    return (
      <AuthProvider>
        <TenantProvider orgSlug={subdomainSlug}>
        <SubdomainContext.Provider value={subdomainSlug}>
          <Routes>
            <Route path="/" element={<OrgHome orgSlug={subdomainSlug} />} />
            <Route path="/:leagueSlug" element={<LeagueHomeRoute orgSlug={subdomainSlug} />} />
            <Route path="/:leagueSlug/:eventSlug" element={<EventPage />} />
            <Route path="/:leagueSlug/:eventSlug/leaderboard" element={<OrgProvider orgSlug={subdomainSlug}><Leaderboard /></OrgProvider>} />
            <Route path="/:leagueSlug/:eventSlug/scorecard"   element={<OrgProvider orgSlug={subdomainSlug}><Scorecard /></OrgProvider>} />
            <Route path="/:leagueSlug/:eventSlug/schedule"    element={<OrgProvider orgSlug={subdomainSlug}><Schedule /></OrgProvider>} />
          </Routes>
        </SubdomainContext.Provider>
        </TenantProvider>
      </AuthProvider>
    )
  }

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login"       element={<Login />} />
        <Route path="/home"        element={<Home />} />
        <Route path="/onboarding"  element={<Onboarding />} />
        <Route path="/upgrade"     element={<ProtectedRoute><Upgrade /></ProtectedRoute>} />

        {/* Admin (requires admin role) */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route index                element={<Dashboard />} />
          <Route path="leagues"                    element={<Leagues />} />
          <Route path="leagues/:leagueSlug"        element={<LeagueDetail />} />
          <Route path="courses"                    element={<Courses />} />
          <Route path="players"                    element={<Players />} />
          <Route path="import"                     element={<Import />} />
          <Route path="settings"                   element={<Settings />} />
          <Route path="dispute-template"           element={<DisputeTemplate />} />
          <Route path=":orgSlug/:leagueSlug"            element={<OrgRouteWrapper><Leagues /></OrgRouteWrapper>} />
          <Route path=":orgSlug/:leagueSlug/:eventSlug" element={<OrgRouteWrapper><EventDetail /></OrgRouteWrapper>} />
        </Route>

        {/* Join via access code — no auth required */}
        <Route path="/join/:eventId" element={<ScorecardJoin />} />

        {/* Scorecard — public for specific eventId (shareable link), auth required for /me */}
        <Route path="/scorecard/me" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />

        {/* Public event registration — no auth required */}
        <Route path="/register/:leagueSlug/:eventSlug" element={<Register />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/faq"            element={<FAQ />} />
        <Route path="/roadmap"        element={<Roadmap />} />
        <Route path="/help"           element={<Help />} />
        <Route path="/privacy"        element={<Privacy />} />
        <Route path="/refund-policy"  element={<RefundPolicy />} />

        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Generic slug-based routes — must be LAST to avoid conflicts */}
        <Route path="/:orgSlug/:leagueSlug/standings"              element={<LeagueStandingsRoute />} />
        <Route path="/:orgSlug/:leagueSlug/:eventSlug/event"       element={<EventPage />} />
        <Route path="/:orgSlug/:leagueSlug/:eventSlug/leaderboard" element={<OrgRouteWrapper><Leaderboard /></OrgRouteWrapper>} />
        <Route path="/:orgSlug/:leagueSlug/:eventSlug/schedule"    element={<OrgRouteWrapper><Schedule /></OrgRouteWrapper>} />
        <Route path="/:orgSlug/:leagueSlug/:eventSlug/scorecard"   element={<OrgRouteWrapper><Scorecard /></OrgRouteWrapper>} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AuthProvider>
  )
}
