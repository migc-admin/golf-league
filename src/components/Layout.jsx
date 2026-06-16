import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'

const navItems = [
  { to: '/admin',         label: 'Home',  icon: HomeIcon,    end: true },
  { to: '/admin/leagues', label: 'Leagues',    icon: TrophyIcon },
  { to: '/admin/courses', label: 'Courses',    icon: FlagIcon },
  { to: '/admin/players', label: 'Players',    icon: UsersIcon },
  { to: '/admin/import',  label: 'Import',     icon: UploadIcon },
]

export default function Layout({ children }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#EEF1EC' }}>
      {/* Top nav — MIGC gradient + gold border */}
      <header className="sticky top-0 z-40 shadow-lg" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)', borderBottom: '3px solid #D4AF37' }}>
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
          <Link to="/admin" className="flex items-center gap-2.5 tracking-tight">
            <img src="/logo.png" alt="Mulligan's Island Golf Club" className="w-9 h-9 rounded-full object-cover" />
            <span className="hidden sm:inline font-bold text-white" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1.15rem', letterSpacing: '0.02em' }}>
              Mulligan's Island Golf Club
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive
                      ? 'text-gold-400 border-b-2 border-gold-400'
                      : 'text-white/70 hover:text-white hover:bg-white/10 rounded'
                  }`
                }
                style={({ isActive }) => isActive ? { color: '#D4AF37', borderBottomColor: '#D4AF37' } : {}}
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="text-xs hidden sm:block" style={{ color: 'rgba(255,255,255,0.5)' }}>
              {profile?.full_name}
            </span>
            <button
              onClick={handleSignOut}
              className="text-xs font-semibold uppercase tracking-wider px-3 py-1.5 transition-colors hover:bg-white/10 rounded"
              style={{ color: '#D4AF37', letterSpacing: '0.08em' }}
            >
              Sign out
            </button>

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded hover:bg-white/10"
              onClick={() => setMenuOpen(v => !v)}
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                }
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden px-4 py-2 flex flex-col gap-1" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 text-sm font-semibold uppercase tracking-wider transition-colors rounded ${
                    isActive ? 'bg-white/20' : 'hover:bg-white/10'
                  }`
                }
                style={({ isActive }) => ({ color: isActive ? '#D4AF37' : 'rgba(255,255,255,0.75)' })}
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}

// Inline icon components (no extra dep)
function HomeIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )
}

function TrophyIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
    </svg>
  )
}

function FlagIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
    </svg>
  )
}

function UsersIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )
}

function UploadIcon({ className }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}
