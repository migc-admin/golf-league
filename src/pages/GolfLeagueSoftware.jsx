// Public landing page built around the search "golf league software"
// (/golf-league-software). Prerendered for search engines — see entry-server.jsx.
// Product facts here must match FAQ.jsx and src/lib/plans.js.
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'
import { PLANS, ONE_TIME } from '../lib/plans'
import SiteHeader from '../components/ui/SiteHeader'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'
const MUTED = '#6b7280'
const BODY  = '#374151'
const LINE  = '#ebe9e4'
const SITE  = 'https://www.scorifygolf.com'
const PATH  = '/golf-league-software'

export const PAGE_TITLE = 'Golf League Software — Free to Start | Scorify Golf'
export const PAGE_DESCRIPTION = 'Golf league software for weekly, monthly, and season-long leagues: phone scoring with no app, handicaps, side game payouts, and standings. Free plan.'

const pro  = PLANS.find(p => p.name === 'Pro')
const club = PLANS.find(p => p.name === 'Club')

// A league's season, in the order the admin runs it.
const SEASON = [
  {
    stage: 'Before the round',
    items: [
      { title: 'Roster and handicaps', body: 'Import your roster, store each player\'s Handicap Index, and assign flights. Course handicaps are calculated for the tees you play.' },
      { title: 'Groups and tee sheet', body: 'Build groups by handicap, by flight, or at random in one click. Shotgun starts are supported.' },
      { title: 'Print-ready round day', body: 'Tee sheet, cart signs, Closest to the Pin and long drive cards, and scorecards with each group\'s QR code.' },
      { title: 'Online registration', body: 'Share one registration link per event. Players sign up and pay through your own Venmo or PayPal link (Pro and Club plans).' },
    ],
  },
  {
    stage: 'During the round',
    items: [
      { title: 'Scoring from any phone', body: 'Each group scans a QR code or enters a short group code and scores hole by hole in the browser. No app download, no account, no password.' },
      { title: 'Live leaderboard', body: 'Gross and net standings update as scores come in, split by flight. Anyone with the link can follow along.' },
      { title: 'Works with bad signal', body: 'Scores save on the phone when the course loses coverage and sync automatically once the connection returns.' },
    ],
  },
  {
    stage: 'After the round',
    items: [
      { title: 'Automatic payouts', body: 'Set prize amounts for overall net, flights, skins, Closest to the Pin, long drive, and low putts. Scorify works out who won what.' },
      { title: 'Results the same day', body: 'No scoring table and no hand entry. Results are ready when the last group finishes.' },
      { title: 'Score export', body: 'Download every score as a CSV for your own records (Pro and Club).' },
    ],
  },
  {
    stage: 'All season',
    items: [
      { title: 'Season standings', body: 'Run a money list or a points race. You choose which categories count, and a public standings page updates after every event.' },
      { title: 'Team Play', body: 'Season-long team competition: set up teams, pick who counts each event, and track team points across the year (Club plan).' },
      { title: 'Multiple admins', body: 'Share the work with your co-organizers so no one person runs the whole season (Club plan).' },
    ],
  },
]

const COMPARISON = [
  ['Cost', 'Free', `Free for 1 league up to 16 players. Pro is $${pro.price}/month.`],
  ['Score entry', 'Paper cards, typed in by an admin after the round', 'Each group enters scores hole by hole on a phone'],
  ['Results', 'Hours to days after the round', 'Live during the round, final when the last group finishes'],
  ['Net scores', 'Handicap formulas you maintain yourself', 'Course handicaps and net scores calculated automatically'],
  ['Side game payouts', 'Worked out by hand', 'Skins, CTP, long drive, and low putts calculated automatically'],
  ['Season standings', 'A file players have to ask for', 'A public standings page that updates after every event'],
]

