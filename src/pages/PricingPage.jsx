// Public pricing page (/pricing). Prerendered — see entry-server.jsx.
// Plans come from src/lib/plans.js via PricingSection, so this page and the
// homepage always match. FAQ facts must match FAQ.jsx.
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'
import PricingSection from '../components/ui/PricingSection'
import ComparePlans from '../components/ui/ComparePlans'
import { PLANS, ONE_TIME } from '../lib/plans'
import {
  SITE, INK, LandingHeader, LandingHero, FaqSection, OtherSolutions, landingJsonLd, TextLink, MUTED,
} from '../components/landing/LandingKit'

const PATH = '/pricing'
export const PAGE_TITLE = 'Pricing: Golf League Software, Free to Start | Scorify'
export const PAGE_DESCRIPTION = 'Scorify Golf pricing: free for one league up to 16 players, Pro and Club monthly or yearly plans, and one-time packages for tournaments and golf trips.'

const plan = name => PLANS.find(p => p.name === name)
const pkg  = name => ONE_TIME.find(o => o.name === name)
const pro = plan('Pro'), club = plan('Club')
const saving = p => p.price * 12 - p.yearlyPrice

const KEY_FACTS = [
  ['Starter', 'Free forever'],
  ['Pro', `$${pro.price}/mo`],
  ['Club', `$${club.price}/mo`],
  ['One event', pkg('Tournament').price.replace('Starting at ', 'From ')],
  ['Fees on entry money', '0%'],
  ['Change plans', 'Anytime'],
]

const FAQS = [
  {
    q: 'Is there a free plan?',
    a: `Yes. The Starter plan is free with no credit card: ${plan('Starter').features.join(', ').toLowerCase()}.`,
  },
  {
    q: 'What is the difference between Pro and Club?',
    a: 'Pro adds unlimited players, up to 2 leagues, flights, skins and side games, online player registration, and score export. Club adds everything in Pro plus unlimited leagues, multiple admins, Team Play scoring, custom branding, and unlimited golf trips.',
  },
  {
    q: 'How much do I save by paying yearly?',
    a: `Pro is $${pro.price}/month or $${pro.yearlyPrice}/year, which saves $${saving(pro)}. Club is $${club.price}/month or $${club.yearlyPrice}/year, which saves $${saving(club)}.`,
  },
  {
    q: 'Can I try a paid plan before I pay?',
    a: 'Yes. Pro and Club both start with a 21-day free trial. Cancel before it ends and you are not charged.',
  },
  {
    q: 'I only need it for one event. Do I need a subscription?',
    a: `No. The Tournament package starts at ${pkg('Tournament').price.replace('Starting at ', '')} and the Golf Trip package starts at ${pkg('Golf Trip').price.replace('Starting at ', '')}, both one-time with setup help. Email admin@scorifygolf.com to get started.`,
  },
  {
    q: 'Does Scorify take a cut of entry fees or dues?',
    a: 'No. Players pay through your own Venmo or PayPal link, so every dollar goes straight to you.',
  },
  {
    q: 'What if Scorify isn\'t a fit after I pay?',
    a: 'Pro and Club start with a 21-day free trial, so you can run real rounds before you pay. You can cancel anytime; your plan stays active through the end of the period you paid for. If you are charged by mistake, ask within 24 hours for a full refund. On a yearly plan, cancel within the first 3 months (not counting the trial) and get 50% of the yearly price back. Monthly charges are not refunded once a billing period has started. If Scorify does not work as documented, you may get a refund or account credit regardless. The refund policy has the full terms.',
  },
  {
    q: 'Can I switch plans later?',
    a: 'Yes. You can upgrade or downgrade at any time from your account settings.',
  },
]

export default function PricingPage() {
  const jsonLd = landingJsonLd({
    path: PATH, crumb: 'Pricing', description: PAGE_DESCRIPTION,
    offer: { price: '0', description: 'Free Starter plan; paid plans and one-time packages available' },
    faqs: FAQS,
  })

  return (
    <>
      <Helmet>
        <title>{PAGE_TITLE}</title>
        <meta name="description" content={PAGE_DESCRIPTION} />
        <meta property="og:title" content="Pricing | Scorify Golf" />
        <meta property="og:description" content={PAGE_DESCRIPTION} />
        <meta property="og:url" content={`${SITE}${PATH}`} />
        <link rel="canonical" href={`${SITE}${PATH}`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>
        <LandingHeader />
        <main className="flex-1">
          <LandingHero
            crumb="Pricing"
            eyebrow="Pricing"
            title="Golf league software pricing"
            subtitle="Free for one league with up to 16 players. Upgrade when your league grows, or pay once for a single tournament or golf trip."
            primary={{ to: '/login', text: 'Get started free' }}
            secondary={{ href: '#compare', text: 'Compare plans' }}
            note="No credit card for the free plan. Scorify never takes a cut of your entry fees."
          />

          {/* Key facts */}
          <section className="bg-white" style={{ borderBottom: '1px solid #ebe9e4' }}>
            <dl className="max-w-5xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-2 md:grid-cols-6 gap-x-6 gap-y-4">
              {KEY_FACTS.map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>{k}</dt>
                  <dd className="text-sm font-bold mt-1" style={{ color: INK }}>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section id="plans" className="py-16 md:py-20 bg-white">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <PricingSection eyebrow={false} />
              <p className="text-base text-center mt-10 max-w-2xl mx-auto" style={{ color: INK }}>
                ${pro.yearlyPrice}/yr replaces your spreadsheet, your skins math, your printable tee sheets, and your standings page — one tool instead of the stack, with no per-player fees and 0% on entry money.
              </p>
              <p className="text-sm text-center mt-6" style={{ color: MUTED }}>
                Not sure which fits? See <TextLink to="/golf-league-software">leagues</TextLink>,{' '}
                <TextLink to="/golf-tournament-software">tournaments</TextLink>, or{' '}
                <TextLink to="/golf-trip-app">golf trips</TextLink>. Refunds are covered by our{' '}
                <TextLink to="/refund-policy">refund policy</TextLink>.
              </p>
            </div>
          </section>

          <section id="compare" className="py-16 md:py-20">
            <div className="max-w-5xl mx-auto px-4 sm:px-6">
              <div className="text-center max-w-2xl mx-auto mb-8">
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#1B4332' }}>Compare plans</p>
                <h2 className="text-2xl md:text-3xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>Every feature, side by side</h2>
                <p className="mt-3 text-sm md:text-base" style={{ color: MUTED }}>Start on Starter and upgrade when you need more. You can switch plans anytime.</p>
              </div>
              <ComparePlans />
            </div>
          </section>

          <FaqSection title="Pricing questions" faqs={FAQS} />

          <div className="py-16">
            <OtherSolutions current="none" />
          </div>
        </main>
        <Footer />
      </div>
    </>
  )
}
