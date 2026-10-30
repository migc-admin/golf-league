import LeagueMark from '../ui/LeagueMark'

/**
 * Header shared by the three wager pages (bet form, admin board, results): league logo (32px)
 * + league name in small caps, page title, status pill and a meta line. `actions` sits at the right.
 * Pill tones: 'open' green, 'closed' neutral grey.
 */
const PILL = {
  open:   'bg-status-active-bg text-status-active-text',
  closed: 'bg-surface-high text-ink-muted',
}

export default function WagerPageHeader({ leagueName, logoUrl, title, pill, meta, actions }) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <LeagueMark name={leagueName} logoUrl={logoUrl} size={32} />
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{leagueName}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h1 className="text-2xl font-extrabold leading-tight text-ink sm:text-[28px]" style={{ letterSpacing: '-0.02em' }}>{title}</h1>
          {pill && (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${PILL[pill.tone] ?? PILL.closed}`}>
              {pill.tone === 'open' && <span className="h-1.5 w-1.5 rounded-full bg-fairway-500" aria-hidden="true" />}
              {pill.label}
            </span>
          )}
        </div>
        {meta && <p className="mt-1 text-sm text-ink-muted">{meta}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}
