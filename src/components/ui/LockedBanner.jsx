/**
 * LockedBanner — shown at the top of the Groups & pairings page when the event is complete.
 *
 *   🔒 Groups and pairings are locked                         [Re-open on Overview]
 *      The event is complete. Re-open it to make changes. Tiebreak winners can still be set.
 *
 * Light forest-green tint (the existing "active" tint) with a line lock icon. The button only
 * navigates (the page passes `onReopen`, which goes to the Overview tab); it does not re-open
 * the event itself.
 */

import { ActionButton } from './Button'

function LockIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 shrink-0">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

export default function LockedBanner({ onReopen, className = '' }) {
  return (
    <div
      role="status"
      className={`flex flex-col gap-3 rounded-sm border border-fairway-200 bg-status-active-bg px-4 py-3 text-status-active-text sm:flex-row sm:items-center sm:justify-between ${className}`.trim()}
    >
      <div className="flex items-start gap-3">
        <LockIcon />
        <div>
          <p className="text-sm font-bold">Groups and pairings are locked</p>
          <p className="text-xs">The event is complete. Re-open it to make changes. Tiebreak winners can still be set.</p>
        </div>
      </div>
      <ActionButton className="shrink-0 !text-ink" onClick={onReopen}>Re-open on Overview</ActionButton>
    </div>
  )
}
