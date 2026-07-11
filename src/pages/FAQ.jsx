import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'

const FAQS = [
  {
    category: 'Getting Started',
    items: [
      {
        q: 'What is Scorify Golf?',
        a: 'Scorify Golf is a web-based golf league management platform. It handles digital scoring, live leaderboards, season standings, handicap tracking, payout management, and printable scorecards — all in one place. No app download required for players.',
      },
      {
        q: 'Do I need to download an app?',
        a: 'No. Scorify Golf runs entirely in the browser. Players join a scorecard by scanning a QR code or entering a group code — no account or app installation required.',
      },
      {
        q: 'How do I get started?',
        a: 'Sign up for a free Starter account, create your league, add your players, and set up your first event. Most league admins are up and running in under 15 minutes.',
      },
      {
        q: 'Can I try Scorify Golf before paying?',
        a: 'Yes. All plans — including Pro and Club — start with a free trial. No credit card required to get started.',
      },
    ],
  },
  {
    category: 'Scoring & Events',
    items: [
      {
        q: 'How does digital scoring work?',
        a: 'Before your round, the admin creates groups and assigns players. On the day of the event, each group scans a QR code or enters a group code to access their digital scorecard. Scores are entered hole-by-hole and sync to the live leaderboard in real time.',
      },
      {
        q: 'What scoring formats are supported?',
        a: 'Scorify supports stroke play (18-hole, Front 9, Back 9), Stableford, Match Points, Low Putts, and Skins. Net scoring with handicap adjustments is also supported.',
      },
      {
        q: 'Can I run a shotgun start event?',
        a: 'Yes. When creating an event, toggle on Shotgun Start. You can then assign a starting hole to each group, and the tee sheet and cart signs will reflect those assignments automatically.',
      },
      {
        q: 'What side games are supported?',
        a: 'Scorify supports Skins, Closest to the Pin (CTP), Long Drive, Low Putts, and custom side game configurations. Payout amounts can be configured per game.',
      },
      {
        q: 'Can players see the leaderboard without logging in?',
        a: 'Yes. Every event has a shareable public leaderboard URL. Anyone with the link can follow along in real time — no account required.',
      },
    ],
  },
  {
    category: 'Handicaps & Flights',
    items: [
      {
        q: 'Does Scorify handle handicaps?',
        a: 'Yes. You can enter each player\'s handicap index in their player profile. Scorify applies course handicap adjustments automatically when calculating net scores.',
      },
      {
        q: 'What are flights and how do they work?',
        a: 'Flights split your field into groups — typically Flight A (lower handicaps) and Flight B (higher handicaps) — so players compete against others at a similar skill level. Flights are available on Pro and Club plans.',
      },
    ],
  },
  {
    category: 'Payouts & Season Standings',
    items: [
      {
        q: 'Can Scorify calculate payouts?',
        a: 'Yes. The Payout tab in each event lets you configure prize amounts for overall finishers, flights, skins, CTP, long drive, and other side games. Scorify calculates the breakdown automatically based on scores.',
      },
      {
        q: 'How does season standings work?',
        a: 'Season standings track cumulative earnings or points across all events in a league. Each event\'s results roll up automatically. You can share a public standings page with your players at any time.',
      },
    ],
  },
  {
    category: 'Team Play',
    items: [
      {
        q: 'What is Team Play?',
        a: 'Team Play is a format where players are grouped into teams that compete against each other across events — similar to a Ryder Cup or league-style team format. Admins set up teams, assign players, and select active players for each event. Points are tracked across the season.',
      },
      {
        q: 'Can I rename Team Play to match my league\'s format?',
        a: 'Yes. In your league settings, you can customize the Team Play label to anything that fits your format — "Ryder Cup," "Match Play," "TGL Teams," or anything else.',
      },
    ],
  },
  {
    category: 'Print Assets',
    items: [
      {
        q: 'What printable assets does Scorify generate?',
        a: 'From the Event Overview, you can print a Tee Sheet (grouped player list with tee times and hole assignments), Cart Signs (one per group with players, tee time, and hole), and CTP / Long Drive cards for on-course use.',
      },
      {
        q: 'Can I print scorecards for players?',
        a: 'Yes. Printable scorecards can be exported for each group, pre-filled with player names, tee times, course details, and a QR code for digital score entry.',
      },
    ],
  },
  {
    category: 'Plans & Pricing',
    items: [
      {
        q: 'What is included in the free Starter plan?',
        a: 'The Starter plan includes 1 league, up to 16 players, digital scoring, live leaderboards, season standings, and printable scorecards — completely free, no credit card required.',
      },
      {
        q: 'What is the difference between Pro and Club?',
        a: 'Pro adds unlimited players, up to 2 leagues, flights, skins and side games, and score export. Club adds everything in Pro plus multiple admins, Team Play scoring, custom branding, and online player registration.',
      },
      {
        q: 'Is there a one-time option for a single tournament or golf trip?',
        a: 'Yes. We offer one-time packages starting at $49 for a single tournament and starting at $249 for a multi-round golf trip with assisted setup. Contact us at admin@scorifygolf.com to get started.',
      },
      {
        q: 'Can I switch plans later?',
        a: 'Yes. You can upgrade or downgrade your plan at any time from your account settings.',
      },
    ],
  },
  {
    category: 'Online Registration',
    items: [
      {
        q: 'Can players register for events online?',
        a: 'Yes, on the Club plan. Each event gets a public registration link you can share with players. They fill out their details, and you\'ll see their registration in your admin panel. Payment can be collected via Venmo or PayPal.',
      },
      {
        q: 'How does payment work for online registration?',
        a: 'After registering, players are directed to pay via Venmo or PayPal (configured in your event settings). You confirm payment manually, and the registration status updates to confirmed. Stripe integration for automatic payment confirmation is on the roadmap.',
      },
    ],
  },
]

function FAQItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-sm font-semibold text-gray-900">{q}</span>
        <span className="shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-transform"
          style={{ background: open ? GREEN : '#f3f4f6', transform: open ? 'rotate(45deg)' : 'none' }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M5 1v8M1 5h8" stroke={open ? '#fff' : '#6b7280'} strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="text-sm text-gray-600 leading-relaxed pb-5">{a}</p>
      )}
    </div>
  )
}

export default function FAQ() {
  return (
    <>
      <Helmet>
        <title>FAQ — Scorify Golf | Golf League Management Software</title>
        <meta name="description" content="Answers to common questions about Scorify Golf — digital scoring, handicaps, payouts, team play, pricing, and more." />
        <meta property="og:title" content="FAQ — Scorify Golf" />
        <meta property="og:description" content="Answers to common questions about Scorify Golf — digital scoring, handicaps, payouts, team play, pricing, and more." />
        <link rel="canonical" href="https://scorifygolf.com/faq" />
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

        {/* Header */}
        <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #ebe9e4' }}>
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Scorify Golf" className="w-8 h-8 object-contain" />
              <span className="font-bold text-base" style={{ letterSpacing: '-0.02em', color: INK }}>Scorify Golf</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/home#pricing" className="text-sm font-medium" style={{ color: '#6b7280' }}>Pricing</Link>
              <Link to="/login"
                className="text-sm font-bold px-4 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}>
                Get started
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">

          {/* Hero */}
          <section className="py-16 text-center px-6" style={{ background: `linear-gradient(150deg, #0b2318 0%, ${GREEN} 55%, #1f5c3e 100%)` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>Support</p>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Playfair Display', serif" }}>
              Frequently Asked Questions
            </h1>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Everything you need to know about running your golf league with Scorify.
            </p>
            <div className="mx-auto mt-5" style={{ width: 48, height: 2, background: GOLD }} />
          </section>

          {/* FAQ sections */}
          <section className="py-16 px-6">
            <div className="max-w-3xl mx-auto space-y-12">
              {FAQS.map(section => (
                <div key={section.category}>
                  <h2 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: GREEN }}>
                    {section.category}
                  </h2>
                  <div className="bg-white rounded-2xl px-6 shadow-sm" style={{ border: '1px solid #ebe9e4' }}>
                    {section.items.map(item => (
                      <FAQItem key={item.q} q={item.q} a={item.a} />
                    ))}
                  </div>
                </div>
              ))}

              {/* Still have questions */}
              <div className="text-center py-8">
                <p className="text-base font-semibold text-gray-900 mb-2">Still have questions?</p>
                <p className="text-sm text-gray-500 mb-6">We're happy to help — reach out and we'll get back to you promptly.</p>
                <a href="mailto:admin@scorifygolf.com"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm text-white transition-opacity hover:opacity-90"
                  style={{ background: GREEN }}>
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  admin@scorifygolf.com
                </a>
              </div>
            </div>
          </section>

        </main>

        <Footer />
      </div>
    </>
  )
}
