/**
 * RegistrationCard — the "Registration" card on the Players page.
 *
 *   Registration
 *   Share this link so players can sign up and pay.
 *   Registration link  [ read-only URL ........................ ] [Copy link]
 *   ─────────────────────────────────────────────────────────────────────────
 *   Pending payments                                                    None
 *   Registered but payment not yet confirmed
 *   (pending registrations, with their existing actions, when there are any)
 *
 * `open` / `onToggleOpen` drive the "Registration open" switch. While it's off the event page
 * stays public but shows no Register button, and the database refuses sign-ups.
 *
 * Presentational. The page passes the URL (built exactly as before), the copy handler,
 * the pending count (null while loading), an optional `notice` line under the link (e.g. no
 * payment links set), and the pending list as `children` so each registration keeps its
 * existing buttons.
 */

import { useId } from 'react'
import { ActionButton } from './Button'

export default function RegistrationCard({ id = 'registration', url, onCopy, open = true, onToggleOpen, toggling = false, pendingCount = 0, notice = null, children, className = '' }) {
  const inputId = useId()
  const switchId = useId()

  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4">
        <h2 className="text-lg font-bold text-ink">Registration</h2>
        <p className="mt-0.5 text-sm text-ink-muted">Share this link so players can sign up and pay.</p>
      </header>

      {onToggleOpen && (
        <div className="mb-4 flex items-start gap-3">
          <button
            id={switchId}
            type="button"
            role="switch"
            aria-checked={open}
            aria-label="Registration open"
            disabled={toggling}
            onClick={() => onToggleOpen(!open)}
            className="relative mt-0.5 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 disabled:opacity-60"
          >
            <span className={`block h-5 w-9 rounded-full transition-colors ${open ? 'bg-fairway-700' : 'bg-surface-highest'}`} aria-hidden="true" />
            <span
              className="absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white shadow transition-transform"
              style={{ transform: `translate(${open ? 18 : 2}px, -50%)` }}
              aria-hidden="true"
            />
          </button>
          <label htmlFor={switchId} className="cursor-pointer pt-2.5">
            <span className="block text-sm font-semibold leading-tight text-ink">{open ? 'Registration open' : 'Registration off'}</span>
            <span className="mt-0.5 block text-xs text-ink-muted">
              {open
                ? 'Players can sign up from the event page and this link.'
                : 'The event page stays public, but there is no Register button and the link below will not accept sign-ups.'}
            </span>
          </label>
        </div>
      )}

      <label htmlFor={inputId} className="label">Registration link</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input id={inputId} className="input flex-1 min-w-0 bg-surface-container text-ink" readOnly value={url} onFocus={e => e.target.select()} />
        <ActionButton icon="copy" className="shrink-0" onClick={onCopy}>Copy link</ActionButton>
      </div>
      {notice && <p className="mt-2 text-xs text-status-upcoming-text">{notice}</p>}

      <div className="mt-5 border-t border-surface-border pt-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-ink">Pending payments</h3>
            <p className="text-xs text-ink-muted">Registered but payment not yet confirmed</p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-ink-muted">
            {pendingCount == null ? 'Loading…' : pendingCount > 0 ? `${pendingCount} pending` : 'None'}
          </span>
        </div>
        {pendingCount != null && pendingCount > 0 && children && <div className="mt-3 space-y-2">{children}</div>}
      </div>
    </section>
  )
}
