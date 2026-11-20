// "Standings" step: tonight's winnings roll into the season money list, with
// how many spots each player moved.
import { useMemo } from 'react'
import { demoStandings, formatMoney } from '../../lib/scoringDemo'
import { INK, MUTED, LINE, GREEN, WIN, FlightBadge, Panel } from './shared'

export default function StandingsStep({ scores }) {
  const rows = useMemo(() => demoStandings(scores), [scores])

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(0,320px)] gap-6 items-start">
      <Panel title="Season money list · after event 4" aside={<span className="text-[11px] font-bold" style={{ color: GREEN }}>Updated automatically</span>}>
        <table className="w-full text-sm" aria-live="polite">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide" style={{ color: MUTED }}>
              <th className="text-left font-semibold pl-5 py-2 w-12">Pos</th>
              <th className="text-left font-semibold py-2">Player</th>
              <th className="text-right font-semibold py-2 hidden sm:table-cell">Tonight</th>
              <th className="text-right font-semibold py-2">Season</th>
              <th className="text-right font-semibold pr-5 py-2 w-16">Move</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} style={{ borderTop: `1px solid ${LINE}` }}>
                <td className="pl-5 py-2.5 font-semibold" style={{ color: MUTED }}>{r.pos}</td>
                <td className="py-2.5"><span className="font-semibold" style={{ color: INK }}>{r.name}</span> <FlightBadge flight={r.flight} /></td>
                <td className="text-right py-2.5 hidden sm:table-cell" style={{ color: r.tonight ? WIN : '#cbd5e1' }}>{r.tonight ? `+${formatMoney(r.tonight)}` : '—'}</td>
                <td className="text-right py-2.5 font-black" style={{ color: INK }}>{formatMoney(r.amount)}</td>
                <td className="text-right pr-5 py-2.5 text-xs font-bold" style={{ color: r.moved > 0 ? WIN : r.moved < 0 ? '#b91c1c' : '#9ca3af' }}>
                  {r.moved > 0 ? `▲ ${r.moved}` : r.moved < 0 ? `▼ ${-r.moved}` : '–'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <div className="space-y-4">
        <Panel title="How it works">
          <ul className="px-5 py-4 space-y-2.5 text-sm" style={{ color: INK }}>
            <li>Every event rolls into the standings the moment results are final.</li>
            <li>Run a money list or a points race. You choose which categories count.</li>
            <li>This list leaves skins out, as many leagues do, so it reflects full-round play.</li>
            <li>Players check the standings anytime from a public link.</li>
          </ul>
        </Panel>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.7)' }}>Earlier events are sample data.</p>
      </div>
    </div>
  )
}
