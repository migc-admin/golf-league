// Homepage hero: league-first headline, a real course photo, and floating
// cards (live leaderboard + a skin won) that preview what players see.
// Sample names match the "Try it" demo further down the page.
import { Link } from 'react-router-dom'
import { MoveRight } from 'lucide-react'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'
const MUTED = '#6b7280'
const LINE  = '#ebe9e4'

const ROWS = [
  { pos: '1',  name: 'Jen Park',    thru: 14, net: '-3' },
  { pos: 'T2', name: 'Tony Russo',  thru: 15, net: '-2' },
  { pos: 'T2', name: 'Dana Cole',   thru: 16, net: '-2' },
]

const PROOF = ['No app download for players', 'Live leaderboard on every phone', 'Skins and payouts calculated for you']

export default function HeroLeague() {
  return (
    <section className="w-full bg-white overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 pb-16 lg:pt-20 lg:pb-24 grid lg:grid-cols-[1.25fr_1fr] gap-12 lg:gap-12 items-center">

        {/* Copy */}
        <div>
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest mb-4" style={{ color: GOLD }}>
            Golf league management software
          </p>
          <h1 className="text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-[3.3rem] xl:text-[3.6rem] font-bold tracking-tighter" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
            <span className="lg:whitespace-nowrap">Run your golf league.</span><br />
            <span className="lg:whitespace-nowrap" style={{ color: GREEN }}>Skip the scoring table.</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed max-w-xl" style={{ color: MUTED }}>
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
              className="inline-flex items-center justify-center gap-2 h-12 px-8 rounded-full text-sm font-bold transition-colors"
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

        {/* Photo + floating cards */}
        <div className="relative pb-10 sm:pb-6 lg:pb-0">
          <img
            src="/images/hero-course-1400.webp"
            srcSet="/images/hero-course-800.webp 800w, /images/hero-course-1400.webp 1400w"
            sizes="(min-width: 1024px) 560px, 100vw"
            width="1400" height="1050"
            fetchpriority="high"
            alt="Fairway on a sunny San Diego golf course where a weekly league plays"
            className="w-full h-auto rounded-3xl object-cover aspect-[4/3]"
          />

          {/* Live leaderboard card */}
          <div className="absolute left-3 sm:-left-6 bottom-0 sm:bottom-6 w-[230px] sm:w-[260px] rounded-2xl bg-white"
            style={{ boxShadow: '0 18px 44px rgba(0,0,0,0.18)', border: `1px solid ${LINE}` }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2" style={{ borderBottom: `1px solid ${LINE}` }}>
              <p className="text-xs font-bold" style={{ color: INK }}>Wednesday Night League</p>
              <span className="flex items-center gap-1 text-[10px] font-bold" style={{ color: '#15803d' }}>
                <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#15803d' }} /> LIVE
              </span>
            </div>
            <ul className="px-4 py-1.5">
              {ROWS.map(r => (
                <li key={r.name} className="flex items-center justify-between py-1.5 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="w-6 text-xs font-semibold" style={{ color: MUTED }}>{r.pos}</span>
                    <span className="font-semibold truncate" style={{ color: INK }}>{r.name}</span>
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px]" style={{ color: MUTED }}>thru {r.thru}</span>
                    <span className="font-black w-6 text-right" style={{ color: '#15803d' }}>{r.net}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="px-4 pb-2.5 text-[10px]" style={{ color: '#9ca3af' }}>Net · Flight A · sample data</p>
          </div>

          {/* Skin won chip */}
          <div className="absolute right-3 sm:-right-4 top-3 sm:top-8 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5"
            style={{ boxShadow: '0 12px 30px rgba(0,0,0,0.16)', border: `1px solid ${LINE}` }}>
            <span className="flex items-center justify-center w-8 h-8 rounded-full text-sm font-black" style={{ background: '#fdf6dd', color: '#8a6d0b' }} aria-hidden="true">$</span>
            <div>
              <p className="text-xs font-bold leading-tight" style={{ color: INK }}>Skin won · Hole 7</p>
              <p className="text-[11px] leading-tight" style={{ color: MUTED }}>Tony Russo, net 2 · <span className="font-bold" style={{ color: GREEN }}>$40</span></p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
