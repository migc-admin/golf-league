/**
 * SideGameSigns — closest-to-pin / long-drive / custom competition signs, four per Letter page in a
 * 2×2 grid with dashed cut lines. Presentational: signs come from buildSignItems (lib/signsView.js).
 */
import LeagueMark from '../ui/LeagueMark'

function Sign({ item, league, eventName, date }) {
  return (
    <div className="flex flex-col rounded border border-dashed border-surface-outline bg-white" style={{ padding: '0.16in 0.18in 0.12in', breakInside: 'avoid' }}>
      <div className="flex items-center gap-2.5">
        <LeagueMark name={league.name} logoUrl={league.logo_url} size={40} />
        <div className="min-w-0">
          <div className="truncate text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{league.name}</div>
          <div className="truncate text-[11px] text-ink-muted">{[eventName, date].filter(Boolean).join(' · ')}</div>
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3 rounded bg-status-active-bg px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-status-active-text">{item.label}</div>
          <div className="truncate pb-1 text-[32px] font-extrabold leading-[1.15] text-ink" style={{ letterSpacing: '-0.02em' }}>{item.big}</div>
        </div>
        <div className="shrink-0 text-right text-[11.5px] font-semibold leading-tight text-status-active-text">{item.scope}</div>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_88px] gap-x-3 text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
        <span>{item.cols[0]}</span><span>{item.cols[1]}</span>
      </div>
      <div className="flex flex-1 flex-col justify-between" style={{ minHeight: '1.55in' }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="grid flex-1 grid-cols-[1fr_88px] gap-x-3">
            <div className="border-b border-surface-highest" /><div className="border-b border-surface-highest" />
          </div>
        ))}
      </div>
      <p className="mt-1.5 text-[10.5px] text-ink-muted">{item.note}</p>
    </div>
  )
}

export function SignsPage({ items, event, pageNum, pageCount, totalSigns, last }) {
  const league = event?.league ?? {}
  const eventName = event?.name ?? (event?.event_number ? `Event #${event.event_number}` : '')
  const date = event?.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
  return (
    <div
      className="flex flex-col bg-white font-sans text-ink"
      style={{ width: '8.5in', height: '11in', boxSizing: 'border-box', padding: '0.4in', overflow: 'hidden', ...(last ? {} : { pageBreakAfter: 'always' }) }}
    >
      <div className="grid flex-1 grid-cols-2 gap-x-[0.22in] gap-y-[0.22in]" style={{ gridAutoRows: '1fr' }}>
        {items.map((item, i) => <Sign key={i} item={item} league={league} eventName={eventName} date={date} />)}
      </div>
      <div className="mt-3 flex items-center justify-between text-[10.5px] text-ink-muted">
        <span>Cut along the dashed lines · {totalSigns} sign{totalSigns === 1 ? '' : 's'}</span>
        <span>Page {pageNum} of {pageCount} · Powered by Scorify Golf</span>
      </div>
    </div>
  )
}
