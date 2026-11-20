// Homepage "Built for" section: sends each visitor to the page for what they run.
import { Link } from 'react-router-dom'
import { SOLUTIONS } from '../../lib/solutions'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'
const MUTED = '#6b7280'
const LINE  = '#ebe9e4'

const ICONS = {
  leagues: <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4ZM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4" />,
  tournaments: <path d="M5 21V4M5 4l11 3.5L5 11M19 21H3" />,
  trips: <path d="M3 21h18M5 21V9l7-5 7 5v12M9 21v-6h6v6" />,
}

export default function SolutionRouter() {
  return (
    <section id="built-for" className="py-16 md:py-20" style={{ background: '#fbfaf8' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Built for</p>
          <h2 className="text-3xl md:text-4xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: INK }}>
            Leagues, tournaments, and golf trips
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-5">
          {SOLUTIONS.map(s => (
            <Link key={s.key} to={s.path}
              className="group flex flex-col bg-white rounded-2xl p-6 transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ border: `1px solid ${LINE}` }}>
              <span className="flex items-center justify-center w-11 h-11 rounded-xl mb-4" style={{ background: '#eaf1ec', color: GREEN }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS[s.key]}
                </svg>
              </span>
              <h3 className="font-bold text-lg mb-2" style={{ color: INK }}>{s.title}</h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: MUTED }}>{s.blurb}</p>
              <ul className="space-y-1.5 text-sm mb-5" style={{ color: '#374151' }}>
                {s.points.map(p => (
                  <li key={p} className="flex gap-2">
                    <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                    {p}
                  </li>
                ))}
              </ul>
              <span className="mt-auto text-sm font-semibold" style={{ color: GREEN }}>
                {s.linkText} <span className="inline-block transition-transform group-hover:translate-x-0.5">→</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
