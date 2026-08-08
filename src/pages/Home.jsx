import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import Footer from '../components/ui/Footer'
import Pricing from '../components/ui/Pricing'
import HeroSection from '../components/ui/HeroSection'
import TestimonialsScroll from '../components/ui/TestimonialsScroll'

const GREEN  = '#1B4332'
const GOLD   = '#D4AF37'
const INK    = '#1d1d1f'

// ─── Features ────────────────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Live Leaderboards',
    body: 'Real-time standings update as scores come in. Share a link with every player — no login required.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Digital Scorecards',
    body: 'Groups scan a QR code, enter a group code, and start scoring — no app download or account needed.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Player Management',
    body: 'Import your roster, track handicap indexes, assign flights, and manage groups — all in one place.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Payout Tracking',
    body: 'Automatically calculate prize pots based on entry fees. Skins, CTP, long drive, and custom side games.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Season Standings',
    body: 'Cumulative season points across all events with a shareable public standings page for your league.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    title: 'Printable Scorecards',
    body: 'Export pro-quality scorecards for every group with QR codes, tee times, and course details pre-filled.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Auto Group Scheduling',
    body: 'Automatically assign players to groups by handicap, flight, or randomly — one click builds your whole tee sheet.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Online Registration',
    body: 'Players sign up for events through a shareable registration link. Guest requests, notes, and GHIN numbers collected automatically.',
  },
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
    title: 'Offline Scoring',
    body: 'Lost signal on the back nine? Scores save locally and sync automatically the moment connectivity returns.',
  },
]

// ─── Pricing ─────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: 'Starter',
    price: 0,
    yearlyPrice: 0,
    isPopular: false,
    features: [
      '1 league',
      'Up to 16 players',
      'Digital scoring & leaderboards',
      'Season standings',
      'Printable scorecards',
    ],
    buttonText: 'Get started free',
    href: '/login',
    description: 'Perfect for small groups just getting started.',
  },
  {
    name: 'Pro',
    price: 29,
    yearlyPrice: 199,
    isPopular: true,
    features: [
      'Up to 2 leagues',
      'Unlimited players',
      'Everything in Starter',
      'Flights A & B',
      'Skins, CTP & side games',
      'Score export (CSV)',
      'Priority support',
    ],
    buttonText: 'Start free trial',
    href: '/login',
    description: 'Most popular for established weekly leagues.',
  },
  {
    name: 'Club',
    price: 79,
    yearlyPrice: 549,
    isPopular: false,
    features: [
      'Everything in Pro',
      'Multiple admins',
      'Team Play scoring',
      'Custom branding',
      'Online registration',
      'Dedicated onboarding',
    ],
    buttonText: 'Start free trial',
    href: '/login',
    description: 'For clubs and multi-league organizations.',
  },
]

