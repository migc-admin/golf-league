import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { useAuth } from '../hooks/useAuth'
import Footer from '../components/ui/Footer'
import PricingSection from '../components/ui/PricingSection'
import HeroLeague from '../components/ui/HeroLeague'
import SolutionRouter from '../components/ui/SolutionRouter'
import TestimonialsScroll from '../components/ui/TestimonialsScroll'
import TryIt from '../components/try-it/TryIt'
import { getHomepageGuides } from '../lib/blogPosts'
import SiteHeader from '../components/ui/SiteHeader'

const GUIDES = getHomepageGuides(6)

// Founder photo (path under /public) and personal LinkedIn or X profile for the About section.
// Each shows only once it's filled in.
const FOUNDER = { name: 'Kevin Vargas', photo: null, profileUrl: null, profileLabel: 'Kevin on LinkedIn' }

const GREEN  = '#1B4332'
const GOLD   = '#D4AF37'
const INK    = '#1d1d1f'

// ─── Features (ordered start-of-tournament → finish) ──────────────────────────
const FEATURES = [
  {
    icon: (
      <svg width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Online Registration',
    body: 'Players sign up for events through a shareable registration link and pay their entry through your own Venmo or PayPal link, so you stop chasing down league fees. Guest requests, notes, and GHIN numbers collected automatically.',
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
        <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Auto Group Scheduling',
    body: 'Automatically assign players to groups by handicap, flight, or randomly — one click builds your whole tee sheet.',
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
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    title: 'Digital Scorecards',
    body: 'Groups scan a QR code, enter a group code, and start scoring — no app download or account needed.',
  },
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
        <path d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
    ),
    title: 'Offline Scoring',
    body: 'Lost signal on the back nine? Scores save locally and sync automatically the moment connectivity returns.',
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
]


