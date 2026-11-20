// Public landing page for "golf trip app" (/golf-trip-app).
// Prerendered — see entry-server.jsx. Facts must match the Trips feature
// (src/pages/trip, src/lib/tripCosts.js) and the Golf Trip package in src/lib/plans.js.
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'
import { ONE_TIME } from '../lib/plans'
import {
  SITE, MUTED, BODY, LINE, INK,
  Eyebrow, H2, TextLink, LandingHeader, LandingHero, StageGrid, BulletColumns,
  PlanCard, FaqSection, OtherSolutions, GuidesAndCta, landingJsonLd,
} from '../components/landing/LandingKit'

const PATH = '/golf-trip-app'
export const PAGE_TITLE = 'Golf Trip App: Scoring, Standings & Itinerary | Scorify'
export const PAGE_DESCRIPTION = 'A golf trip app for buddies trips: one page for the itinerary, lodging, and rooms, plus phone scoring, skins, and a standings race across every round.'

const pkg = ONE_TIME.find(o => o.name === 'Golf Trip')
const pkgPrice = pkg.price.replace('Starting at ', '')
const roundsLimit = pkg.features.find(f => /rounds/i.test(f)) ?? 'Up to 7 rounds / courses'
const CONTACT = 'mailto:admin@scorifygolf.com?subject=Golf%20trip'

const STAGES = [
  {
    stage: 'Before you go',
    items: [
      { title: 'One trip page', body: 'Day-by-day itinerary, tee times, where you\'re staying, the nearest airports, and who\'s going, with a countdown to the trip.' },
      { title: 'Sign-ups with costs', body: 'Everyone signs up from one link, picks their rounds, and sees their total. Shared costs like the rental split by your planned headcount, so prices don\'t move as people join.' },
      { title: 'Guests and non-golfers', body: 'Bring a partner who isn\'t playing, or add a guest priced like everyone else. Custom yes/no questions can carry their own cost.' },
      { title: 'Rooms', body: 'Drag and drop who\'s rooming with whom, and name the rooms if you like.' },
    ],
  },
  {
    stage: 'Every round',
    items: [
      { title: 'Scoring from any phone', body: 'Each group scores in the browser with a QR code or group code. No app for anyone to download on the first tee.' },
      { title: 'Live leaderboard', body: 'Gross and net standings update hole by hole, so the group in front knows exactly what\'s happening behind them.' },
      { title: 'Skins and side games', body: 'Net skins every round, plus Closest to the Pin, long drive, low putts, and blind partners, with payouts calculated for you.' },
    ],
  },
  {
    stage: 'All trip long',
    items: [
      { title: 'Trip standings', body: 'A running standings race across every round, so the trip champion is settled by the numbers, not the loudest voice at dinner.' },
      { title: 'Team formats', body: 'Split the group for a Ryder Cup weekend, or play best ball, scramble, Nassau, or Stableford round by round.' },
      { title: 'Different course every day', body: `Each round can be at its own course with its own pars and handicaps. ${roundsLimit.replace(' / ', ' or ')} per trip.` },
    ],
  },
]

const FAQS = [
  {
    q: 'What is the best app for a buddies golf trip?',
    a: 'Look for one that handles both the trip and the golf: an itinerary everyone can see, sign-ups with costs split for you, scoring with no app download, skins, and standings across every round. Scorify does all of that on one trip page.',
  },
  {
    q: 'Can Scorify run a Ryder Cup style golf trip?',
    a: 'Yes. Ryder Cup is a built-in format, along with best ball, scramble, Nassau, Stableford, and stroke play, and trip standings roll up across every round.',
  },
  {
    q: 'Do players need to download an app?',
    a: 'No. Every round is scored in the phone\'s web browser from a QR code or a short group code, with no account or password.',
  },
  {
    q: 'How are shared costs split?',
    a: 'Shared items like a rental house are divided by the planned headcount you set, so each person\'s price stays the same as people sign up. If you\'re in a rental, the sign-up form asks who\'s staying there and only charges them a share.',
  },
  {
    q: 'Can non-golfers come on the trip?',
    a: 'Yes. People can sign up for the trip without playing, and you can add guests. Round rosters stay separate, so adding someone to the trip never changes a round that\'s already being scored.',
  },
  {
    q: 'How much does it cost?',
    a: `The Golf Trip package starts at ${pkgPrice} one time and includes setup help: send us your itinerary, players, and courses. It covers ${roundsLimit.toLowerCase().replace(' / ', ' or ')} and unlimited players, and trip data stays available for 90 days.`,
  },
]

