// Homepage hero: league-first headline over a full-bleed course photo, with
// floating cards (live leaderboard + a skin won) that preview what players see.
// Sample names match the "Try it" demo further down the page.
//
// Layout by width:
//   phone  (<768px)   text first, then the photo as a rounded block with the
//                     leaderboard card overlapping its bottom edge
//   tablet (768-1023) photo behind the whole hero, strong white fade on the
//                     left, cards in a row under the text
//   desktop (1024+)   photo behind the whole hero, fade from the left
//                     (.hero-fade in src/index.css), cards floating on the right
import { Link } from 'react-router-dom'
import { MoveRight } from 'lucide-react'

// ─── Hero photo ─────────────────────────────────────────────────────────────
// To swap the photo: add new files public/images/<name>-800.webp, -1400.webp
// and -2000.webp, then change `base` below.
// `focalPoint` is the CSS object-position: "X% Y%". Raise Y to show more of the
// bottom of the photo (fairway), lower it to show more sky.
const HERO_PHOTO = {
  base: '/images/hero-course',
  focalPoint: '50% 92%',
}

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'
const MUTED = '#6b7280'
const BODY  = '#4b5563' // body copy; darker than MUTED so it passes AA over the fade
const LINE  = '#ebe9e4'

const ROWS = [
  { pos: '1',  name: 'Jen Park',    thru: 14, net: '-3' },
  { pos: 'T2', name: 'Tony Russo',  thru: 15, net: '-2' },
  { pos: 'T2', name: 'Dana Cole',   thru: 16, net: '-2' },
]

const PROOF = ['No app download for players', 'Live leaderboard on every phone', 'Skins and payouts calculated for you']

