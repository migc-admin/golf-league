import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import AdminRoute     from './components/AdminRoute'

import Login          from './pages/Login'
import Dashboard      from './pages/admin/Dashboard'
import Leagues        from './pages/admin/Leagues'
import Courses        from './pages/admin/Courses'
import Players        from './pages/admin/Players'
import EventDetail    from './pages/admin/EventDetail'
import Scorecard      from './pages/Scorecard'
import Leaderboard    from './pages/Leaderboard'
import Standings      from './pages/Standings'
import Schedule       from './pages/Schedule'
import Import         from './pages/admin/Import'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />

        {/* Admin (requires admin role) */}
        <Route path="/admin" element={<AdminRoute />}>
          <Route index                element={<Dashboard />} />
          <Route path="leagues"       element={<Leagues />} />
          <Route path="courses"       element={<Courses />} />
          <Route path="players"       element={<Players />} />
          <Route path="events/:id"    element={<EventDetail />} />
          <Route path="import"        element={<Import />} />
        </Route>

        {/* Scorecard — public for specific eventId (shareable link), auth required for /me */}
        <Route path="/scorecard/:eventId" element={<Scorecard />} />
        <Route
          path="/scorecard/me"
          element={<ProtectedRoute><Scorecard /></ProtectedRoute>}
        />

        {/* Public schedule — no auth required, shareable with players */}
        <Route path="/schedule/:eventId" element={<Schedule />} />

        {/* Leaderboard & Standings (any authenticated user) */}
        <Route
          path="/leaderboard/:eventId"
          element={<ProtectedRoute><Leaderboard /></ProtectedRoute>}
        />
        <Route
          path="/standings/:leagueId"
          element={<ProtectedRoute><Standings /></ProtectedRoute>}
        />

        <Route path="/" element={<Navigate to="/admin" replace />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  )
}
