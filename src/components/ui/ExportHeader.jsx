import LeagueMark from './LeagueMark'

/**
 * ExportHeader — the one header shared by printable exports.
 *
 *   (logo)  MULLIGAN'S ISLAND GOLF CLUB                          Generated Oct 25, 2026
 *           Wager payout summary  [Final · Settled]              Payouts include stake
 *           Playoffs - Round 1 · The Golf Club of California · Sun, Oct 25, 2026
 *
 * The logo is the event's own league logo (56px by default), left of the text block; with no logo it
 * falls back to the league initials, never a blank. `rightSlot` replaces the right-hand text lines with a custom node
 * (the tee sheet's stat tiles). `compact` is the slim version for continuation pages.
 */
export default function ExportHeader({ leagueName, logoUrl, title, pill, meta, right = [], rightSlot = null, compact = false, logoSize = 56 }) {
  if (compact) {
    return (
      <div className="flex items-center gap-2.5 border-b border-surface-border pb-2">
        <LeagueMark name={leagueName} logoUrl={logoUrl} size={28} />
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{leagueName}</span>
        {title && <span className="text-[12px] text-ink-muted">· {title}</span>}
      </div>
    )
  }
  return (
    <header className="border-b border-surface-border pb-4">
      <div className="flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <LeagueMark name={leagueName} logoUrl={logoUrl} size={logoSize} />
          <div className="min-w-0">
            <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-fairway-700">{leagueName}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-3">
              <h1 className="text-[26px] font-extrabold leading-tight text-ink" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
              {pill && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-status-active-bg px-2.5 py-0.5 text-xs font-bold text-status-active-text">
                  <span className="h-1.5 w-1.5 rounded-full bg-fairway-500" aria-hidden="true" />{pill}
                </span>
              )}
            </div>
            {meta && <p className="mt-0.5 text-[13px] text-ink-muted">{meta}</p>}
          </div>
        </div>
        {rightSlot}
        {!rightSlot && right.length > 0 && (
          <div className="shrink-0 text-right text-[11px] leading-snug text-ink-muted">
            {right.map(line => <div key={line}>{line}</div>)}
          </div>
        )}
      </div>
    </header>
  )
}
