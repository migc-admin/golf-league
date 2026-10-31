/**
 * Shared building blocks for the PNG / print exports: the sheet frame, white cards, flight headers,
 * tags and the footer. Built from existing color tokens only. Always rendered inside a fixed-width
 * sheet, so nothing here uses viewport breakpoints.
 */

export const SHEET_W = 1000

export function ExportSheet({ children, width = SHEET_W, className = '' }) {
  return (
    <div className={`bg-white font-sans text-ink ${className}`.trim()} style={{ width, padding: '36px 40px 28px', boxSizing: 'border-box' }}>
      {children}
    </div>
  )
}

export function ExportCard({ title, right, children, className = '', style }) {
  return (
    <section className={`rounded border border-surface-border bg-white ${className}`.trim()} style={{ breakInside: 'avoid', ...style }}>
      {(title || right) && (
        <div className="flex items-baseline justify-between gap-4 px-5 pt-4">
          {title && <h2 className="text-[17px] font-bold text-ink">{title}</h2>}
          {right && <span className="text-[12px] text-ink-muted">{right}</span>}
        </div>
      )}
      <div className="px-5 pb-4 pt-3">{children}</div>
    </section>
  )
}

/** Small grey uppercase column / group heading. */
export function SmallHead({ children, className = '' }) {
  return <div className={`text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-muted ${className}`.trim()}>{children}</div>
}

/** Flight header bar: Flight A light green, any other flight light grey. */
export function FlightHead({ flight, right }) {
  const tone = flight === 'A' ? 'bg-status-active-bg text-status-active-text' : 'bg-surface-dim text-ink'
  return (
    <div className={`flex items-center justify-between rounded-sm px-3 py-1.5 text-[13px] font-bold ${tone}`}>
      <span>{flight ? `Flight ${flight}` : 'All players'}</span>
      {right && <span className="text-[12px] font-medium opacity-80">{right}</span>}
    </div>
  )
}

export function TieTag() {
  return <span className="ml-1.5 rounded-sm bg-surface-high px-1 py-px align-middle text-[9px] font-bold uppercase tracking-wide text-ink-muted">Tie</span>
}

export function FlightTag({ flight }) {
  if (!flight) return null
  const tone = flight === 'A' ? 'bg-status-active-bg text-status-active-text' : 'bg-surface-high text-ink-muted'
  return <span className={`ml-1.5 inline-block rounded-sm px-1.5 py-px align-middle text-[10px] font-bold ${tone}`}>{flight}</span>
}

export function MarginPill({ children }) {
  return <span className="inline-block whitespace-nowrap rounded-sm bg-status-active-bg px-2 py-0.5 text-[11px] font-bold text-status-active-text">{children}</span>
}

export function ExportFooter({ left, right = 'Powered by Scorify Golf' }) {
  return (
    <footer className="mt-5 flex items-center justify-between border-t border-surface-border pt-3 text-[11px] text-ink-muted">
      <span>{left}</span>
      <span>{right}</span>
    </footer>
  )
}
