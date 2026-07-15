import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../lib/OrgContext'
import { supabase } from '../lib/supabase'
import { TIER_LABELS, hasFeature, getLimit } from '../lib/features'

const GREEN = '#1B4332'

const TIER_STYLE = {
  free:  { background: '#f3f4f6', color: '#6b7280' },
  pro:   { background: '#eff6ff', color: '#1d4ed8' },
  club:  { background: '#f0fdf4', color: GREEN },
}

// All features shown in the popover with labels per tier
const PLAN_FEATURES = [
  { label: 'Leagues',              free: '1 league',      pro: '2 leagues',   club: 'Unlimited'   },
  { label: 'Players per event',    free: 'Up to 16',      pro: 'Unlimited',   club: 'Unlimited'   },
  { label: 'Digital scoring',      free: true,            pro: true,          club: true          },
  { label: 'Leaderboards',         free: true,            pro: true,          club: true          },
  { label: 'Printable scorecards', free: true,            pro: true,          club: true          },
  { label: 'Flights A & B',        free: false,           pro: true,          club: true          },
  { label: 'Skins & side games',   free: false,           pro: true,          club: true          },
  { label: 'Score export (CSV)',    free: false,           pro: true,          club: true          },
  { label: 'Multiple admins',      free: false,           pro: false,         club: 'Up to 3'     },
  { label: 'Team Play scoring',     free: false,           pro: false,         club: true          },
  { label: 'Custom branding',      free: false,           pro: false,         club: true          },
  { label: 'Online registration',  free: false,           pro: false,         club: true          },
]

