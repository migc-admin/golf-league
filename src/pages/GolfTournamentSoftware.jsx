// Public landing page for "golf tournament software" (/golf-tournament-software).
// Prerendered — see entry-server.jsx. Product facts must match FAQ.jsx,
// src/lib/eventLabels.js, and src/lib/plans.js.
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'
import { PLANS, ONE_TIME } from '../lib/plans'
import {
  SITE, MUTED, BODY, LINE, INK,
  Eyebrow, H2, TextLink, LandingHeader, LandingHero, StageGrid, BulletColumns,
  PlanCard, FaqSection, OtherSolutions, GuidesAndCta, landingJsonLd,
} from '../components/landing/LandingKit'

const PATH = '/golf-tournament-software'
export const PAGE_TITLE = 'Golf Tournament Software — Free to Start | Scorify'
export const PAGE_DESCRIPTION = 'Golf tournament software for charity scrambles, member-guests, and club events: sign-ups, pairings, phone scoring with no app, live leaderboard, payouts.'

const starter = PLANS.find(p => p.name === 'Starter')
const pkg = ONE_TIME.find(o => o.name === 'Tournament')
const pkgPrice = pkg.price.replace('Starting at ', '')
const CONTACT = 'mailto:admin@scorifygolf.com?subject=Tournament%20package'

const STAGES = [
  {
    stage: 'Before the event',
    items: [
      { title: 'An event page players check', body: 'Schedule, format, local rules, directions, and your sponsors on one shareable page, with a countdown to the first tee.' },
      { title: 'Registration', body: 'Players sign up from a link and pay through your own Venmo or PayPal link. You confirm payments in the admin (Club plan).' },
      { title: 'Groups and shotgun starts', body: 'Build groups by handicap, by flight, or at random. Turn on Shotgun Start and assign each group a starting hole.' },
      { title: 'Print-ready event day', body: 'Tee sheet for the starter, cart signs for every group, Closest to the Pin and long drive cards, and scorecards with a QR code.' },
    ],
  },
  {
    stage: 'During the round',
    items: [
      { title: 'Every phone is the scorecard', body: 'Each group scans the QR code on its cart sign and scores in the browser. No app download, no account, no password.' },
      { title: 'A leaderboard everyone can follow', body: 'Gross and net standings update hole by hole. Share the link with players, sponsors, and anyone back at the clubhouse.' },
      { title: 'Works with bad signal', body: 'Scores save on the phone when the course loses coverage and sync once the connection returns.' },
    ],
  },
  {
    stage: 'After the round',
    items: [
      { title: 'Results when the last group finishes', body: 'No scorecard table and no hand entry. Winners are ready for the awards before lunch is served.' },
      { title: 'Prize payouts calculated', body: 'Set amounts for places, flights, skins, Closest to the Pin, and long drive. Scorify works out who won what.' },
      { title: 'Score export', body: 'Download every score as a CSV for your records or your sponsors.' },
    ],
  },
]

const FAQS = [
  {
    q: 'Can Scorify score a scramble?',
    a: 'Yes. Scorify supports scramble, shamble, 2-person and 4-person best ball, stroke play (gross and net), Stableford, Nassau, Match Points, and Ryder Cup team formats.',
  },
  {
    q: 'How much does golf tournament software cost for a single event?',
    a: `Scorify's free Starter plan covers events with up to ${starter.features.find(f => /players/i.test(f))?.replace('Up to ', '') ?? '16 players'}. For a bigger one-day event, the Tournament package starts at ${pkgPrice} one time, with unlimited players and help setting it up.`,
  },
  {
    q: 'Do players need to download an app?',
    a: 'No. Each group opens its scorecard in the phone\'s web browser by scanning a QR code or entering a short group code. There is no app, account, or password.',
  },
  {
    q: 'Can I run a shotgun start?',
    a: 'Yes. Turn on Shotgun Start when you create the event and assign each group a starting hole. The tee sheet and cart signs show each group\'s hole automatically.',
  },
  {
    q: 'Can spectators and sponsors follow the leaderboard?',
    a: 'Yes. Every event has a public leaderboard link that anyone can open on a phone or a TV browser, no login required.',
  },
  {
    q: 'Can I show sponsors?',
    a: 'Yes. Sponsor logos appear on the event page that players use for the schedule, rules, and leaderboard.',
  },
  {
    q: 'What side games can I run?',
    a: 'Gross and net skins, Closest to the Pin and Super CTP, long drive, low putts, and blind partners. Payouts for each are calculated automatically. Side games are included in the Tournament package and the Pro and Club plans.',
  },
]