function LeaderboardCard({ className = '' }) {
  return (
    <div className={`rounded-2xl bg-white ${className}`}
      style={{ boxShadow: '0 18px 44px rgba(0,0,0,0.18)', border: `1px solid ${LINE}` }}>
      <div className="flex items-center justify-between px-4 lg:px-5 pt-3 lg:pt-4 pb-2" style={{ borderBottom: `1px solid ${LINE}` }}>
        <p className="text-xs lg:text-sm font-bold" style={{ color: INK }}>Wednesday Night League</p>
        <span className="flex items-center gap-1 text-[10px] lg:text-[11px] font-bold" style={{ color: '#15803d' }}>
          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#15803d' }} /> LIVE
        </span>
      </div>
      <ul className="px-4 lg:px-5 py-1.5 lg:py-2">
        {ROWS.map(r => (
          <li key={r.name} className="flex items-center justify-between py-1.5 lg:py-2 text-sm lg:text-[15px]">
            <span className="flex items-center gap-2 min-w-0">
              <span className="w-6 text-xs font-semibold" style={{ color: MUTED }}>{r.pos}</span>
              <span className="font-semibold truncate" style={{ color: INK }}>{r.name}</span>
            </span>
            <span className="flex items-center gap-3 shrink-0">
              <span className="text-[11px] lg:text-xs" style={{ color: MUTED }}>thru {r.thru}</span>
              <span className="font-black w-6 text-right" style={{ color: '#15803d' }}>{r.net}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="px-4 lg:px-5 pb-2.5 lg:pb-3 text-[10px] lg:text-[11px]" style={{ color: '#9ca3af' }}>Net · Flight A · sample data</p>
    </div>
  )
}

function SkinCard({ className = '' }) {
  return (
    <div className={`items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 lg:px-4 lg:py-3 ${className}`}
      style={{ boxShadow: '0 12px 30px rgba(0,0,0,0.16)', border: `1px solid ${LINE}` }}>
      <span className="flex items-center justify-center w-8 h-8 lg:w-9 lg:h-9 rounded-full text-sm font-black" style={{ background: '#fdf6dd', color: '#8a6d0b' }} aria-hidden="true">$</span>
      <div>
        <p className="text-xs lg:text-sm font-bold leading-tight" style={{ color: INK }}>Skin won · Hole 7</p>
        <p className="text-[11px] lg:text-xs leading-tight" style={{ color: MUTED }}>Tony Russo, net 2 · <span className="font-bold" style={{ color: GREEN }}>$40</span></p>
      </div>
    </div>
  )
}

export default function HeroLeague() {
  const src = n => `${HERO_PHOTO.base}-${n}.webp`

  return (
    <section className="relative w-full overflow-hidden bg-white flex flex-col md:block lg:min-h-[650px]">

      {/* Copy — stays on the page container's left edge */}
      <div className="relative z-10 order-1 w-full max-w-6xl mx-auto px-4 sm:px-6 pt-10 md:pt-14 lg:pt-[60px] pb-10 md:pb-10 lg:pb-16">
        <div className="md:max-w-[440px] lg:max-w-[580px] xl:max-w-[640px]">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>
            Golf league management software
          </p>
          <h1 className="text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[3.3rem] xl:text-[3.6rem] font-bold tracking-tighter" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
            <span className="lg:whitespace-nowrap">Run your golf league.</span><br />
            <span className="lg:whitespace-nowrap" style={{ color: GREEN }}>Skip the scoring table.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-xl" style={{ color: BODY }}>
            Players score from any phone's browser, the leaderboard updates hole by hole, and skins, flights, and season
            standings take care of themselves. Free for one league with up to 16 players.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/login"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: GREEN }}>
              Get started free <MoveRight className="w-4 h-4" />
            </Link>
            <a href="#try-it"
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full text-sm font-bold transition-colors bg-white"
              style={{ border: `1.5px solid ${GREEN}`, color: GREEN }}>
              Try scoring a hole ↓
            </a>
          </div>

          <ul className="mt-8 grid sm:grid-cols-3 gap-x-4 gap-y-2">
            {PROOF.map(p => (
              <li key={p} className="flex items-start gap-2 text-sm" style={{ color: '#374151' }}>
                <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {p}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Photo — rounded block on phones, full-bleed background from tablet up */}
      <div className="order-2 relative mx-4 sm:mx-6 rounded-3xl overflow-hidden aspect-[4/3] md:absolute md:inset-0 md:m-0 md:rounded-none md:aspect-auto">
        <img
          src={src(1400)}
          srcSet={`${src(800)} 800w, ${src(1400)} 1400w, ${src(2000)} 2000w`}
          sizes="(min-width: 768px) 100vw, calc(100vw - 32px)"
          width="2000" height="1500"
          fetchpriority="high"
          alt="" aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover"
          style={{ objectPosition: HERO_PHOTO.focalPoint }}
        />
        <div className="hero-fade hidden md:block absolute inset-0" aria-hidden="true" />
      </div>

      {/* Cards — overlap the photo on phones, a row under the text on tablets,
          floating over the photo on the right on desktop */}
      <div className="order-3 relative z-10 -mt-20 mb-10 px-6 sm:px-10 md:mt-0 md:mb-0 md:px-6 md:pb-12 lg:absolute lg:inset-0 lg:p-0 lg:pointer-events-none">
        <div className="relative max-w-6xl mx-auto md:flex md:items-end md:justify-end md:gap-4 lg:block lg:h-full lg:px-6">
          {/* Leaderboard first in the DOM so screen readers hear it first, as before */}
          <LeaderboardCard className="w-[250px] sm:w-[280px] md:w-[300px] lg:absolute lg:right-10 lg:top-[230px] lg:w-[320px] xl:right-16 xl:top-[222px] xl:w-[380px] lg:pointer-events-auto" />
          <SkinCard className="hidden md:flex md:order-first md:mb-24 lg:mb-0 lg:absolute lg:right-6 lg:top-[186px] xl:top-[176px] lg:z-10 lg:pointer-events-auto" />
        </div>
      </div>
    </section>
  )
}