const CHECKLIST = [
  'No app download for players. Scoring should work in any phone\'s web browser.',
  'Online registration with payment links, so entry fees are collected before the round.',
  'Live scoring and leaderboards, so results are ready when the round ends.',
  'Automatic side game and payout calculations.',
  'Flights and season-long standings.',
  'Handicaps and net scoring built in.',
  'A free plan or trial, so you can run a real round before you pay.',
]

const FAQS = [
  {
    q: 'What is golf league software?',
    a: 'Golf league software replaces the spreadsheets, paper scorecards, and group texts a league director uses to run a season. It handles registration, groups and tee sheets, scoring, handicaps, side game payouts, and season standings in one place.',
  },
  {
    q: 'Is there free golf league software?',
    a: 'Yes. Scorify Golf\'s Starter plan is free for one league with up to 16 players and includes digital scoring, live leaderboards, season standings, and printable scorecards. No credit card is required. Paid plans add unlimited players, flights, side games, and Team Play.',
  },
  {
    q: 'Do players need to download an app?',
    a: 'No. Players open their group\'s scorecard in a web browser by scanning a QR code, tapping an NFC tag, or opening a link. Each group uses an access code printed on its scorecard, so there is no app, account, or password.',
  },
  {
    q: 'Does it handle handicaps and net scoring?',
    a: 'Yes. Enter each player\'s Handicap Index and Scorify calculates course handicaps and net scores automatically, including hole-by-hole strokes for net skins. Direct GHIN integration is on the roadmap, so for now admins enter or update each index.',
  },
  {
    q: 'What formats and side games are supported?',
    a: 'Stroke play (gross and net), Stableford, Match Points, Low Putts, and Skins, plus season-long Team Play. Side games include gross and net skins, Closest to the Pin, long drive, and low putts.',
  },
  {
    q: 'Can I use it for a one-off tournament or a golf trip?',
    a: `Yes. One-time packages start at ${ONE_TIME[0].price.replace('Starting at ', '')} for a single tournament and ${ONE_TIME[1].price.replace('Starting at ', '')} for a multi-round golf trip, with setup help included.`,
  },
  {
    q: 'How long does setup take?',
    a: 'Most league admins are up and running in under 15 minutes: create the league, add players, and set up the first event.',
  },
]

const GUIDE_LINKS = [
  { to: '/blog/running-a-golf-league-commissioners-handbook', text: 'Running a Golf League: The Commissioner\'s Handbook' },
  { to: '/blog/golf-league-side-games-skins-ctp-payouts', text: 'Golf League Side Games: How to Run Skins, CTP, and Payouts' },
  { to: '/blog/season-long-golf-league-standings', text: 'Season-Long Standings: Money Lists, Team Play, and Playoffs' },
  { to: '/blog/digital-vs-paper-golf-scoring', text: 'Digital vs. Paper Golf Scoring' },
]

function Eyebrow({ children, color = GREEN }) {
  return <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>{children}</p>
}

function H2({ children }) {
  return (
    <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: "'Manrope', sans-serif", color: INK, letterSpacing: '-0.01em' }}>
      {children}
    </h2>
  )
}