const GUIDES = [
  { to: '/blog/golf-league-side-games-skins-ctp-payouts', text: 'How to Run Skins, CTP, and Payouts' },
  { to: '/blog/how-to-run-a-fair-skins-game', text: 'How to Run a Fair Skins Game' },
  { to: '/blog/digital-vs-paper-golf-scoring', text: 'Digital vs. Paper Golf Scoring' },
]

export default function GolfTournamentSoftware() {
  const jsonLd = landingJsonLd({
    path: PATH, crumb: 'Golf Tournament Software', description: PAGE_DESCRIPTION,
    offer: { price: '0', description: `Free plan; one-time Tournament package from ${pkgPrice}` },
    faqs: FAQS,
  })

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta property="og:title" content="Golf Tournament Software | Scorify Golf" />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE}${PATH}`} />
        <link rel="canonical" href={`${SITE}${PATH}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>
        <LandingHeader />
        <main className="flex-1">
          <LandingHero
            crumb="Golf Tournament Software"
            eyebrow="Golf tournament software"
            title="Golf tournament software, from sign-up to awards"
            subtitle="Run a charity scramble, member-guest, or club championship without the scorecard table: event page, groups and shotgun starts, scoring from any phone, a live leaderboard, and prize payouts in one place."
            primary={{ to: '/login', text: 'Get started free' }}
            secondary={{ href: '#pricing', text: `Tournament package from ${pkgPrice}` }}
            note="No credit card. No app download for your players."
          />

          <StageGrid
            eyebrow="What it does"
            title="Everything event day needs, in the order you need it"
            intro="Whether it's 16 players or a full shotgun field, the work is the same: get people signed up, grouped, scored, and paid out."
            stages={STAGES}
          />

          {/* Formats */}
          <section className="py-16 md:py-20 bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10">
              <div>
                <Eyebrow>Formats and side games</Eyebrow>
                <H2>Scrambles, best ball, and the side games that sell</H2>
                <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: BODY }}>
                  Outings live on team formats and side games. Pick yours when you set up the event, and Scorify handles
                  team scores, handicap strokes, and every payout.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: BODY }}>
                  Setting up skins for the first time? Read <TextLink to="/blog/how-to-run-a-fair-skins-game">how to run a fair skins game</TextLink>.
                </p>
              </div>
              <BulletColumns columns={[
                { title: 'Formats', items: ['Scramble', 'Shamble', 'Best ball, 2 or 4 person', 'Stroke play, gross and net', 'Stableford', 'Ryder Cup teams'] },
                { title: 'Side games', items: ['Gross and net skins', 'Closest to the Pin', 'Super CTP', 'Long drive', 'Low putts', 'Blind partners'] },
              ]} />
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="py-16 md:py-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <Eyebrow>Pricing</Eyebrow>
                <H2>Pay once for one event, or nothing at all</H2>
                <p className="text-sm md:text-base" style={{ color: MUTED }}>
                  Collect entry fees through your own Venmo or PayPal link. Scorify never takes a cut.
                </p>
              </div>
              <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
                <PlanCard
                  name="Starter" price="$0" sub="Free forever · no credit card"
                  description="Small events and first-timers."
                  features={starter.features.filter(f => !/league|standings/i.test(f))}
                  cta={{ to: '/login', text: 'Get started free' }}
                />
                <PlanCard
                  highlight
                  name={pkg.name} price={`From ${pkgPrice}`} sub={`${pkg.sub.replace('one-time', 'One-time')}`}
                  description={pkg.description}
                  features={pkg.features}
                  cta={{ href: CONTACT, text: 'Plan your tournament' }}
                />
              </div>
              <p className="text-sm text-center mt-6" style={{ color: MUTED }}>
                Running events all season? See <TextLink to="/golf-league-software">golf league software</TextLink> for monthly plans.
              </p>
            </div>
          </section>

          <FaqSection title="Golf tournament software questions" faqs={FAQS} />

          <div className="pt-16" style={{ borderTop: `1px solid ${LINE}` }}>
            <OtherSolutions current="tournaments" />
          </div>

          <GuidesAndCta
            guides={GUIDES}
            ctaTitle="Make your next outing the easy one"
            ctaText={`Start free for up to 16 players, or let us help set up a bigger event from ${pkgPrice}.`}
            cta={{ to: '/login', text: 'Get started free' }}
          />
        </main>
        <Footer />
      </div>
    </>
  )
}
