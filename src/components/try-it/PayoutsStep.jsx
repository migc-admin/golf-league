// "Payouts" step: the full prize sheet for the round — net places by flight,
// skins, Closest to the Pin, and long drive — calculated from the scores.
import { useMemo } from 'react'
import { DEMO_ENTRY_FEE, DEMO_ROSTER, DEMO_PRIZES, DEMO_SKINS_POT, demoPayouts, formatMoney } from '../../lib/scoringDemo'
import { INK, MUTED, LINE, GREEN, FlightBadge, Panel } from './shared'

const name = id => DEMO_ROSTER.find(p => p.id === id).name

export default function PayoutsStep({ scores, onNext }) {
  const { rows, paid, pot, skinsCarry } = useMemo(() => demoPayouts(scores), [scores])
  const cell = n => (n ? <span style={{ color: INK }}>{formatMoney(n)}</span> : <span style={{ color: '#cbd5e1' }}>—</span>)

  return (
    <div className="grid lg:grid-cols-[1fr_minmax(0,320px)] gap-6 items-start">
      <Panel title="Payout sheet · Wednesday Night League" aside={<span className="text-[11px] font-bold" style={{ color: GREEN }}>Calculated automatically</span>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[520px]">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide" style={{ color: MUTED }}>
                <th className="text-left font-semibold pl-5 py-2">Player</th>
                <th className="text-right font-semibold py-2">Net</th>
                <th className="text-right font-semibold py-2">Skins</th>
                <th className="text-right font-semibold py-2">CTP</th>
                <th className="text-right font-semibold py-2">Long drive</th>
                <th className="text-right font-semibold pr-5 py-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td className="pl-5 py-2.5"><span className="font-semibold" style={{ color: INK }}>{r.name}</span> <FlightBadge flight={r.flight} /></td>
                  <td className="text-right py-2.5">{cell(r.net)}</td>
                  <td className="text-right py-2.5">{cell(r.skins)}</td>
                  <td className="text-right py-2.5">{cell(r.ctp)}</td>
                  <td className="text-right py-2.5">{cell(r.longDrive)}</td>
                  <td className="text-right pr-5 py-2.5 font-black" style={{ color: r.total ? GREEN : '#cbd5e1' }}>{r.total ? formatMoney(r.total) : '—'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: `2px solid ${INK}` }}>
                <td className="pl-5 py-3 font-bold" style={{ color: INK }} colSpan={5}>Paid out</td>
                <td className="text-right pr-5 py-3 font-black" style={{ color: INK }}>{formatMoney(paid)} of {formatMoney(pot)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Panel>

      <div className="space-y-4">
        <Panel title="How the pot was split">
          <ul className="px-5 py-4 space-y-2 text-sm" style={{ color: INK }}>
            <li className="flex justify-between"><span>Entry · {DEMO_ROSTER.length} players × {formatMoney(DEMO_ENTRY_FEE)}</span><span className="font-bold">{formatMoney(pot)}</span></li>
            <li className="flex justify-between" style={{ color: MUTED }}><span>Net, Flight A (1st, 2nd)</span><span>{DEMO_PRIZES.net.A.map(formatMoney).join(' · ')}</span></li>
            <li className="flex justify-between" style={{ color: MUTED }}><span>Net, Flight B (1st, 2nd)</span><span>{DEMO_PRIZES.net.B.map(formatMoney).join(' · ')}</span></li>
            <li className="flex justify-between" style={{ color: MUTED }}><span>Net skins</span><span>{formatMoney(DEMO_SKINS_POT)}</span></li>
            <li className="flex justify-between" style={{ color: MUTED }}><span>CTP, hole {DEMO_PRIZES.ctp.hole}</span><span>{formatMoney(DEMO_PRIZES.ctp.amount)}</span></li>
            <li className="flex justify-between" style={{ color: MUTED }}><span>Long drive, hole {DEMO_PRIZES.longDrive.hole}</span><span>{formatMoney(DEMO_PRIZES.longDrive.amount)}</span></li>
          </ul>
        </Panel>
        <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)' }}>
          Tied places split their prize money. {name(DEMO_PRIZES.ctp.playerId)} won Closest to the Pin at {DEMO_PRIZES.ctp.distance} and {name(DEMO_PRIZES.longDrive.playerId)} won long drive (entered by the admin, sample data).
          {skinsCarry ? ` ${skinsCarry} skin${skinsCarry > 1 ? 's were' : ' was'} still tied after the last hole, so that money would carry over in a full round.` : ''}
        </p>
        <button type="button" onClick={onNext} className="text-sm font-bold px-5 py-2.5 rounded-full bg-white" style={{ color: INK }}>
          Next: season standings →
        </button>
      </div>
    </div>
  )
}
