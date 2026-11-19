// Pricing plans shown on the homepage pricing section and the /golf-league-software
// page. Edit prices here only, so every page stays in sync.

export const PLANS = [
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

export const ONE_TIME = [
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