export default function GolfLeagueSoftware() {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Scorify Golf',
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Web',
      url: `${SITE}${PATH}`,
      description: PAGE_DESCRIPTION,
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'USD',
        lowPrice: '0',
        highPrice: String(club.price),
        offerCount: String(PLANS.length),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Golf League Software', item: `${SITE}${PATH}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: FAQS.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta property="og:title" content="Golf League Software | Scorify Golf" />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE}${PATH}`} />
        <link rel="canonical" href={`${SITE}${PATH}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

        <SiteHeader />

        <main className="flex-1">

          {/* Hero */}
          <section style={{ background: `linear-gradient(135deg, #0b2318, ${GREEN})` }}>
            <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16 md:pb-20">
              <nav aria-label="Breadcrumb" className="text-xs mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <Link to="/" className="hover:underline">Home</Link>
                <span className="mx-2">/</span>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>Golf League Software</span>
              </nav>
              <Eyebrow color={GOLD}>Golf league software</Eyebrow>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white max-w-3xl" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Golf league software that runs your whole season
              </h1>
              <p className="mt-5 text-base md:text-lg max-w-2xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>
                Registration, tee sheets, scoring from any phone, handicaps, side game payouts, and season standings in one place.
                Free for one league with up to 16 players.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/login" className="text-center px-7 py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90" style={{ background: GOLD, color: '#1a1a1a' }}>
                  Get started free
                </Link>
                <a href="#pricing" className="text-center px-7 py-3 rounded-full font-bold text-sm text-white" style={{ border: '1px solid rgba(255,255,255,0.35)' }}>
                  See pricing
                </a>
              </div>
              <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>No credit card. No app download for your players.</p>
            </div>
          </section>

          {/* Built by a commissioner */}
          <section className="py-16 md:py-20 bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-5 gap-10 items-center">
              <div className="md:col-span-3">
                <Eyebrow>Built by a league commissioner</Eyebrow>
                <H2>From a 90-minute scoring table to results by the next morning</H2>
                <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: BODY }}>
                  Scorify Golf was built by Kevin Vargas, who helps run a 40-player monthly league in San Diego with two flights,
                  seven prize categories every month, a team competition, and playoffs. Before Scorify, tournament day ended with an admin entering
                  paper scorecards by hand for about 90 minutes, and finalizing results and payouts took three to four days.
                </p>
                <p className="text-sm md:text-base leading-relaxed" style={{ color: BODY }}>
                  Now players score on their phones, the leaderboard updates live, and payouts are done the next morning.
                  Read what else that season taught us in{' '}
                  <Link to="/blog/running-a-golf-league-commissioners-handbook" className="font-semibold underline underline-offset-2" style={{ color: GREEN }}>
                    the commissioner's handbook
                  </Link>.
                </p>
              </div>
              <figure className="md:col-span-2 max-w-xs mx-auto">
                <img src="/images/blog/scorify-live-leaderboard.webp" width="600" height="906" loading="lazy"
                  alt="Scorify Golf live leaderboard on a phone showing Flight A net standings with course handicaps and gross scores"
                  className="w-full h-auto rounded-2xl shadow-md" style={{ border: `1px solid ${LINE}` }} />
                <figcaption className="text-xs text-center mt-2" style={{ color: '#9ca3af' }}>Live leaderboard, sample data.</figcaption>
              </figure>
            </div>
          </section>

          {/* Features by stage */}
          <section id="features" className="py-16 md:py-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="max-w-2xl mb-12">
                <Eyebrow>What it does</Eyebrow>
                <H2>Everything a golf league needs, in the order you need it</H2>
                <p className="text-sm md:text-base leading-relaxed" style={{ color: MUTED }}>
                  Weekly, monthly, and season-long leagues all follow the same rhythm. Scorify covers each step.
                </p>
              </div>
              <div className="space-y-12">
                {SEASON.map(group => (
                  <div key={group.stage}>
                    <h3 className="text-lg font-bold mb-4" style={{ color: GREEN }}>{group.stage}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {group.items.map(item => (
                        <div key={item.title} className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${LINE}` }}>
                          <h4 className="font-bold text-sm mb-2" style={{ color: INK }}>{item.title}</h4>
                          <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{item.body}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Formats */}
          <section className="py-16 md:py-20 bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10">
              <div>
                <Eyebrow>Formats and side games</Eyebrow>
                <H2>The formats leagues actually play</H2>
                <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: BODY }}>
                  Scorify is opinionated on purpose. Instead of hundreds of settings, it ships with sensible defaults for the
                  formats a typical league uses, so you can set up an event and go live the same day.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: BODY }}>
                  New to side games? See{' '}
                  <Link to="/blog/how-to-run-a-fair-skins-game" className="font-semibold underline underline-offset-2" style={{ color: GREEN }}>how to run a fair skins game</Link>
                  {' '}and{' '}
                  <Link to="/blog/flights-vs-full-field" className="font-semibold underline underline-offset-2" style={{ color: GREEN }}>whether your league needs flights</Link>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-bold text-sm mb-3" style={{ color: INK }}>Scoring formats</h3>
                  <ul className="space-y-2 text-sm" style={{ color: BODY }}>
                    {['Stroke play, gross and net', 'Stableford', 'Match Points', 'Low Putts', 'Skins', 'Team Play (season-long)'].map(f => (
                      <li key={f} className="flex gap-2"><span style={{ color: GOLD }}>●</span>{f}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-bold text-sm mb-3" style={{ color: INK }}>Side games</h3>
                  <ul className="space-y-2 text-sm" style={{ color: BODY }}>
                    {['Gross and net skins', 'Closest to the Pin', 'Long drive', 'Low putts', 'Front 9 and back 9 net', 'Flight payouts'].map(f => (
                      <li key={f} className="flex gap-2"><span style={{ color: GOLD }}>●</span>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </section>

          {/* vs spreadsheets */}
          <section className="py-16 md:py-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="max-w-2xl mb-8">
                <Eyebrow>Spreadsheets vs. league software</Eyebrow>
                <H2>Still running your league on Excel and paper cards?</H2>
                <p className="text-sm md:text-base leading-relaxed" style={{ color: MUTED }}>
                  Spreadsheets are free and they work. The cost shows up on tournament day, when someone has to turn a stack of
                  scorecards into results and payouts.
                </p>
              </div>
              <div className="overflow-x-auto rounded-2xl bg-white" style={{ border: `1px solid ${LINE}` }}>
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${LINE}` }}>
                      <th className="text-left p-4 font-semibold" style={{ color: MUTED }} scope="col"><span className="sr-only">Task</span></th>
                      <th className="text-left p-4 font-bold" style={{ color: INK }} scope="col">Spreadsheet and paper cards</th>
                      <th className="text-left p-4 font-bold" style={{ color: GREEN }} scope="col">Scorify Golf</th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON.map(([label, a, b], i) => (
                      <tr key={label} style={i < COMPARISON.length - 1 ? { borderBottom: `1px solid ${LINE}` } : undefined}>
                        <th scope="row" className="text-left p-4 font-semibold align-top" style={{ color: INK }}>{label}</th>
                        <td className="p-4 align-top" style={{ color: MUTED }}>{a}</td>
                        <td className="p-4 align-top" style={{ color: BODY }}>{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm mt-4" style={{ color: MUTED }}>
                What the switch looked like for our league:{' '}
                <Link to="/blog/digital-vs-paper-golf-scoring" className="font-semibold underline underline-offset-2" style={{ color: GREEN }}>digital vs. paper golf scoring</Link>.
              </p>
            </div>
          </section>

          {/* Choosing software */}
          <section className="py-16 md:py-20 bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10">
              <div>
                <Eyebrow>Choosing the best golf league software</Eyebrow>
                <H2>What to look for</H2>
                <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: BODY }}>
                  The best golf league software is the one your players can use on the first tee without help. After a season of
                  running our league, these are the things that mattered most.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: BODY }}>
                  Comparing options? Here is{' '}
                  <Link to="/blog/scorify-vs-golf-league-tracker" className="font-semibold underline underline-offset-2" style={{ color: GREEN }}>how Scorify compares to Golf League Tracker</Link>.
                </p>
              </div>
              <ul className="space-y-3">
                {CHECKLIST.map(item => (
                  <li key={item} className="flex gap-3 text-sm leading-relaxed" style={{ color: BODY }}>
                    <svg className="shrink-0 mt-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="py-16 md:py-20">
            <div className="max-w-6xl mx-auto px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <Eyebrow>Pricing</Eyebrow>
                <H2>Free to start. Upgrade when your league grows.</H2>
                <p className="text-sm md:text-base" style={{ color: MUTED }}>
                  Collect dues through your own Venmo or PayPal link. Scorify never takes a cut of your buy-ins.
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-5">
                {PLANS.map(plan => (
                  <div key={plan.name} className="bg-white rounded-2xl p-6 flex flex-col"
                    style={{ border: plan.isPopular ? `2px solid ${GREEN}` : `1px solid ${LINE}` }}>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-lg" style={{ color: INK }}>{plan.name}</h3>
                      {plan.isPopular && <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: GREEN }}>Most popular</span>}
                    </div>
                    <p className="text-sm mb-4" style={{ color: MUTED }}>{plan.description}</p>
                    <p className="mb-1">
                      <span className="text-3xl font-bold" style={{ color: INK }}>${plan.price}</span>
                      <span className="text-sm" style={{ color: MUTED }}>{plan.price === 0 ? ' forever' : ' /month'}</span>
                    </p>
                    <p className="text-xs mb-5" style={{ color: MUTED }}>{plan.price === 0 ? 'No credit card required' : `or $${plan.yearlyPrice}/year`}</p>
                    <ul className="space-y-2 text-sm mb-6" style={{ color: BODY }}>
                      {plan.features.map(f => <li key={f} className="flex gap-2"><span style={{ color: GOLD }}>●</span>{f}</li>)}
                    </ul>
                    <Link to={plan.href} className="mt-auto text-center px-5 py-2.5 rounded-full font-bold text-sm transition-opacity hover:opacity-90"
                      style={plan.isPopular ? { background: GREEN, color: '#fff' } : { border: `1px solid ${GREEN}`, color: GREEN }}>
                      {plan.buttonText}
                    </Link>
                  </div>
                ))}
              </div>
              <p className="text-sm text-center mt-6" style={{ color: MUTED }}>
                Running a single event? {ONE_TIME.map(o => `${o.name} packages: ${o.price.toLowerCase()}`).join('. ')}.{' '}
                <a href="mailto:admin@scorifygolf.com" className="font-semibold underline underline-offset-2" style={{ color: GREEN }}>Contact us</a>.
              </p>
            </div>
          </section>

          {/* FAQ */}
          <section className="py-16 md:py-20 bg-white">
            <div className="max-w-3xl mx-auto px-4 sm:px-6">
              <div className="text-center mb-8">
                <Eyebrow>FAQ</Eyebrow>
                <H2>Golf league software questions</H2>
              </div>
              <div className="divide-y" style={{ borderColor: '#e5e7eb' }}>
                {FAQS.map(({ q, a }) => (
                  <div key={q} className="py-5">
                    <h3 className="font-semibold text-sm mb-2" style={{ color: INK }}>{q}</h3>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{a}</p>
                  </div>
                ))}
              </div>
              <p className="text-sm text-center mt-6">
                <Link to="/faq" className="font-semibold" style={{ color: GREEN }}>See all FAQs →</Link>
              </p>
            </div>
          </section>

          {/* Guides + CTA */}
          <section className="py-16 md:py-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-8 items-stretch">
              <div className="bg-white rounded-2xl p-7" style={{ border: `1px solid ${LINE}` }}>
                <Eyebrow>Guides for league directors</Eyebrow>
                <ul className="space-y-3">
                  {GUIDE_LINKS.map(g => (
                    <li key={g.to}>
                      <Link to={g.to} className="text-sm font-semibold hover:underline" style={{ color: GREEN }}>{g.text} →</Link>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl p-7 flex flex-col justify-center" style={{ background: `linear-gradient(135deg, #0b2318, ${GREEN})` }}>
                <h2 className="text-xl font-bold text-white mb-2">Run your next round on Scorify</h2>
                <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Set up your league in about 15 minutes. Free for up to 16 players, no credit card required.
                </p>
                <Link to="/login" className="self-start px-7 py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90" style={{ background: GOLD, color: '#1a1a1a' }}>
                  Get started free
                </Link>
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  )
}
