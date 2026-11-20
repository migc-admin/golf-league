// "Printouts" step: the round-day sheets Scorify generates from the groups —
// tee sheet, a cart sign per group, and the Closest to the Pin sign.
import { DEMO_HOLES, DEMO_PRIZES } from '../../lib/scoringDemo'
import { INK, MUTED, LINE, GREEN } from './shared'

function Paper({ label, children, className = '' }) {
  return (
    <figure className={className}>
      <div className="bg-white rounded-md p-5" style={{ boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>{children}</div>
      <figcaption className="text-xs mt-2 text-center" style={{ color: 'rgba(255,255,255,0.7)' }}>{label}</figcaption>
    </figure>
  )
}

export default function PrintStep({ groups, onNext }) {
  const ctpHole = DEMO_HOLES.find(h => h.number === DEMO_PRIZES.ctp.hole)
  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-6">
        {/* Tee sheet */}
        <Paper label="Tee sheet: for the starter and the pro shop">
          <div className="flex items-end justify-between mb-3 pb-2" style={{ borderBottom: `2px solid ${INK}` }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Tee sheet</p>
              <p className="font-bold" style={{ color: INK }}>Wednesday Night League</p>
            </div>
            <p className="text-xs" style={{ color: MUTED }}>Event 4 · Sample</p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wide text-left" style={{ color: MUTED }}>
                <th className="py-1 font-semibold">Group</th><th className="py-1 font-semibold">Time</th><th className="py-1 font-semibold">Hole</th><th className="py-1 font-semibold">Players</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.number} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td className="py-2 font-bold align-top" style={{ color: INK }}>{g.number}</td>
                  <td className="py-2 align-top whitespace-nowrap pr-2" style={{ color: INK }}>{g.teeTime}</td>
                  <td className="py-2 align-top" style={{ color: INK }}>{g.startHole}</td>
                  <td className="py-2 text-xs leading-relaxed" style={{ color: INK }}>{g.players.map(p => `${p.name} (${p.ch})`).join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Paper>

        {/* CTP sign */}
        <Paper label="Closest to the Pin sign: posted at the tee box">
          <div className="text-center">
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: MUTED }}>Hole {ctpHole.number} · Par {ctpHole.par} · {ctpHole.yards} yds</p>
            <p className="text-2xl font-black mb-4" style={{ color: GREEN, fontFamily: "'Manrope', sans-serif" }}>Closest to the Pin</p>
            <div className="space-y-2.5 text-left">
              {['Name', 'Distance', 'Name', 'Distance'].map((l, i) => (
                <div key={i} className="flex items-end gap-2 text-xs" style={{ color: MUTED }}>
                  <span className="w-14 shrink-0">{l}</span>
                  <span className="flex-1" style={{ borderBottom: `1px solid ${MUTED}` }} />
                </div>
              ))}
            </div>
          </div>
        </Paper>
      </div>

      {/* Cart signs */}
      <div className="grid sm:grid-cols-2 gap-6">
        {groups.map(g => (
          <Paper key={g.number} label={`Cart sign: group ${g.number}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>Wednesday Night League</p>
                <p className="text-3xl font-black leading-tight" style={{ color: INK, fontFamily: "'Manrope', sans-serif" }}>Group {g.number}</p>
                <p className="text-sm font-semibold" style={{ color: GREEN }}>{g.teeTime} · Hole {g.startHole}</p>
              </div>
              {/* Where the real sign prints the group's scorecard QR code */}
              <span className="shrink-0 flex flex-col items-center justify-center w-16 h-16 rounded-md text-[10px] font-bold leading-tight text-center"
                style={{ border: `2px solid ${INK}`, color: INK }}>
                <span className="text-base" aria-hidden="true">▦</span>Scan to<br />score
              </span>
            </div>
            <ul className="mt-3 pt-3 text-sm space-y-1" style={{ borderTop: `1px solid ${LINE}`, color: INK }}>
              {g.players.map(p => <li key={p.id}>{p.name}</li>)}
            </ul>
          </Paper>
        ))}
      </div>

      <button type="button" onClick={onNext} className="text-sm font-bold px-5 py-2.5 rounded-full bg-white" style={{ color: INK }}>
        Next: score a hole →
      </button>
    </div>
  )
}
