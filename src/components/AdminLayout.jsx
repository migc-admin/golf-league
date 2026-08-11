import { Link, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../lib/OrgContext'
import { supabase } from '../lib/supabase'
import { TIER_LABELS } from '../lib/features'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'

const NAV_MAIN = [
  { to: '/admin',          label: 'Home',     end: true,  icon: HomeIcon   },
  { to: '/admin/leagues',  label: 'Leagues',  end: false, icon: TrophyIcon },
  { to: '/admin/courses',  label: 'Courses',  end: false, icon: FlagIcon   },
  { to: '/admin/players',  label: 'Players',  end: false, icon: UsersIcon  },
  { to: '/admin/import',   label: 'Import',   end: false, icon: UploadIcon, sub: [
    { label: 'Players',      tab: 'Players'      },
    { label: 'Course',       tab: 'Course'       },
    { label: 'Event Roster', tab: 'Event Roster' },
    { label: 'Past Results', tab: 'Past Results' },
  ]},
]

const EVENT_TABS = [
  { key: 'Overview',       label: 'Overview',       icon: GridIcon,      sub: [
    { label: 'Event Details',    anchor: 'event-details'  },
    { label: 'Players',          anchor: 'players-summary' },
    { label: 'Cover Photo',      anchor: 'cover-photo'    },
    { label: 'Public Event Page',anchor: 'public-event'   },
    { label: 'Photos',           anchor: 'event-photos'   },
  ]},
  { key: 'Players',        label: 'Players',         icon: UsersIcon,     sub: [
    { label: 'Registrations',    anchor: 'registrations'  },
    { label: 'Players & Flights',anchor: 'roster'         },
  ]},
  { key: 'Groups',         label: 'Groups',          icon: GroupIcon,     sub: [] },
  { key: 'Payout',         label: 'Payout',          icon: DollarIcon,    sub: [
    { label: 'Config',           anchor: 'payout-config'  },
    { label: 'Side Games',       anchor: 'side-games'     },
    { label: 'Summary',          anchor: 'payout-summary' },
  ]},
  { key: 'Pre/Post Round', label: 'Pre/Post Round',  icon: ClipboardIcon, sub: [
    { label: 'Print Assets',     anchor: 'print-assets'   },
    { label: 'Export Scorecards',anchor: 'export-scorecards' },
    { label: 'Edit Scores',      anchor: 'edit-scores'    },
    { label: 'Scores Export',    anchor: 'scores-export'  },
  ]},
  { key: 'Team Play',      label: 'Team Play',       icon: ShieldIcon,    sub: [] },
]

// Detect if we're on an event detail route: /admin/:org/:league/:event
function useEventRoute() {
  const location = useLocation()
  const parts = location.pathname.replace(/^\/admin\//, '').split('/')
  // event route has exactly 3 segments: orgSlug / leagueSlug / eventSlug
  if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
    return { isEventRoute: true, orgSlug: parts[0], leagueSlug: parts[1], eventSlug: parts[2], basePath: location.pathname }
  }
  return { isEventRoute: false }
}

// ─── Global nav item (with optional sub-items) ───────────────────────────────
function GlobalNavItem({ to, end, label, icon: Icon, sub, onClose, linkClass, activeStyle }) {
  const location     = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const isActive     = end ? location.pathname === to : location.pathname.startsWith(to)
  const activeTab    = searchParams.get('tab') ?? (sub?.[0]?.tab ?? '')

  function setTab(tab) {
    setSearchParams({ tab })
    onClose?.()
  }

  return (
    <div>
      <NavLink to={to} end={end} onClick={onClose}
        className={linkClass}
        style={({ isActive }) => isActive ? activeStyle : {}}>
        <Icon className="w-4 h-4 shrink-0" />
        {label}
      </NavLink>
      {isActive && sub?.length > 0 && (
        <div className="ml-7 mt-0.5 space-y-0.5">
          {sub.map(({ label: sublabel, tab }) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`w-full text-left px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-white bg-white/20'
                  : 'text-white/50 hover:text-white hover:bg-white/10'
              }`}
            >
              {sublabel}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Global sidebar (default nav) ────────────────────────────────────────────
function GlobalSidebar({ org, user, profile, tier, isOwner, onSignOut, onClose }) {
  const label    = TIER_LABELS[tier] ?? tier
  const initials = (profile?.full_name ?? user?.email ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const orgName  = org?.name ?? 'Scorify Golf'

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
      isActive ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
    }`
  const activeStyle = { background: 'rgba(255,255,255,0.15)' }

  return (
    <div className="flex flex-col h-full" style={{ background: GREEN }}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <img src={org?.logo_url ?? '/logo.png'} alt={orgName}
          className="w-8 h-8 object-contain rounded-lg shrink-0"
          style={{ border: '1px solid rgba(255,255,255,0.2)' }} />
        <div className="min-w-0">
          <div className="text-white font-bold text-sm truncate leading-tight">{orgName}</div>
          <div className="text-white/50 text-xs truncate">{label} plan</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="ml-auto text-white/60 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Main nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_MAIN.map(({ to, label: lbl, end, icon: Icon, sub }) => (
          <GlobalNavItem key={to} to={to} end={end} label={lbl} icon={Icon} sub={sub} onClose={onClose} linkClass={linkClass} activeStyle={activeStyle} />
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 space-y-0.5" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
        <NavLink to="/admin/settings" end={false} onClick={onClose}
          className={linkClass}
          style={({ isActive }) => isActive ? activeStyle : {}}>
          <GearIcon className="w-4 h-4 shrink-0" />
          Settings
        </NavLink>
        <Link to="/home" onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          <ExternalIcon className="w-4 h-4 shrink-0" />
          View Site
        </Link>
        {!isOwner && tier !== 'club' && (
          <a href="/upgrade" onClick={onClose}
            className="flex items-center justify-center gap-2 mt-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-opacity hover:opacity-90"
            style={{ background: GOLD, color: GREEN }}>
            Upgrade {tier === 'pro' ? '→ Club' : '→ Pro'}
          </a>
        )}
        {/* User row */}
        <div className="flex items-center gap-3 px-3 pt-3 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-white text-xs font-semibold truncate">{profile?.full_name ?? user?.email}</div>
            <div className="text-white/40 text-xs truncate">{user?.email}</div>
          </div>
          <button onClick={onSignOut} title="Sign out" className="text-white/40 hover:text-white/80 transition-colors shrink-0">
            <SignOutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Event context sidebar ────────────────────────────────────────────────────
function EventSidebar({ org, eventName, eventStatus, basePath, onClose, onSignOut, user, profile }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'Overview'
  const location  = useLocation()
  const initials  = (profile?.full_name ?? user?.email ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  function tabClass(key) {
    return `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
      activeTab === key ? 'text-white' : 'text-white/60 hover:text-white hover:bg-white/10'
    }`
  }

  return (
    <div className="flex flex-col h-full" style={{ background: GREEN }}>
      {/* Back + org */}
      <div className="px-4 pt-4 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <Link to="/admin"
          className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs font-semibold mb-3 transition-colors"
          onClick={onClose}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {org?.name ?? 'Home'}
        </Link>
        <div className="text-white font-bold text-sm leading-snug truncate">{eventName}</div>
        {eventStatus && (
          <div className="mt-1">
            <StatusDot status={eventStatus} />
          </div>
        )}
        {onClose && (
          <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tab nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {EVENT_TABS.map(({ key, label, icon: Icon, sub }) => (
          <div key={key}>
            <button
              onClick={() => { setSearchParams({ tab: key }); onClose?.() }}
              className={tabClass(key)}
              style={{ width: '100%', textAlign: 'left', ...(activeTab === key ? { background: 'rgba(255,255,255,0.15)' } : {}) }}>
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </button>
            {/* Sub-items — shown when this tab is active */}
            {activeTab === key && sub?.length > 0 && (
              <div className="ml-7 mt-0.5 space-y-0.5">
                {sub.map(({ label: subLabel, anchor }) => (
                  <a
                    key={anchor}
                    href={`#${anchor}`}
                    onClick={onClose}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <span className="w-1 h-1 rounded-full bg-white/30 shrink-0" />
                    {subLabel}
                  </a>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.75rem' }}>
        <Link to="/home" onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white hover:bg-white/10 transition-colors">
          <ExternalIcon className="w-4 h-4 shrink-0" />
          View Site
        </Link>
        <div className="flex items-center gap-3 px-3 pt-3 mt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
            style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-white text-xs font-semibold truncate">{profile?.full_name ?? user?.email}</div>
          </div>
          <button onClick={onSignOut} title="Sign out" className="text-white/40 hover:text-white/80 transition-colors shrink-0">
            <SignOutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }) {
  const map = {
    active:   { color: '#4ade80', label: 'Active' },
    upcoming: { color: '#fbbf24', label: 'Upcoming' },
    complete: { color: '#9ca3af', label: 'Complete' },
    draft:    { color: '#9ca3af', label: 'Draft' },
  }
  const s = map[status] ?? map.upcoming
  return (
    <span className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: s.color }} />
      {s.label}
    </span>
  )
}

// ─── AdminLayout ──────────────────────────────────────────────────────────────
export default function AdminLayout({ children }) {
  const { user, profile, signOut } = useAuth()
  const navigate   = useNavigate()
  const [drawerOpen,      setDrawerOpen]      = useState(false)
  const [fetchedOrg,      setFetchedOrg]      = useState(null)
  const [isOwner,         setIsOwner]         = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [eventMeta,       setEventMeta]       = useState(null) // { name, status }
  const ctxOrg = useOrg()

  const { isEventRoute, orgSlug, leagueSlug, eventSlug, basePath } = useEventRoute()

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles').select('org_id, is_owner, is_platform_admin').eq('id', user.id).single()
      .then(({ data: p }) => {
        if (p?.is_owner)          setIsOwner(true)
        if (p?.is_platform_admin) setIsPlatformAdmin(true)
        if (!p?.org_id || ctxOrg) return
        supabase
          .from('organizations').select('id, name, slug, logo_url, tier').eq('id', p.org_id).single()
          .then(({ data: o }) => { if (o) setFetchedOrg(o) })
      })
  }, [user, ctxOrg])

  // Fetch event name + status when on an event route
  useEffect(() => {
    if (!isEventRoute || !eventSlug) { setEventMeta(null); return }
    supabase
      .from('events')
      .select('name, event_number, status')
      .eq('slug', eventSlug)
      .single()
      .then(({ data }) => {
        if (data) setEventMeta({ name: data.name ?? `Event #${data.event_number}`, status: data.status })
      })
  }, [isEventRoute, eventSlug])

  const org  = ctxOrg ?? fetchedOrg
  const tier = (isOwner || isPlatformAdmin) ? 'club' : (org?.tier ?? 'free')

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const sharedProps = { org, user, profile, onSignOut: handleSignOut }

  const sidebarContent = isEventRoute
    ? <EventSidebar {...sharedProps} eventName={eventMeta?.name ?? '…'} eventStatus={eventMeta?.status} basePath={basePath} onClose={() => setDrawerOpen(false)} />
    : <GlobalSidebar {...sharedProps} tier={tier} isOwner={isOwner} onClose={() => setDrawerOpen(false)} />

  const sidebarDesktop = isEventRoute
    ? <EventSidebar {...sharedProps} eventName={eventMeta?.name ?? '…'} eventStatus={eventMeta?.status} basePath={basePath} />
    : <GlobalSidebar {...sharedProps} tier={tier} isOwner={isOwner} />

  return (
    <div className="min-h-screen flex" style={{ background: '#f5f4f1' }}>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-[220px] shrink-0 fixed inset-y-0 left-0 z-30">
        {sidebarDesktop}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <div className="relative w-64 flex flex-col z-50">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 md:ml-[220px]">

        {/* Mobile top bar */}
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14"
          style={{ background: GREEN, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <button onClick={() => setDrawerOpen(true)} className="text-white/70 hover:text-white p-1" aria-label="Open menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src={org?.logo_url ?? '/logo.png'} alt="" className="w-6 h-6 object-contain rounded" />
          <span className="text-white font-bold text-sm truncate">
            {isEventRoute && eventMeta ? eventMeta.name : (org?.name ?? 'Scorify Golf')}
          </span>
        </header>

        <main className="flex-1 px-6 py-6 max-w-[1200px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  )
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function HomeIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
}
function TrophyIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" /></svg>
}
function FlagIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
}
function UsersIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
}
function UploadIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
}
function GearIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function ExternalIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
}
function SignOutIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
}
function GridIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
}
function GroupIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
}
function DollarIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
}
function ClipboardIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
}
function ShieldIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
}