const GUIDES = [
  { to: '/blog/golf-league-side-games-skins-ctp-payouts', text: 'How to Run Skins, CTP, and Payouts' },
  { to: '/blog/how-to-run-a-fair-skins-game', text: 'How to Run a Fair Skins Game' },
  { to: '/blog/season-long-golf-league-standings', text: 'Money Lists, Team Play, and Playoffs' },
]

export default function GolfTripApp() {
  const jsonLd = landingJsonLd({
    path: PATH, crumb: 'Golf Trip App', description: PAGE_DESCRIPTION,
    offer: { price: pkgPrice.replace('$', ''), description: `Golf Trip package, one time, from ${pkgPrice}` },
    faqs: FAQS,
  })

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta property="og:title" content="Golf Trip App | Scorify Golf" />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE}${PATH}`} />
        <link rel="canonical" href={`${SITE}${PATH}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>
        <LandingHeader />
        <main className="flex-1">
          <LandingHero
            crumb="Golf Trip App"
            eyebrow="Golf trip app"
            title="The golf trip app that keeps score all week"
            subtitle="One trip page with the itinerary, lodging, rooms, and who's going. Sign-ups with costs split for you. Then phone scoring every round, skins, and a standings race that crowns a trip champion."
            primary={{ href: CONTACT, text: 'Plan your trip with us' }}
            secondary={{ href: '#pricing', text: `From ${pkgPrice}, one time` }}
            note="Nobody downloads an app. Works on every phone in the group."
          />

          <StageGrid
            eyebrow="What it does"
            title="From the group chat to the trip champion"
            intro="The planning and the golf live in the same place, so nobody is digging through texts for tee times or doing skins math at the bar."
            stages={STAGES}
          />

          {/* Formats */}
          <section className="py-16 md:py-20 bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10">
              <div>
                <Eyebrow>Formats and games</Eyebrow>
                <H2>Ryder Cup weekends, skins every round</H2>
                <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: BODY }}>
                  Pick a format for each round. Handicap strokes, team scores, and payouts are calculated for you, and every
                  round feeds the trip standings.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: BODY }}>
                  New to skins carryovers? See <TextLink to="/blog/how-to-run-a-fair-skins-game">how to run a fair skins game</TextLink>.
                </p>
              </div>
              <BulletColumns columns={[
                { title: 'Formats', items: ['Ryder Cup teams', 'Best ball, 2 or 4 person', 'Scramble and shamble', 'Nassau', 'Stableford', 'Stroke play, gross and net'] },
                { title: 'Games', items: ['Net skins every round', 'Closest to the Pin', 'Long drive', 'Low putts', 'Blind partners', 'Trip standings'] },
              ]} />
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="py-16 md:py-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-10 items-center">
              <div>
                <Eyebrow>Pricing</Eyebrow>
                <H2>One price for the whole trip</H2>
                <p className="text-sm md:text-base leading-relaxed mb-4" style={{ color: BODY }}>
                  {pkg.description}
                </p>
                <p className="text-sm leading-relaxed" style={{ color: MUTED }}>
                  Collect money through your own Venmo or PayPal. Scorify never takes a cut. Running the same group every
                  week at home? See <TextLink to="/golf-league-software">golf league software</TextLink>.
                </p>
              </div>
              <PlanCard
                highlight
                name={pkg.name} price={`From ${pkgPrice}`} sub={pkg.sub.replace('one-time', 'One-time')}
                description="Everything for one trip, set up with you."
                features={pkg.features}
                cta={{ href: CONTACT, text: 'Plan your trip with us' }}
              />
            </div>
          </section>

          <FaqSection title="Golf trip app questions" faqs={FAQS} />

          <div className="pt-16" style={{ borderTop: `1px solid ${LINE}` }}>
            <OtherSolutions current="trips" />
          </div>

          <GuidesAndCta
            guides={GUIDES}
            ctaTitle="Planning a trip this year?"
            ctaText="Send us the dates, courses, and who's coming. We'll set up the trip page and every round with you."
            cta={{ href: CONTACT, text: 'Plan your trip with us' }}
          />
        </main>
        <Footer />
      </div>
    </>
  )
}
