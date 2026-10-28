/**
 * EventAdminHeader — top of every Event Admin page.
 *
 *   MULLIGAN'S ISLAND GOLF CLUB            [Event page ↗] [Wager board ↗]  Clone  Activate event
 *   Playoffs – Round 2  (Upcoming)
 *   Native Oaks · Sun, Nov 15, 2026 · 9:10 AM start
 *
 * Presentational. The page supplies:
 *   - `title`        the H1 (the event name, or the tab name such as "Players")
 *   - `statusBadge`  the existing <StatusBadge /> element
 *   - `meta`         the line under the title
 *   - `links`        [{ href, label }] outlined buttons that open in a new tab
 *   - `actions`      buttons that follow the links on the right (Clone, Activate / Close /
 *                    Re-open, "+ Add player"), each wired by the page
 * The club name sits above the title as small uppercase text.
 */

import { ActionButton } from './Button'

export default function EventAdminHeader({ clubName, title, statusBadge, meta, links = [], actions = null }) {
  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-4">
      <div className="min-w-0">
        {clubName && (
          <p className="text-[11px] font-bold uppercase tracking-widest text-fairway-700">{clubName}</p>
        )}
        <div className="mt-0.5 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold leading-tight text-ink">{title}</h1>
          {statusBadge}
        </div>
        {meta && <p className="mt-1 text-sm text-ink-muted">{meta}</p>}
      </div>
      {(links.length > 0 || actions) && (
        <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
          {links.map(l => (
            <ActionButton key={l.href} href={l.href} target="_blank" variant="secondary">
              {l.label} <span aria-hidden="true">↗</span>
            </ActionButton>
          ))}
          {actions}
        </div>
      )}
    </header>
  )
}
