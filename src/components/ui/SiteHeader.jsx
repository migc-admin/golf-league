// The one header for every public marketing page (home, solution pages,
// pricing, blog, FAQ, help, roadmap, legal). Every link is a real page, so it
// works the same from anywhere on the site. Roadmap, FAQ, Help, Contact, and
// About live in the footer instead, to keep this short.
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'
const MUTED = '#6b7280'
const LINE  = '#ebe9e4'

export const NAV_LINKS = [
  { label: 'Leagues',     to: '/golf-league-software' },
  { label: 'Tournaments', to: '/golf-tournament-software' },
  { label: 'Trips',       to: '/golf-trip-app' },
  { label: 'Pricing',     to: '/pricing' },
  { label: 'Guides',      to: '/blog' },
]

const isActive = (pathname, to) => pathname === to || (to === '/blog' && pathname.startsWith('/blog/'))

export default function SiteHeader() {
  const { user, profile, signOut, loading, profileLoading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const isLoggedIn = !loading && !profileLoading && !!user
  const isAdmin = profile?.role === 'admin'

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: `1px solid ${LINE}` }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link to="/" className="flex min-h-[44px] items-center gap-2.5 shrink-0">
          <img src="/logo.png" alt="Scorify Golf" width="32" height="32" className="w-8 h-8 object-contain" />
          <span className="font-bold text-base" style={{ letterSpacing: '-0.02em', color: INK }}>Scorify Golf</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6" aria-label="Main">
          {NAV_LINKS.map(l => {
            const active = isActive(pathname, l.to)
            return (
              <Link key={l.to} to={l.to} aria-current={active ? 'page' : undefined}
                className="text-sm font-medium transition-colors hover:text-[#1d1d1f]"
                style={{ color: active ? INK : MUTED, fontWeight: active ? 700 : 500 }}>
                {l.label}
              </Link>
            )
          })}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {isLoggedIn ? (
            <>
              {isAdmin && (
                <Link to="/admin" className="hidden sm:inline-flex min-h-[44px] items-center text-sm font-semibold px-3 rounded-full transition-colors hover:bg-[#f0fdf4]" style={{ color: GREEN }}>
                  Admin ↗
                </Link>
              )}
              <button onClick={handleSignOut}
                className="inline-flex min-h-[44px] items-center text-sm font-semibold px-4 rounded-full border transition-colors hover:border-[#1d1d1f] hover:text-[#1d1d1f]"
                style={{ borderColor: '#d1d5db', color: MUTED }}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="hidden sm:inline-flex min-h-[44px] items-center text-sm font-medium transition-colors hover:text-[#1d1d1f]" style={{ color: MUTED }}>
                Sign in
              </Link>
              <Link to="/login" className="inline-flex min-h-[44px] items-center text-sm font-bold px-4 rounded-full text-white transition-opacity hover:opacity-90 whitespace-nowrap" style={{ background: GREEN }}>
                Get started
              </Link>
            </>
          )}

          {/* Mobile menu button */}
          <button className="md:hidden flex h-11 w-11 items-center justify-center rounded-full" onClick={() => setMenuOpen(v => !v)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} style={{ color: MUTED }}>
            <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav className="md:hidden px-4 sm:px-6 py-4 flex flex-col gap-0" style={{ borderTop: `1px solid ${LINE}` }} aria-label="Main">
          {NAV_LINKS.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)}
              className="flex min-h-[44px] items-center text-sm" style={{ color: isActive(pathname, l.to) ? INK : MUTED, fontWeight: isActive(pathname, l.to) ? 700 : 500 }}>
              {l.label}
            </Link>
          ))}
          {isLoggedIn
            ? isAdmin && <Link to="/admin" onClick={() => setMenuOpen(false)} className="flex min-h-[44px] items-center text-sm font-semibold" style={{ color: GREEN }}>Admin ↗</Link>
            : <Link to="/login" onClick={() => setMenuOpen(false)} className="flex min-h-[44px] items-center text-sm font-medium" style={{ color: MUTED }}>Sign in</Link>}
        </nav>
      )}
    </header>
  )
}
