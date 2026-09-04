import { Link, NavLink, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useOrg } from '../lib/OrgContext'
import { supabase } from '../lib/supabase'
import { TIER_LABELS } from '../lib/features'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const SLATE = '#334155' // exploratory sidebar accent — alternative to fairway green

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
    { label: 'Participants',     anchor: 'players-summary' },
    { label: 'Public Event Page',anchor: 'public-event'   },
    { label: 'Cover Photo',      anchor: 'cover-photo'    },
    { label: 'Photos',           anchor: 'event-photos'   },
  ]},
  { key: 'Players',        label: 'Players',         icon: UsersIcon,     sub: [
    { label: 'Registrations',    anchor: 'registrations'  },
    { label: 'Players & Flights',anchor: 'roster'         },
  ]},
  { key: 'Groups',         label: 'Groups',          icon: GroupIcon,     sub: [] },
  { key: 'Side Games',     label: 'Side Games',      icon: StarIcon,      sub: [
    { label: 'Opt-Ins',         anchor: 'opt-ins'        },
    { label: 'Blind Partners',  anchor: 'blind-partners' },
    { label: 'Super CTP',       anchor: 'super-ctp'      },
    { label: 'Super Skins',     anchor: 'super-skins'    },
  ]},
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
        <span className="flex items-center gap-2.5">
          <Icon className="w-4 h-4 shrink-0" />
          {label}
        </span>
        {sub?.length > 0 && (
          <svg className="w-3.5 h-3.5 text-current opacity-40 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        )}
      </NavLink>
      {isActive && sub?.length > 0 && (
        <div className="ml-7 mt-0.5 space-y-0.5 relative">
          <div className="absolute top-0 bottom-0 left-[3px] border-l border-ink/[0.06]" />
          {sub.map(({ label: sublabel, tab }) => (
            <button
              key={tab}
              onClick={() => setTab(tab)}
              className={`w-full text-left pl-3 pr-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === tab
                  ? 'text-ink bg-ink/[0.05]'
                  : 'text-ink-muted hover:text-ink hover:bg-ink/[0.04]'
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
    `flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'text-ink bg-ink/[0.05] font-semibold' : 'text-ink-muted hover:text-ink hover:bg-ink/[0.04]'
    }`
  const activeStyle = {}

  return (
    <div className="flex flex-col h-full bg-white border-r" style={{ borderColor: '#ebe9e4' }}>
      {/* Brand */}
      <div className="flex items-center gap-3 px-4 py-4 border-b" style={{ borderColor: '#ebe9e4' }}>
        {org?.logo_url ? (
          <img src={org.logo_url} alt={orgName}
            className="w-9 h-9 object-cover rounded-lg shrink-0 border"
            style={{ borderColor: '#ebe9e4' }} />
        ) : (
          <div className="w-9 h-9 rounded-lg shrink-0 flex items-center justify-center text-white font-semibold text-xs"
            style={{ background: SLATE }}>
            {orgName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="text-ink font-semibold text-sm truncate leading-tight">{orgName}</div>
          <div className="text-ink-muted text-xs truncate">{label} plan</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-ink-muted hover:text-ink p-1">
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
      <div className="px-3 pb-4 space-y-0.5 border-t pt-3" style={{ borderColor: '#ebe9e4' }}>
        <NavLink to="/admin/settings" end={false} onClick={onClose}
          className={linkClass}
          style={({ isActive }) => isActive ? activeStyle : {}}>
          <span className="flex items-center gap-2.5">
            <GearIcon className="w-4 h-4 shrink-0" />
            Settings
          </span>
        </NavLink>
        <Link to="/home" onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition-colors">
          <ExternalIcon className="w-4 h-4 shrink-0" />
          View Site
        </Link>
        {!isOwner && tier !== 'club' && (
          <a href="/upgrade" onClick={onClose}
            className="flex items-center justify-center gap-2 mt-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ background: SLATE, color: '#fff' }}>
            Upgrade {tier === 'pro' ? '→ Club' : '→ Pro'}
          </a>
        )}
        {/* User row */}
        <div className="flex items-center gap-3 px-3 pt-3 mt-1 border-t" style={{ borderColor: '#ebe9e4' }}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: '#eceae5', color: '#1d1d1f' }}>
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-ink text-xs font-semibold truncate">{profile?.full_name ?? user?.email}</div>
            <div className="text-ink-muted text-xs truncate">{user?.email}</div>
          </div>
          <button onClick={onSignOut} title="Sign out" className="text-ink-muted hover:text-ink transition-colors shrink-0">
            <SignOutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Event context sidebar ────────────────────────────────────────────────────
function EventSidebar({ org, eventName, eventStatus, sideGameOptions = [], basePath, onClose, onSignOut, user, profile }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') ?? 'Overview'
  const location  = useLocation()
  const initials  = (profile?.full_name ?? user?.email ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  // Strip flight suffixes to get base keys for filtering
  const activeSideGameKeys = new Set(sideGameOptions.map(s => {
    const m = s.match(/^(.+)_([a-z])$/)
    return m ? m[1] : s
  }))

  function tabClass(key) {
    return `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      activeTab === key ? 'text-ink bg-ink/[0.05] font-semibold' : 'text-ink-muted hover:text-ink hover:bg-ink/[0.04]'
    }`
  }

  return (
    <div className="flex flex-col h-full bg-white border-r" style={{ borderColor: '#ebe9e4' }}>
      {/* Back + org */}
      <div className="relative px-4 pt-4 pb-3 border-b" style={{ borderColor: '#ebe9e4' }}>
        <Link to="/admin"
          className="flex items-center gap-1.5 text-ink-muted hover:text-ink text-xs font-semibold mb-3 transition-colors"
          onClick={onClose}>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {org?.name ?? 'Home'}
        </Link>
        <div className="text-ink font-semibold text-sm leading-snug truncate">{eventName}</div>
        {eventStatus && (
          <div className="mt-1">
            <StatusDot status={eventStatus} />
          </div>
        )}
        {onClose && (
          <button onClick={onClose} className="absolute top-4 right-4 text-ink-muted hover:text-ink p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Tab nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {EVENT_TABS.map(({ key, label, icon: Icon, sub }) => {
          // For Side Games tab, filter sub-items to only those relevant to this event
          const SIDE_GAME_ANCHOR_KEYS = {
            'opt-ins':        null,          // always show if there are opt-in games (super_ctp, super_skins)
            'blind-partners': 'blind_partners',
            'super-ctp':      'super_ctp',
            'super-skins':    'super_skins',
          }
          const filteredSub = key === 'Side Games'
            ? sub.filter(({ anchor }) => {
                const gameKey = SIDE_GAME_ANCHOR_KEYS[anchor]
                if (gameKey === null) {
                  // Opt-Ins: show only if super_ctp or super_skins are active
                  return activeSideGameKeys.has('super_ctp') || activeSideGameKeys.has('super_skins')
                }
                if (gameKey === undefined) return true
                return activeSideGameKeys.has(gameKey)
              })
            : sub

          return (
            <div key={key}>
              <button
                onClick={() => { setSearchParams({ tab: key }); onClose?.() }}
                className={tabClass(key)}
                style={{ width: '100%', textAlign: 'left' }}>
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
              {/* Sub-items — shown when this tab is active */}
              {activeTab === key && filteredSub?.length > 0 && (
                <div className="ml-7 mt-0.5 space-y-0.5 relative">
                  <div className="absolute top-0 bottom-0 left-[3px] border-l border-ink/[0.06]" />
                  {filteredSub.map(({ label: subLabel, anchor }) => (
                    <a
                      key={anchor}
                      href={`#${anchor}`}
                      onClick={onClose}
                      className="flex items-center gap-2 pl-3 pr-3 py-1.5 rounded-md text-xs font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition-colors"
                    >
                      {subLabel}
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t pt-3" style={{ borderColor: '#ebe9e4' }}>
        <Link to="/home" onClick={onClose}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-ink-muted hover:text-ink hover:bg-ink/[0.04] transition-colors">
          <ExternalIcon className="w-4 h-4 shrink-0" />
          View Site
        </Link>
        <div className="flex items-center gap-3 px-3 pt-3 mt-1 border-t" style={{ borderColor: '#ebe9e4' }}>
          <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
            style={{ background: '#eceae5', color: '#1d1d1f' }}>
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-ink text-xs font-semibold truncate">{profile?.full_name ?? user?.email}</div>
          </div>
          <button onClick={onSignOut} title="Sign out" className="text-ink-muted hover:text-ink transition-colors shrink-0">
            <SignOutIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusDot({ status }) {
  const map = {
    active:   { color: '#16a34a', label: 'Active' },
    upcoming: { color: '#b45309', label: 'Upcoming' },
    complete: { color: '#6b7280', label: 'Complete' },
    draft:    { color: '#6b7280', label: 'Draft' },
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
      .select('name, event_number, status, side_game_options')
      .eq('slug', eventSlug)
      .single()
      .then(({ data }) => {
        if (data) setEventMeta({ name: data.name ?? `Event #${data.event_number}`, status: data.status, sideGameOptions: data.side_game_options ?? [] })
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
    ? <EventSidebar {...sharedProps} eventName={eventMeta?.name ?? '…'} eventStatus={eventMeta?.status} sideGameOptions={eventMeta?.sideGameOptions ?? []} basePath={basePath} onClose={() => setDrawerOpen(false)} />
    : <GlobalSidebar {...sharedProps} tier={tier} isOwner={isOwner} onClose={() => setDrawerOpen(false)} />

  const sidebarDesktop = isEventRoute
    ? <EventSidebar {...sharedProps} eventName={eventMeta?.name ?? '…'} eventStatus={eventMeta?.status} sideGameOptions={eventMeta?.sideGameOptions ?? []} basePath={basePath} />
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
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-white border-b"
          style={{ borderColor: '#ebe9e4' }}>
          <button onClick={() => setDrawerOpen(true)} className="text-ink-muted hover:text-ink p-1" aria-label="Open menu">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <img src={org?.logo_url ?? '/logo.png'} alt="" className="w-6 h-6 object-contain rounded" />
          <span className="text-ink font-semibold text-sm truncate">
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
function StarIcon({ className }) {
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
}
