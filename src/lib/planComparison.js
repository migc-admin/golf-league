// Content for the pricing tier cards and the "Compare plans" table.
// Limits and feature gates are read from src/lib/features.js (what the app
// actually enforces) and prices from src/lib/plans.js, so marketing can't drift
// from the product. If you gate a new feature in features.js, add a row here —
// planComparison.test.js fails until you do.
import { TIER_LIMITS, hasFeature } from './features'
import { PLANS } from './plans'

export const TIERS = ['free', 'pro', 'club']
export const TIER_PLAN = { free: 'Starter', pro: 'Pro', club: 'Club' }

const fmt = n => (n === Infinity ? 'Unlimited' : String(n))
const lim = (tier, key) => TIER_LIMITS[tier][key]
const plan = tier => PLANS.find(p => p.name === TIER_PLAN[tier])

/** Detailed tier cards, in the order shown. */
export const PLAN_DETAILS = [
  {
    tier: 'free',
    tagline: 'Everything to run a small league, free.',
    heading: 'Includes',
    items: [
      { title: `${fmt(lim('free', 'leagues'))} league, up to ${fmt(lim('free', 'players'))} players`, body: 'Plenty for a weekly group of three or four foursomes.' },
      { title: 'Scoring from any phone', body: 'QR code or group code. No app, no login, and it works when the signal drops.' },
      { title: 'Live leaderboards', body: 'Hole-by-hole standings anyone can follow from a link.' },
      { title: 'Season standings', body: 'A money list or points race, updated after every event.' },
      { title: 'Groups and printouts', body: 'Auto-assign groups, then print tee sheets, cart signs, and scorecards.' },
    ],
  },
  {
    tier: 'pro',
    tagline: 'For established weekly leagues.',
    heading: 'Everything in Starter, plus',
    items: [
      { title: `${fmt(lim('pro', 'players'))} players, up to ${fmt(lim('pro', 'leagues'))} leagues`, body: 'Grow the roster without hitting a cap.' },
      { title: 'Flights', body: 'Split A and B by handicap, each with its own leaderboard and payouts.' },
      { title: 'Skins and side games', body: 'Gross and net skins, Closest to the Pin, long drive, and low putts, paid out automatically.' },
      { title: 'Online registration', body: 'Sign-up links with Venmo or PayPal payment, confirmed in the admin.' },
      { title: 'Score export', body: 'Download every score as a CSV for your records.' },
      { title: 'Priority support', body: 'Your questions go to the front of the line.' },
    ],
  },
  {
    tier: 'club',
    tagline: 'For clubs and multi-league organizations.',
    heading: 'Everything in Pro, plus',
    items: [
      { title: `${fmt(lim('club', 'leagues'))} leagues, ${fmt(lim('club', 'admins'))} admins`, body: 'Share the work with your co-organizers.' },
      { title: 'Team Play', body: 'Season-long team competition with points across every event.' },
      { title: 'Custom branding', body: 'Your league\'s logo and colors.' },
      { title: `${fmt(lim('club', 'trips'))} golf trips`, body: 'Plan and score multi-round trips, each with its own page, sign-ups, and standings.' },
      { title: 'Dedicated onboarding', body: 'We help you set up your league.' },
    ],
  },
].map(d => ({ ...d, plan: plan(d.tier) }))

const gate = key => TIERS.map(t => hasFeature(t, key))
const all = () => TIERS.map(() => true)
const limitRow = (label, key) => ({ label, values: TIERS.map(t => (lim(t, key) ? fmt(lim(t, key)) : false)) })

/** Rows for the comparison table. `values` holds true/false (✓/—) or text. */
export const COMPARE_SECTIONS = [
  {
    title: 'Your league',
    rows: [
      limitRow('Leagues', 'leagues'),
      limitRow('Players per league', 'players'),
      limitRow('Admins', 'admins'),
      { label: 'Season standings (money list or points)', values: all() },
      limitRow('Golf trips', 'trips'),
    ],
  },
  {
    title: 'Round day',
    rows: [
      { label: 'Scoring from any phone, no app or login', values: all() },
      { label: 'Live leaderboards', values: all() },
      { label: 'Works offline when the signal drops', values: all() },
      { label: 'Groups, tee sheets, cart signs, and scorecards', values: all() },
      { label: 'Flights (A and B)', values: gate('flights'), feature: 'flights' },
      { label: 'Skins', values: gate('skins'), feature: 'skins' },
      { label: 'Side games and payouts (CTP, long drive, low putts)', values: gate('side_games'), feature: 'side_games' },
      { label: 'Team Play', values: gate('tgl'), feature: 'tgl' },
    ],
  },
  {
    title: 'Running the league',
    rows: [
      { label: 'Online registration with payment links', values: gate('registration'), feature: 'registration' },
      { label: 'Multiple admins', values: gate('multiple_admins'), feature: 'multiple_admins' },
      { label: 'Score export (CSV)', values: gate('csv_export'), feature: 'csv_export' },
      { label: 'Custom branding', values: gate('custom_branding'), feature: 'custom_branding' },
    ],
  },
  {
    title: 'Support',
    rows: [
      { label: 'Priority support', values: TIERS.map(t => t !== 'free') },
      { label: 'Dedicated onboarding', values: TIERS.map(t => t === 'club') },
    ],
  },
]
