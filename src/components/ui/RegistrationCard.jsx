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
 * Presentational. The page passes the URL (built exactly as before), the copy handler,
 * the pending count (null while loading), an optional `notice` line under the link (e.g. no
 * payment links set), and the pending list as `children` so each registration keeps its
 * existing buttons.
 */

import { useId } from 'react'
import { ActionButton } from './Button'

export default function RegistrationCard({ id = 'registration', url, onCopy, pendingCount = 0, notice = null, children, className = '' }) {
  const inputId = useId()

  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4">
        <h2 className="text-lg font-bold text-ink">Registration</h2>
        <p className="mt-0.5 text-sm text-ink-muted">Share this link so players can sign up and pay.</p>
      </header>

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
