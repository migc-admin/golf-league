/**
 * SkinsGridSheet — the "Skins by flight" PNG (1400px wide), one per flight.
 * Presentational: everything comes from skinsGridViews (lib/skinsGridView.js).
 */
import ExportHeader from '../ui/ExportHeader'
import { SmallHead, ExportFooter } from './ExportParts'

export const SKINS_SHEET_W = 1400

const usd0 = n => `$${Math.round(n)}`
const usd2 = n => `$${n.toFixed(2)}`

function Tile({ label, value, good }) {
  return (
    <div className={`min-w-[140px] rounded-sm border border-surface-border px-4 py-2.5 ${good ? 'bg-status-active-bg' : 'bg-white'}`}>
      <div className={`text-[11px] ${good ? 'text-status-active-text' : 'text-ink-muted'}`}>{label}</div>
      <div className={`mt-0.5 whitespace-nowrap text-[20px] font-bold leading-tight tabular-nums ${good ? 'text-status-active-text' : 'text-ink'}`}>{value}</div>
    </div>
  )
}

// Column helpers: a thin divider before Out, hole 10 and Gross; soft grey for Out, In and Net.
const DIV = 'border-l border-surface-border'
const GREY = 'bg-surface-dim'

function Th({ children, className = '', left }) {
  return <th className={`px-1 py-2.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted ${left ? 'text-left' : 'text-center'} ${className}`}>{children}</th>
}

