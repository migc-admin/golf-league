import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute     from './components/AdminRoute'

import Login          from './pages/Login'
import Home           from './pages/Home'
import Dashboard      from './pages/admin/Dashboard'
import Leagues        from './pages/admin/Leagues'
import Courses        from './pages/admin/Courses'
import Players        from './pages/admin/Players'
import EventDetail    from './pages/admin/EventDetail'
import Scorecard      from './pages/Scorecard'
import ScorecardJoin  from './pages/ScorecardJoin'
import Leaderboard    from './pages/Leaderboard'
import Standings      from './pages/Standings'
import Schedule       from './pages/Schedule'
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
          <Route path="leagues"       element={<Leagues />} />
          <Route path="courses"       element={<Courses />} />
          <Route path="players"       element={<Players />} />
          <Route path="import"        element={<Import />} />
          <Route path=":leagueSlug/:eventSlug" element={<EventDetail />} />
        </Route>

        {/* Join via access code — no auth required */}
        <Route path="/join/:eventId" element={<ScorecardJoin />} />

        {/* Scorecard — public for specific eventId (shareable link), auth required for /me */}
        <Route path="/scorecard/me" element={<ProtectedRoute><Scorecard /></ProtectedRoute>} />

        {/* Public event registration — no auth required */}
        <Route path="/register/:eventId" element={<Register />} />

        <Route path="/" element={<Navigate to="/home" replace />} />

        {/* Generic slug-based routes — must be LAST to avoid conflicts */}
        <Route path="/:leagueSlug/standings" element={<Standings />} />
        <Route path="/:leagueSlug/:eventSlug/leaderboard" element={<Leaderboard />} />
        <Route path="/:leagueSlug/:eventSlug/schedule" element={<Schedule />} />
        <Route path="/:leagueSlug/:eventSlug/scorecard" element={<Scorecard />} />

        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </AuthProvider>
  )
}