function AccountDropdown({ user, profile, org, tier, isOwner, onSignOut }) {
  const [open, setOpen] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const label     = TIER_LABELS[tier] ?? tier
  const joinedAt  = user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null
  const initials  = (profile?.full_name ?? user?.email ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-2 py-1 rounded-full hover:bg-surface-high transition-colors"
      >
        {/* Avatar circle */}
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
          style={{ background: GREEN }}
        >
          {initials}
        </span>
        <span className="hidden sm:inline text-xs font-semibold text-ink-muted">
          {profile?.full_name ?? user?.email}
        </span>
        <svg className="w-3 h-3 text-ink-muted hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute right-0 top-10 z-50 w-72 bg-white rounded-2xl shadow-2xl"
          style={{ border: '1px solid #ebe9e4' }}
        >
          {/* User info */}
          <div className="px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #ebe9e4' }}>
            <div className="flex items-center gap-3">
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                style={{ background: GREEN }}
              >
                {initials}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink truncate">{profile?.full_name ?? '—'}</p>
                <p className="text-xs text-ink-muted truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Subscription info */}
          <div className="px-5 py-3 space-y-2" style={{ borderBottom: '1px solid #ebe9e4' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs text-ink-muted">Plan</span>
              <button
                type="button"
                onClick={() => setPlanOpen(v => !v)}
                className="flex items-center gap-1.5 group"
              >
                {isOwner ? (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: '#1B4332', color: '#fff' }}>
                    Owner
                  </span>
                ) : (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={TIER_STYLE[tier] ?? TIER_STYLE.free}
                >
                  {label}
                </span>
                )}
                <svg
                  className="w-3 h-3 text-ink-muted transition-transform"
                  style={{ transform: planOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            {planOpen && (
              <ul className="pt-1 space-y-1.5">
                {PLAN_FEATURES.map(f => {
                  const val = f[tier] ?? f.free
                  const included = val !== false
                  return (
                    <li key={f.label} className="flex items-center justify-between gap-2">
                      <span className="text-xs" style={{ color: included ? '#374151' : '#9ca3af' }}>
                        {f.label}
                      </span>
                      <span className="text-xs font-semibold shrink-0">
                        {val === true  ? <span style={{ color: GREEN }}>✓</span>
                        : val === false ? <span style={{ color: '#d1d5db' }}>—</span>
                        : <span style={{ color: GREEN, fontSize: '0.7rem' }}>{val}</span>}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
            {org?.name && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">Organization</span>
                <span className="text-xs font-semibold text-ink">{org.name}</span>
              </div>
            )}
            {joinedAt && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-muted">Member since</span>
                <span className="text-xs text-ink">{joinedAt}</span>
              </div>
            )}
          </div>

          {/* Upgrade CTA — hidden for Club (highest tier) and owners */}
          {!isOwner && tier !== 'club' && (
            <div className="px-5 py-3" style={{ borderBottom: '1px solid #ebe9e4' }}>
              <a
                href="/onboarding"
                onClick={() => setOpen(false)}
                className="block text-center text-xs font-bold py-2 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                {tier === 'pro' ? 'Upgrade to Club →' : 'Upgrade to Pro →'}
              </a>
            </div>
          )}

          {/* Sign out */}
          <div className="px-5 py-3">
            <button
              onClick={() => { setOpen(false); onSignOut() }}
              className="w-full text-left text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TierPopover({ tier }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const label = TIER_LABELS[tier] ?? tier

  function featureValue(f) {
    return f[tier] ?? f.free
  }

  function renderValue(val) {
    if (val === true)  return <span style={{ color: GREEN }}>✓</span>
    if (val === false) return <span style={{ color: '#d1d5db' }}>—</span>
    return <span style={{ color: GREEN, fontSize: '0.7rem' }}>{val}</span>
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="text-xs font-semibold px-2 py-0.5 rounded-full transition-opacity hover:opacity-80"
        style={TIER_STYLE[tier] ?? TIER_STYLE.free}
      >
        {label} ▾
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-50 w-72 bg-white rounded-2xl shadow-2xl"
          style={{ border: '1px solid #ebe9e4' }}>

          {/* Header */}
          <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid #ebe9e4' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold" style={{ color: '#1d1d1f' }}>Your Plan</span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={TIER_STYLE[tier] ?? TIER_STYLE.free}>
                {label}
              </span>
            </div>
          </div>

          {/* Feature list */}
          <ul className="px-4 py-3 space-y-2">
            {PLAN_FEATURES.map(f => {
              const val = featureValue(f)
              const included = val !== false
              return (
                <li key={f.label} className="flex items-center justify-between gap-2">
                  <span className="text-xs" style={{ color: included ? '#374151' : '#9ca3af' }}>
                    {f.label}
                  </span>
                  <span className="text-xs font-semibold shrink-0">
                    {renderValue(val)}
                  </span>
                </li>
              )
            })}
          </ul>

          {/* Upgrade CTA */}
          {tier !== 'club' && (
            <div className="px-4 pb-4" style={{ borderTop: '1px solid #ebe9e4', paddingTop: '0.75rem' }}>
              <a
                href="/onboarding"
                className="block text-center text-xs font-bold py-2 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                Upgrade to {tier === 'free' ? 'Pro' : 'Club'} →
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const navItems = [
  { to: '/admin',         label: 'Home',    icon: HomeIcon,   end: true },
  { to: '/admin/leagues', label: 'Leagues', icon: TrophyIcon },
  { to: '/admin/courses', label: 'Courses', icon: FlagIcon },
  { to: '/admin/players', label: 'Players', icon: UsersIcon },
  { to: '/admin/import',  label: 'Import',  icon: UploadIcon },
]

export default function Layout({ children }) {
  const { user, profile, signOut } = useAuth()
  const navigate = useNavigate()
  const [menuOpen,   setMenuOpen]   = useState(false)
  const [fetchedOrg, setFetchedOrg] = useState(null)
  const [isOwner,    setIsOwner]    = useState(false)
  const ctxOrg = useOrg()

  // OrgContext is only populated on org-slug routes. For plain /admin routes,
  // fetch the org directly from the user's profile.
  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles').select('org_id, is_owner').eq('id', user.id).single()
      .then(({ data: p }) => {
        if (p?.is_owner) setIsOwner(true)
        if (!p?.org_id || ctxOrg) return
        supabase
          .from('organizations').select('id, name, slug, logo_url, tier').eq('id', p.org_id).single()
          .then(({ data: o }) => { if (o) setFetchedOrg(o) })
      })
  }, [user, ctxOrg])

  const org     = ctxOrg ?? fetchedOrg
  const orgName = org?.name ?? 'Scorify Golf'
  const tier    = org?.tier ?? 'free'

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8' }}>
      {/* Top nav — flat bone header, no gradient, no gold border */}
      <header className="sticky top-0 z-40" style={{ background: '#ffffff', borderBottom: '1px solid #ebe9e4' }}>
        <div className="max-w-container mx-auto px-6 flex items-center justify-between h-14">

          {/* Brand */}
          <Link to="/admin" className="flex items-center gap-2.5">
            <img src={org?.logo_url ?? '/logo.png'} alt={orgName} className="w-8 h-8 object-contain" />
            <span className="hidden sm:inline font-bold text-ink" style={{ fontSize: '1rem', letterSpacing: '-0.02em' }}>
              {orgName}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold transition-colors rounded-full ${
                    isActive
                      ? 'bg-status-active-bg text-status-active-text'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-high'
                  }`
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </NavLink>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <Link
              to="/home"
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-colors text-ink-muted hover:text-ink hover:bg-surface-high"
            >
              View Site ↗
            </Link>
            <AccountDropdown
              user={user}
              profile={profile}
              org={org}
              tier={tier}
              isOwner={isOwner}
              onSignOut={handleSignOut}
            />

            {/* Mobile hamburger */}
            <button
              className="md:hidden p-2 rounded-full hover:bg-surface-high transition-colors"
              onClick={() => setMenuOpen(v => !v)}
              aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={menuOpen}
            >
              <svg className="w-5 h-5 text-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <nav className="md:hidden px-4 py-3 flex flex-col gap-1" style={{ borderTop: '1px solid #ebe9e4', background: '#ffffff' }}>
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2.5 text-sm font-semibold rounded-full transition-colors ${
                    isActive
                      ? 'bg-status-active-bg text-status-active-text'
                      : 'text-ink-muted hover:text-ink hover:bg-surface-high'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-container w-full mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  )
}

// Inline icon components
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