export default function SkinsGridSheet({ view, leagueName, logoUrl }) {
  const { rows, holes } = view
  const front = holes.slice(0, 9)
  const back = holes.slice(9)
  const sub = 'px-1 py-1.5 text-center text-[11px] text-ink-muted tabular-nums'

  const holeCell = (r, h, i) => {
    const net = r.nets[h.hole]
    const won = r.wins.has(h.hole)
    return (
      <td key={h.hole} className={`px-0 py-1.5 text-center text-[13px] tabular-nums ${i === 0 && h.hole === 10 ? DIV : ''}`}>
        {won
          ? <span className="inline-flex h-[26px] min-w-[28px] items-center justify-center rounded-sm bg-fairway-700 px-1 font-bold text-white">{net}</span>
          : (net ?? '')}
      </td>
    )
  }

  return (
    <div className="bg-white font-sans text-ink" style={{ width: SKINS_SHEET_W, padding: '36px 40px 28px', boxSizing: 'border-box' }}>
      <ExportHeader
        leagueName={leagueName ?? ''}
        logoUrl={logoUrl}
        logoSize={64}
        title={view.title}
        pill={view.final ? 'Final' : 'In progress'}
        meta={view.meta}
        rightSlot={
          <div className="flex shrink-0 gap-2.5">
            <Tile label="Skins pool" value={usd0(view.pool)} />
            <Tile label="Per skin" value={view.totalSkins > 0 ? usd2(view.perSkin) : '—'} />
            <Tile label="Skins won" value={view.totalSkins} />
            <Tile label="Top" value={view.top ? `${view.top.name} ×${view.top.count}` : '—'} good />
          </div>
        }
      />

      <section className="mt-4 overflow-hidden rounded border border-surface-border bg-white">
        <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 188 }} /><col style={{ width: 56 }} /><col style={{ width: 66 }} />
            {front.map(h => <col key={h.hole} style={{ width: 38 }} />)}
            <col style={{ width: 50 }} />
            {back.map(h => <col key={h.hole} style={{ width: 38 }} />)}
            <col style={{ width: 50 }} /><col style={{ width: 60 }} /><col style={{ width: 44 }} /><col style={{ width: 54 }} /><col style={{ width: 56 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-surface-border">
              <Th left className="pl-4">Player</Th><Th>Skins</Th><Th>Won</Th>
              {front.map(h => <th key={h.hole} className="px-0 py-2.5 text-center text-[12px] font-bold text-ink">{h.hole}</th>)}
              <Th className={`${DIV} ${GREY}`}>Out</Th>
              {back.map((h, i) => <th key={h.hole} className={`px-0 py-2.5 text-center text-[12px] font-bold text-ink ${i === 0 ? DIV : ''}`}>{h.hole}</th>)}
              <Th className={GREY}>In</Th>
              <Th className={DIV}>Gross</Th><Th>HC</Th><Th className={GREY}>Net</Th><Th>Putts</Th>
            </tr>
            <tr className="border-b border-surface-border">
              <td className="py-1.5 pl-4 text-[11px] text-ink-muted">Handicap</td><td /><td />
              {front.map(h => <td key={h.hole} className={sub}>{h.si}</td>)}
              <td className={`${DIV} ${GREY}`} />
              {back.map((h, i) => <td key={h.hole} className={`${sub} ${i === 0 ? DIV : ''}`}>{h.si}</td>)}
              <td className={GREY} /><td className={DIV} /><td /><td className={GREY} /><td />
            </tr>
            <tr className="border-b border-surface-border">
              <td className="py-1.5 pl-4 text-[11px] text-ink-muted">Par</td><td /><td />
              {front.map(h => <td key={h.hole} className={sub}>{h.par}</td>)}
              <td className={`${DIV} ${GREY} ${sub} font-semibold`}>{view.parOut}</td>
              {back.map((h, i) => <td key={h.hole} className={`${sub} ${i === 0 ? DIV : ''}`}>{h.par}</td>)}
              <td className={`${GREY} ${sub} font-semibold`}>{view.parIn}</td>
              <td className={`${DIV} ${sub}`}>{view.parTotal}</td><td /><td className={GREY} /><td />
            </tr>
            <tr className="border-b border-surface-border">
              <td className="py-1.5 pl-4 text-[11px] font-semibold text-status-upcoming-text">Carryover</td><td /><td />
              {front.map(h => <td key={h.hole} className="px-0 py-1.5 text-center">{h.carry > 0 && <CarryTag n={h.carry} />}</td>)}
              <td className={`${DIV} ${GREY}`} />
              {back.map((h, i) => <td key={h.hole} className={`px-0 py-1.5 text-center ${i === 0 ? DIV : ''}`}>{h.carry > 0 && <CarryTag n={h.carry} />}</td>)}
              <td className={GREY} /><td className={DIV} /><td /><td className={GREY} /><td />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={r.id ?? idx} className={`${idx > 0 ? 'border-t border-surface-border' : ''} ${r.check ? 'bg-red-50 text-red-700' : ''}`}>
                <td className="py-2 pl-4 pr-2 text-[14px] font-bold">
                  <span className="block leading-tight">
                    {r.name}
                    {r.check && <span className="ml-2 rounded-sm border border-red-200 bg-red-50 px-1.5 py-px align-middle text-[9px] whitespace-nowrap font-bold uppercase tracking-wide text-red-700">Check scores</span>}
                  </span>
                </td>
                <td className="text-center text-[14px] font-bold tabular-nums">{r.skins > 0 ? r.skins : ''}</td>
                <td className={`text-center text-[14px] font-bold tabular-nums ${r.check ? '' : 'text-status-active-text'}`}>{r.skins > 0 ? usd0(r.won) : ''}</td>
                {front.map((h, i) => holeCell(r, h, i))}
                <td className={`${DIV} ${r.check ? '' : GREY} text-center text-[13px] font-bold tabular-nums`}>{r.out ?? ''}</td>
                {back.map((h, i) => holeCell(r, h, i))}
                <td className={`${r.check ? '' : GREY} text-center text-[13px] font-bold tabular-nums`}>{r.in ?? ''}</td>
                <td className={`${DIV} text-center text-[13px] tabular-nums ${r.check ? '' : 'text-ink-muted'}`}>{r.gross ?? ''}</td>
                <td className={`text-center text-[13px] tabular-nums ${r.check ? '' : 'text-ink-muted'}`}>{r.hc ?? '—'}</td>
                <td className={`${r.check ? '' : GREY} text-center text-[13px] font-bold tabular-nums`}>{r.net ?? ''}</td>
                <td className={`text-center text-[13px] tabular-nums ${r.check ? '' : 'text-ink-muted'}`}>{r.putts ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="mt-4 space-y-1.5 text-[12px] text-ink-muted">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
          <span className="flex items-center gap-2"><span className="inline-flex h-[22px] min-w-[24px] items-center justify-center rounded-sm bg-fairway-700 px-1 text-[11px] font-bold text-white">3</span>Skin won (net score)</span>
          <span className="flex items-center gap-2"><CarryTag n={2} />Skins carried into this hole</span>
          <span>Hole scores are net (gross minus handicap strokes). Gross, HC and Net are 18-hole totals.</span>
        </div>
        <div>Unresolved carryover after hole 18 goes to the first skin winner of the round.</div>
      </div>

      <ExportFooter left={`${view.final ? 'Final results' : 'Results so far'} · ${view.dateShort}`} />
    </div>
  )
}

function CarryTag({ n }) {
  return <span className="inline-block rounded-sm bg-status-upcoming-bg px-1.5 py-px text-[10px] font-bold text-status-upcoming-text">+{n}</span>
}
