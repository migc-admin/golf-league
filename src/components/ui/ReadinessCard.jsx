/**
 * ReadinessCard — "Ready to activate?" checklist at the top of the Overview page.
 *
 * Shown only while the event is Upcoming. Purely informational: it never blocks
 * Activate. `buildReadiness` derives every item from data the page already has
 * (players, description, registration spots, cover photo); the card just renders
 * them, with one action button per item that the page wires up.
 */

import { ActionButton } from './Button'

/**
 * @param {{ event: object, eventPlayers: object[] }} args
 * @returns {{ key, title, detail, done, warn?, actionLabel }[]}
 */
export function buildReadiness({ event, eventPlayers }) {
  const nonGuests = (eventPlayers ?? []).filter(p => !p.is_guest)
  const count = nonGuests.length
  const items = []

  items.push({
    key: 'spots',
    title: 'Set registration spots',
    detail: 'Caps sign-ups on the event page',
    done: event?.registration_spots != null && Number(event.registration_spots) > 0,
    actionLabel: 'Set',
  })

  items.push({
    key: 'description',
    title: 'Write a tournament description',
    detail: 'Shown on the public event page',
    done: !!event?.description?.trim(),
    actionLabel: 'Add',
  })

  items.push({
    key: 'players',
    title: 'Players added',
    detail: count > 0 ? `${count} player${count !== 1 ? 's' : ''} registered` : 'No players yet',
    done: count > 0,
    actionLabel: 'Manage',
  })

  items.push({
    key: 'cover',
    title: 'Upload a cover photo',
    detail: 'Recommended 1200 × 800 JPG',
    done: !!event?.cover_image_url,
    actionLabel: 'Upload',
  })

  // Flights only matter when the event uses them.
  if (event?.use_flights) {
    const missing = nonGuests.filter(p => !p.flight).length
    items.push({
      key: 'flights',
      title: 'Assign flights',
      detail: count === 0
        ? 'Add players first'
        : missing > 0
          ? `${missing} player${missing !== 1 ? 's' : ''} ${missing !== 1 ? "aren't" : "isn't"} in a flight`
          : 'Every player is in a flight',
      done: count > 0 && missing === 0,
      warn: count > 0 && missing > 0,
      actionLabel: 'Assign',
    })
  }

  return items
}

function CheckCircle({ done }) {
  return done ? (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fairway-700 text-white" aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12l5 5L20 7" />
      </svg>
    </span>
  ) : (
    <span className="h-6 w-6 shrink-0 rounded-full border-2 border-surface-highest" aria-hidden="true" />
  )
}

export default function ReadinessCard({ items, onAction, className = '' }) {
  const doneCount = items.filter(i => i.done).length
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0

  return (
    <section id="readiness" className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-lg font-bold text-ink">Ready to activate?</h2>
          <span className="text-sm font-semibold text-ink whitespace-nowrap">{doneCount} of {items.length} done</span>
        </div>
        <p className="mt-0.5 text-sm text-ink-muted">Finish these before the event goes live.</p>
        <div
          className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-high"
          role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={doneCount} aria-label="Readiness progress"
        >
          <div className="h-full rounded-full bg-fairway-700 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </header>

      <ul>
        {items.map(item => (
          <li key={item.key} className="flex items-center gap-3 border-t border-surface-border py-3 first:border-t-0 first:pt-0">
            <CheckCircle done={item.done} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">{item.title}</p>
              <p className={`text-xs ${item.warn ? 'text-status-upcoming-text' : 'text-ink-muted'}`}>{item.detail}</p>
            </div>
            <ActionButton className="shrink-0" onClick={() => onAction?.(item.key)}>
              {item.actionLabel}
            </ActionButton>
          </li>
        ))}
      </ul>
    </section>
  )
}