const ONE_TIME = [
  {
    name: 'Tournament',
    price: 'Starting at $49',
    sub: 'one-time · assisted setup',
    description: 'Perfect for a single event — set up scoring, groups, leaderboard, and printable scorecards for one tournament.',
    features: [
      'One event, unlimited players',
      'Digital scoring & QR access',
      'Live leaderboard',
      'Printable scorecards',
      'Skins & side games',
    ],
    cta: 'Contact Us',
    ctaTo: 'mailto:admin@scorifygolf.com',
  },
  {
    name: 'Golf Trip',
    price: 'Starting at $249',
    sub: 'one-time · assisted setup',
    description: 'We set it up for you. Submit your itinerary, players, and courses — we handle the rest. Up to 7 rounds across multiple courses.',
    features: [
      'Up to 7 rounds / courses',
      'Unlimited players',
      'Everything in Tournament',
      'Cross-round standings',
      'Skins per round',
      'Email consultation available',
      'Data available for 90 days',
    ],
    cta: 'Contact Us',
    ctaTo: 'mailto:admin@scorifygolf.com',
  },
]

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const { user, profile, signOut, loading, profileLoading } = useAuth()
  const navigate = useNavigate()
  const [events,   setEvents]   = useState([])
  const [fetching, setFetching] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const isAdmin       = profile?.role === 'admin'
  const isScorekeeper = profile?.role === 'scorekeeper'
  const isLoggedIn    = !loading && !profileLoading && !!user

  // Auto-redirect new users who haven't set up an org yet
  useEffect(() => {
    if (loading || profileLoading || !user) return
    if (!profile?.org_id) {
      navigate('/onboarding', { replace: true })
      return
    }
    loadEvents()
  }, [user, profile, loading, profileLoading])

  async function loadEvents() {
    setFetching(true)
    try {
      if (isAdmin) {
        const { data } = await supabase
          .from('events')
          .select('id, name, slug, event_number, event_date, status, league:leagues(slug)')
          .in('status', ['active', 'upcoming'])
          .order('event_date', { ascending: true })
          .limit(10)
        setEvents(data ?? [])
      } else if (isScorekeeper) {
        const { data: playerRows } = await supabase
          .from('players').select('id').eq('email', user.email).limit(1)
        const playerId = playerRows?.[0]?.id
        if (playerId) {
          const { data: entries } = await supabase
            .from('event_players')
            .select('event_id, events(id, name, slug, event_number, event_date, status, league:leagues(slug))')
            .eq('player_id', playerId)
          const active = (entries ?? [])
            .map(e => e.events)
            .filter(ev => ev && ['active', 'upcoming'].includes(ev.status))
            .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
          setEvents(active)
        }
      }
    } finally {
      setFetching(false)
    }
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const NAV_LINKS = [
    { label: 'Features', href: '#features' },
    { label: 'Pricing',  href: '#pricing'  },
    { label: 'Roadmap',  href: '/roadmap'  },
    { label: 'FAQ',      href: '/faq'      },
    { label: 'Contact',  href: '#contact'  },
    { label: 'About',    href: '#about'    },
  ]

  return (
    <>
    <Helmet>
      <title>Scorify Golf — Golf League Management Software</title>
      <meta name="description" content="The easiest way to run a golf league. Live leaderboards, digital scorecards, handicap tracking, payout management, and online registration — free to start." />
      <meta property="og:title" content="Scorify Golf — Golf League Management Software" />
      <meta property="og:description" content="Run your golf league with live leaderboards, digital scorecards, handicap tracking, and payout management. Free to start." />
      <meta property="og:url" content="https://scorifygolf.com" />
      <link rel="canonical" href="https://scorifygolf.com" />
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Scorify Golf",
        "applicationCategory": "SportsApplication",
        "operatingSystem": "Web",
        "description": "Golf league management software with live leaderboards, digital scorecards, handicap tracking, and payout management.",
        "url": "https://scorifygolf.com",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free plan available"
        },
        "provider": {
          "@type": "Organization",
          "name": "Scorify Golf",
          "url": "https://scorifygolf.com"
        }
      })}</script>
    </Helmet>
    <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

      {/* ── Public nav ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #ebe9e4' }}>
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Brand */}
          <a href="#" className="flex items-center gap-2.5">
            <img src="/logo.png" alt="Scorify Golf" className="w-8 h-8 object-contain" />
            <span className="font-bold text-base" style={{ letterSpacing: '-0.02em', color: INK }}>Scorify Golf</span>
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className="text-sm font-medium transition-colors" style={{ color: '#6b7280' }}
                onMouseEnter={e => e.currentTarget.style.color = INK}
                onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}>
                {l.label}
              </a>
            ))}
          </nav>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {isLoggedIn ? (
              <>
                {isAdmin && (
                  <Link to="/admin" className="hidden sm:inline text-sm font-semibold px-3 py-1.5 rounded-full transition-colors"
                    style={{ color: GREEN }}
                    onMouseEnter={e => e.currentTarget.style.background = '#f0fdf4'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    Admin ↗
                  </Link>
                )}
                <button onClick={handleSignOut}
                  className="text-sm font-semibold px-4 py-1.5 rounded-full border transition-colors"
                  style={{ borderColor: '#d1d5db', color: '#6b7280' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = INK; e.currentTarget.style.color = INK }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#d1d5db'; e.currentTarget.style.color = '#6b7280' }}>
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium transition-colors" style={{ color: '#6b7280' }}
                  onMouseEnter={e => e.currentTarget.style.color = INK}
                  onMouseLeave={e => e.currentTarget.style.color = '#6b7280'}>
                  Sign in
                </Link>
                <Link to="/login"
                  className="text-sm font-bold px-4 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
                  style={{ background: GREEN }}>
                  Get started
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button className="md:hidden p-1.5 rounded-full" onClick={() => setMenuOpen(v => !v)}
              style={{ color: '#6b7280' }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                {menuOpen
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="md:hidden px-6 py-4 flex flex-col gap-3" style={{ borderTop: '1px solid #ebe9e4' }}>
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
                className="text-sm font-medium py-1" style={{ color: '#6b7280' }}>
                {l.label}
              </a>
            ))}
            {isAdmin && <Link to="/admin" className="text-sm font-semibold" style={{ color: GREEN }}>Admin ↗</Link>}
          </nav>
        )}
      </header>

      {/* ── Logged-in dashboard strip ──────────────────────────────── */}
      {isLoggedIn && (
        <div className="bg-white" style={{ borderBottom: '1px solid #ebe9e4' }}>
          <div className="max-w-6xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-400">Signed in as</p>
              <p className="text-sm font-semibold text-gray-900">{profile?.full_name || user?.email}</p>
            </div>

            {/* No org set up yet — prompt onboarding */}
            {!profile?.org_id && (
              <Link to="/onboarding"
                className="shrink-0 text-sm font-bold px-5 py-2.5 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}>
                Set up your league →
              </Link>
            )}

            {(isAdmin || isScorekeeper) && (
              <div className="flex-1">
                <p className="text-xs text-gray-400 mb-2">{isAdmin ? 'Active & Upcoming Events' : 'Your Events'}</p>
                {fetching ? (
                  <div className="h-8 rounded-lg animate-pulse bg-gray-100 w-48" />
                ) : events.length === 0 ? (
                  <p className="text-xs text-gray-400">No active events.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {events.map(ev => (
                      <Link key={ev.id}
                        to={`/${ev.league?.slug}/${ev.slug}/scorecard`}
                        className="text-xs font-semibold px-3 py-1.5 rounded-full text-white transition-opacity hover:opacity-80"
                        style={{ background: GREEN }}>
                        {ev.name || `Event #${ev.event_number}`}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
            {isAdmin && (
              <Link to="/admin"
                className="shrink-0 text-sm font-bold px-4 py-2 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}>
                Go to Admin →
              </Link>
            )}
          </div>
        </div>
      )}

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <HeroSection
          logo={{ url: '/logo.png', alt: 'Scorify Golf', text: 'Scorify Golf' }}
          slogan="Golf league management software"
          title={<>Run your golf league<br /><span style={{ color: GOLD }}>the right way.</span></>}
          subtitle="Digital scoring, live leaderboards, handicap tracking, payout management, and printable scorecards — built for the way your golf league actually plays."
          primaryCta={{ text: 'Get started free', href: '/login' }}
          secondaryCta={{ text: 'See features →', href: '#features' }}
          backgroundImage="/course.jpeg"
          contactInfo={[
            { label: 'scorifygolf.com' },
            { label: 'Mulligan\'s Island Golf Club, San Diego CA' },
          ]}
        />

        {/* ── How it works ───────────────────────────────────────────── */}
        <section className="py-20" style={{ background: '#ffffff' }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>How it works</p>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
                Set up in minutes. Score from any phone.
              </h2>
              <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: '#6b7280' }}>
                No app download required. Works on any browser, any device.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  step: '1',
                  title: 'Set up your event',
                  body: 'Add players in advance or let them register themselves. Set your format, flights, side games, and entry fees. Build groups manually or let Scorify auto-assign.',
                },
                {
                  step: '2',
                  title: 'Share the link',
                  body: 'Send players a link, invite code, or QR code printed on the cart sign. They tap it, find their name, and start scoring — no download or account required.',
                },
                {
                  step: '3',
                  title: 'Play',
                  body: 'Scores update hole-by-hole from every phone simultaneously. The live leaderboard refreshes in real time so everyone follows along from the fairway.',
                },
              ].map(s => (
                <div key={s.step} className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg mb-5 shrink-0"
                    style={{ background: GREEN }}>
                    {s.step}
                  </div>
                  <h3 className="font-bold text-base mb-2" style={{ color: INK }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed text-justify" style={{ color: '#6b7280' }}>{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ───────────────────────────────────────────────── */}
        <section id="features" className="py-24" style={{ background: '#fbfaf8' }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Features</p>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
                Everything your golf league needs
              </h2>
              <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: '#6b7280' }}>
                From the first tee to season champion — Scorify Golf handles scoring, handicaps, payouts, and standings for your golf league.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map(f => (
                <div key={f.title} className="bg-white rounded-2xl p-6 shadow-sm" style={{ border: '1px solid #ebe9e4' }}>
                  <div className="mb-4" style={{ color: GREEN }}>{f.icon}</div>
                  <h3 className="font-bold text-base mb-2" style={{ color: INK }}>{f.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────────── */}
        <section id="pricing" className="py-24" style={{ background: '#ffffff' }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-2">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Pricing</p>
            </div>
            <Pricing
              plans={PLANS}
              title="Simple, transparent pricing"
              description={'Start free. Upgrade when your league grows.'}
            />

            {/* One-time options */}
            <div style={{ borderTop: '1px solid #ebe9e4', paddingTop: '3rem', marginTop: '4rem' }}>
              <div className="text-center mb-8">
                <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#9ca3af' }}>One-Time Purchases</p>
                <h3 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
                  Just need it for one event?
                </h3>
                <p className="text-sm mt-2" style={{ color: '#6b7280' }}>No subscription. Pay once, use it for your event.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-6">
                {ONE_TIME.map(opt => (
                  <div key={opt.name} className="rounded-2xl p-7 flex flex-col" style={{ border: '1px solid #ebe9e4', background: '#fbfaf8' }}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: '#9ca3af' }}>{opt.name}</p>
                        <div className="flex items-end gap-1">
                          <span className="text-3xl font-bold" style={{ color: INK, fontFamily: "'Playfair Display', serif" }}>{opt.price}</span>
                          <span className="text-sm mb-1" style={{ color: '#9ca3af' }}>{opt.sub}</span>
                        </div>
                      </div>
                      <span className="text-xs font-bold px-3 py-1 rounded-full mt-1" style={{ background: '#fef9ec', color: '#92611a', border: '1px solid #f5d87a' }}>
                        One-time
                      </span>
                    </div>
                    <p className="text-sm mb-4 leading-relaxed" style={{ color: '#6b7280' }}>{opt.description}</p>
                    <ul className="space-y-2 mb-6 flex-1">
                      {opt.features.map(f => (
                        <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#4b5563' }}>
                          <svg className="mt-0.5 shrink-0" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24" style={{ color: GREEN }}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {opt.ctaTo.startsWith('mailto') ? (
                      <a href={opt.ctaTo}
                        className="block text-center py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                        style={{ background: GREEN, color: '#fff' }}>
                        {opt.cta}
                      </a>
                    ) : (
                      <Link to={opt.ctaTo}
                        className="block text-center py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                        style={{ background: GREEN, color: '#fff' }}>
                        {opt.cta}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Testimonials ───────────────────────────────────────────── */}
        <TestimonialsScroll />

        {/* ── Contact ────────────────────────────────────────────────── */}
        <section id="contact" className="py-24" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Contact</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
              Get in touch
            </h2>
            <p className="text-base mb-10" style={{ color: '#6b7280' }}>
              Questions about pricing, setting up your league, or anything else? We're happy to help.
            </p>
            <a href="mailto:admin@scorifygolf.com"
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-base text-white transition-opacity hover:opacity-90"
              style={{ background: GREEN }}>
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              admin@scorifygolf.com
            </a>
            <p className="text-xs mt-6" style={{ color: '#9ca3af' }}>We typically respond within one business day.</p>
          </div>
        </section>

        {/* ── Roadmap ────────────────────────────────────────────────── */}
        <section id="roadmap" className="py-24" style={{ background: '#ffffff' }}>
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>What's next</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
                Built with your league in mind
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: '#6b7280' }}>
                Scorify is actively developed. Here's what's on the roadmap — and we want your input on what comes next.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {[
                { label: 'Leaderboard embed for your club website', status: 'planned' },
                { label: 'Sponsor logos on print assets and leaderboard', status: 'planned' },
                { label: 'Stripe-powered online payment collection', status: 'planned' },
                { label: 'Text message scoring reminders (Twilio)', status: 'planned' },
                { label: 'Multi-day trip scoring across multiple courses', status: 'planned' },
                { label: 'Public event website with live leaderboard', status: 'planned' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3 rounded-xl p-4" style={{ background: '#fbfaf8', border: '1px solid #ebe9e4' }}>
                  <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: GREEN }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                  </span>
                  <span className="text-sm" style={{ color: '#374151' }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div className="rounded-2xl p-8 text-center" style={{ background: `linear-gradient(135deg, #0b2318, ${GREEN})` }}>
              <h3 className="text-xl font-bold text-white mb-2">Have an idea?</h3>
              <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.7)' }}>
                Tell us what would make Scorify work better for your league. We read every submission.
              </p>
              <Link to="/roadmap"
                className="inline-block px-7 py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                style={{ background: GOLD, color: '#1a1a1a' }}>
                Submit an idea →
              </Link>
            </div>
          </div>
        </section>

        {/* ── About / CTA ────────────────────────────────────────────── */}
        <section id="about" className="py-24" style={{ background: '#fbfaf8' }}>
          <div className="max-w-3xl mx-auto px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>About</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
              Built by a league director, for league directors
            </h2>
            <p className="text-base leading-relaxed mb-4 text-justify" style={{ color: '#6b7280' }}>
              Scorify was built by Kevin V, a business operations professional who was that guy — stuck at the
              scoring table entering results while everyone else had a beer after the round. The bottleneck was
              always the same: one person manually reconciling paper scorecards while the rest of the group waited.
            </p>
            <p className="text-base leading-relaxed mb-4 text-justify" style={{ color: '#6b7280' }}>
              Existing tools were either too complicated, too expensive, or built for golf facilities — not the
              independent organizer running a Wednesday night league out of a group chat. Scorify delivers an
              affordable, modern platform so any league director can run their league like a pro.
            </p>
            <p className="text-base leading-relaxed mb-10 text-justify" style={{ color: '#6b7280' }}>
              Questions or feedback? Reach out directly at{' '}
              <a href="mailto:admin@scorifygolf.com" style={{ color: GREEN, fontWeight: 600 }}>admin@scorifygolf.com</a>.
            </p>
            <Link to="/login"
              className="inline-block px-8 py-3.5 rounded-full font-bold text-sm text-white transition-opacity hover:opacity-90"
              style={{ background: GREEN }}>
              Start your free league →
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </div>
    </>
  )
}