// ─── Main Component ───────────────────────────────────────────────────────────
export default function Home() {
  const { user, profile, loading, profileLoading } = useAuth()
  const navigate = useNavigate()

  // Auto-redirect based on profile state
  useEffect(() => {
    if (loading || profileLoading || !user) return
    if (!profile?.org_id) {
      // Only send to onboarding if profile loaded and genuinely has no org
      if (profile !== null && profile !== undefined) {
        navigate('/onboarding', { replace: true })
      }
      return
    }
  }, [user, profile, loading, profileLoading])

  return (
    <>
    <Helmet>
      <title>Scorify Golf — Golf League Management Software</title>
      <meta name="description" content="Golf league management software for weekly, monthly, and season-long leagues: live scoring, leaderboards, handicaps, and payouts. Free to start." />
      <meta property="og:title" content="Scorify Golf — Golf League Management Software" />
      <meta property="og:description" content="Set up in minutes — online registration, digital scorecards, live leaderboards, and payouts. Free to start, no credit card required." />
      <meta property="og:url" content="https://www.scorifygolf.com/" />
      <link rel="canonical" href="https://www.scorifygolf.com/" />
      <script type="application/ld+json">{JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "Scorify Golf",
        "applicationCategory": "SportsApplication",
        "operatingSystem": "Web",
        "description": "Golf league management software with live leaderboards, digital scorecards, handicap tracking, and payout management.",
        "url": "https://www.scorifygolf.com/",
        "offers": {
          "@type": "Offer",
          "price": "0",
          "priceCurrency": "USD",
          "description": "Free plan available"
        },
        "provider": {
          "@type": "Organization",
          "name": "Scorify Golf",
          "url": "https://www.scorifygolf.com/",
          "sameAs": [
            "https://instagram.com/scorifygolf",
            "https://x.com/scorifygolf",
            "https://www.linkedin.com/company/scorify-golf/"
          ]
        }
      })}</script>
    </Helmet>
    <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

      <SiteHeader />

      <main className="flex-1">

        {/* ── Hero ───────────────────────────────────────────────────── */}
        <HeroLeague />

        {/* ── Built for: leagues / tournaments / trips ───────────────── */}
        <SolutionRouter />

        {/* ── How it works ───────────────────────────────────────────── */}
        <section className="py-20" style={{ background: '#ffffff' }}>
          <div className="max-w-5xl mx-auto px-6">
            <div className="text-center mb-14">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>How it works</p>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
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

        {/* ── Try it: a sample league night in five steps ──────────────── */}
        <TryIt />

        {/* ── Features ───────────────────────────────────────────────── */}
        <section id="features" className="py-24" style={{ background: '#fbfaf8' }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Features</p>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
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
            <div className="mt-10 text-center">
              <Link to="/golf-league-software" className="inline-flex min-h-[44px] items-center text-sm font-semibold" style={{ color: GREEN }}>
                See everything our golf league software does →
              </Link>
            </div>
          </div>
        </section>

        {/* ── Pricing ────────────────────────────────────────────────── */}
        <section id="pricing" className="py-24" style={{ background: '#ffffff' }}>
          <div className="max-w-5xl mx-auto px-6">
            <PricingSection />
            <p className="text-sm text-center mt-10">
              <Link to="/pricing" className="inline-flex min-h-[44px] items-center font-semibold" style={{ color: GREEN }}>Compare plans and pricing FAQs →</Link>
            </p>
          </div>
        </section>

        {/* ── Testimonials ───────────────────────────────────────────── */}
        <TestimonialsScroll />

        {/* ── Roadmap ────────────────────────────────────────────────── */}
        <section id="roadmap" className="py-24" style={{ background: '#ffffff' }}>
          <div className="max-w-4xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>What's next</p>
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
                Built with your league in mind
              </h2>
              <p className="text-base max-w-xl mx-auto" style={{ color: '#6b7280' }}>
                Scorify is actively developed. Here's what's on the roadmap — and we want your input on what comes next.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 mb-10">
              {[
                { label: 'Stripe-powered online payment collection', status: 'planned' },
                { label: 'Text message scoring reminders (Twilio)', status: 'planned' },
                { label: 'USGA integration', status: 'planned' },
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

        {/* ── FAQ ────────────────────────────────────────────────────── */}
        <section id="faq" className="py-24" style={{ background: '#fbfaf8' }}>
          <div className="max-w-3xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>FAQ</p>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
                Common questions
              </h2>
            </div>
            <div className="divide-y" style={{ borderColor: '#e5e7eb' }}>
              {[
                { q: 'Do players need to download an app?', a: 'No. Scorify runs entirely in the browser. Players join a scorecard by scanning a QR code or entering a group code — no account or app required.' },
                { q: 'How does digital scoring work?', a: 'The admin creates groups before the round. On the day, each group scans a QR code or enters a group code to access their digital scorecard. Scores sync to the live leaderboard hole-by-hole in real time.' },
                { q: 'What scoring formats are supported?', a: 'Stroke play, Stableford, Match Points, Low Putts, and Skins. Net scoring with handicap adjustments is included on all plans.' },
                { q: 'Can Scorify calculate payouts?', a: 'Yes. Configure prize amounts for overall finishers, flights, skins, CTP, and long drive — Scorify calculates the breakdown automatically.' },
                { q: 'Is my course in the database?', a: 'Scorify uses course data including par and stroke index for handicap calculations. Search for your course by name when you set it up, and its par, stroke index, slope, and rating load for each tee. If your course is not yet listed, you can enter the details manually.' },
                { q: 'Can I try it before paying?', a: 'Yes. Starter is free with no credit card. Pro and Club start with a 21-day free trial, and you can cancel before it ends.' },
              ].map(({ q, a }) => (
                <div key={q} className="py-5">
                  <p className="font-semibold text-sm mb-2" style={{ color: INK }}>{q}</p>
                  <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{a}</p>
                </div>
              ))}
            </div>
            <div className="mt-8 text-center">
              <a href="/faq" className="inline-flex min-h-[44px] items-center text-sm font-semibold" style={{ color: GREEN }}>See all FAQs →</a>
            </div>
          </div>
        </section>

        {/* ── Guides ─────────────────────────────────────────────────── */}
        <section id="guides" className="py-24" style={{ background: '#ffffff' }}>
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Guides</p>
              <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
                Guides for golf league directors
              </h2>
              <p className="mt-4 text-base max-w-xl mx-auto" style={{ color: '#6b7280' }}>
                What we've learned running a 40-player monthly league: formats, side games, handicaps, and season standings.
              </p>
            </div>

            <Link to={`/blog/${GUIDES.featured.slug}`}
              className="group block rounded-2xl p-7 md:p-9 mb-6 transition-transform hover:-translate-y-0.5"
              style={{ background: `linear-gradient(135deg, #0b2318, ${GREEN})` }}>
              <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>Start here · {GUIDES.featured.category}</p>
              <h3 className="text-xl md:text-2xl font-bold text-white mb-3" style={{ letterSpacing: '-0.01em' }}>{GUIDES.featured.title}</h3>
              <p className="text-sm leading-relaxed max-w-3xl mb-5" style={{ color: 'rgba(255,255,255,0.75)' }}>{GUIDES.featured.excerpt}</p>
              <span className="text-sm font-bold" style={{ color: GOLD }}>Read the handbook →</span>
            </Link>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {GUIDES.rest.map(p => (
                <Link key={p.slug} to={`/blog/${p.slug}`}
                  className="flex flex-col rounded-2xl p-6 transition-shadow hover:shadow-md"
                  style={{ background: '#fbfaf8', border: '1px solid #ebe9e4' }}>
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GREEN }}>{p.category}</p>
                  <h3 className="font-bold text-base mb-2" style={{ color: INK }}>{p.title}</h3>
                  <p className="text-sm leading-relaxed line-clamp-3 mb-4" style={{ color: '#6b7280' }}>{p.excerpt}</p>
                  <span className="mt-auto text-sm font-semibold" style={{ color: GREEN }}>Read guide →</span>
                </Link>
              ))}
            </div>

            <div className="mt-10 text-center">
              <Link to="/blog" className="inline-flex min-h-[44px] items-center text-sm font-semibold" style={{ color: GREEN }}>See all guides →</Link>
            </div>
          </div>
        </section>

        {/* ── Contact ────────────────────────────────────────────────── */}
        <section id="contact" className="py-24" style={{ background: '#ffffff' }}>
          <div className="max-w-2xl mx-auto px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Contact</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
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

        {/* ── About / CTA ────────────────────────────────────────────── */}
        <section id="about" className="py-24" style={{ background: '#fbfaf8' }}>
          <div className="max-w-3xl mx-auto px-6 text-center">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>About</p>
            <h2 className="text-3xl md:text-4xl font-bold mb-6" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
              Built by a league director, for league directors
            </h2>
            {FOUNDER.photo && (
              <img src={FOUNDER.photo} alt={FOUNDER.name} className="mx-auto mb-6 h-28 w-28 rounded-full object-cover" loading="lazy" />
            )}
            <p className="text-base leading-relaxed mb-4 text-justify" style={{ color: '#6b7280' }}>
              Scorify was built by Kevin Vargas, who spent one too many rounds stuck at the scoring table
              reconciling paper scorecards while everyone else finished up. The bottleneck was always the same
              person, doing the same manual work, every week.
            </p>
            <p className="text-base leading-relaxed mb-4 text-justify" style={{ color: '#6b7280' }}>
              Existing tools were either built for golf facilities, too complex for an independent organizer
              running a weekly league out of a group chat, or too expensive. Scorify is the affordable, modern
              alternative — built so any league director can run their league like a pro.
            </p>
            <p className="text-base leading-relaxed mb-4 text-justify" style={{ color: '#6b7280' }}>
              Kevin's own playbook for running a league is free to read:{' '}
              <Link to="/blog/running-a-golf-league-commissioners-handbook" style={{ color: GREEN, fontWeight: 600 }}>The Commissioner's Handbook</Link>.
              {FOUNDER.profileUrl && (
                <> Connect with him on{' '}
                  <a href={FOUNDER.profileUrl} target="_blank" rel="noopener noreferrer" style={{ color: GREEN, fontWeight: 600 }}>{FOUNDER.profileLabel.replace('Kevin on ', '')}</a>.
                </>
              )}
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
