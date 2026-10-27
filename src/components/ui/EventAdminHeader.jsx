/**
 * EventAdminHeader — top of the Event Admin page.
 *
 *   MULLIGAN'S ISLAND GOLF CLUB                       [Event page ↗] [Wager board ↗]
 *   Playoffs – Round 1  (Complete)
 *   Course · Oct 12, 2026 · Entry fee $40
 *   ─────────────────────────────────────────────────────────────
 *   Clone event   Re-open event
 *
 * Presentational. The page supplies:
 *   - `statusBadge`  the existing <StatusBadge /> element
 *   - `links`        [{ href, label }] opened in a new tab (Event page, Wager board)
 *   - `quietActions` the quiet text buttons below the divider (Edit/Clone, and the
 *                    existing Activate / Close / Re-open control), each wired by the page
 * `title` is the round name only; the club name sits above it as small uppercase text.
 */

import { ActionButton } from './Button'

export default function EventAdminHeader({ clubName, title, statusBadge, meta, links = [], quietActions = null }) {
  return (
    <header className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          {clubName && (
            <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{clubName}</p>
          )}
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold leading-tight text-ink">{title}</h1>
            {statusBadge}
          </div>
          {meta && <p className="mt-1 text-sm text-ink-muted">{meta}</p>}
        </div>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            {links.map(l => (
              <ActionButton key={l.href} href={l.href} target="_blank" variant="secondary">
                {l.label} <span aria-hidden="true">↗</span>
              </ActionButton>
            ))}
          </div>
        )}
      </div>
      {quietActions && (
        <div className="flex flex-wrap items-center gap-1 border-t border-surface-border pt-2">
          {quietActions}
        </div>
      )}
    </header>
  )
}
