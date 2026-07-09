import { Routes, Route, Navigate, useParams } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute     from './components/AdminRoute'
import { OrgProvider } from './lib/OrgContext'

function OrgRouteWrapper({ children }) {
  const { orgSlug } = useParams()
  return <OrgProvider orgSlug={orgSlug}>{children}</OrgProvider>
}

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
import Standings      from './pages/Standings'
import Schedule       from './pages/Schedule'
import EventPage      from './pages/EventPage'
import Import         from './pages/admin/Import'
import Register       from './pages/Register'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/home"  element={<Home />} />

        {/* Admin (requires admin role) */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route index                element={<Dashboard />} />
          <Route path="leagues"                    element={<Leagues />} />
          <Route path="leagues/:leagueSlug"       element={<LeagueDetail />} />
          <Route path="courses"       element={<Courses />} />
          <Route path="players"       element={<Players />} />
          <Route path="import"        element={<Import />} />
          <Route path=":orgSlug/:leagueSlug"            element={<OrgRouteWrapper><Leagues /></OrgRouteWrapper>} />
          <Route path=":orgSlug/:leagueSlug/:eventSlug" element={<OrgRouteWrapper><EventDetail /></OrgRouteWrapper>} />
        </Route>

        {/* Join via access code — no auth required */}
        <Route path="/join/:eventId" element={<ScorecardJoin />} />

        {/* Scorecard — public for specific eventId (shareable link), auth required for /me */}
        <Route path="/scorecard/me" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />

        {/* Public event registration — no auth required */}
        <Route path="/register/:eventId" element={<Register />} />

        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Generic slug-based routes — must be LAST to avoid conflicts */}
        <Route path="/:orgSlug/:leagueSlug/standings" element={<OrgRouteWrapper><Standings /></OrgRouteWrapper>} />
        <Route path="/:orgSlug/:leagueSlug/:eventSlug/event"       element={<EventPage />} />
        <Route path="/:orgSlug/:leagueSlug/:eventSlug/leaderboard" element={<OrgRouteWrapper><Leaderboard /></OrgRouteWrapper>} />
        <Route path="/:orgSlug/:leagueSlug/:eventSlug/schedule" element={<OrgRouteWrapper><Schedule /></OrgRouteWrapper>} />
        <Route path="/:orgSlug/:leagueSlug/:eventSlug/scorecard" element={<OrgRouteWrapper><Scorecard /></OrgRouteWrapper>} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AuthProvider>
  )
}
