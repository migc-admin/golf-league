/**
 * AmberBanner — a gold "heads up" strip with a line warning icon (no emoji).
 * Uses the existing gold "Upcoming" tint. Pass `title` for the bold lead-in and `children`
 * for the rest of the sentence.
 */

export function WarnIcon({ className = '' }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`shrink-0 ${className}`.trim()}>
      <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  )
}

export default function AmberBanner({ title, children, className = '' }) {
  return (
    <div role="status" className={`flex items-start gap-2 rounded-sm border border-surface-border bg-status-upcoming-bg px-4 py-3 text-sm text-status-upcoming-text ${className}`.trim()}>
      <WarnIcon className="mt-0.5" />
      <p><span className="font-semibold">{title}</span>{children && <> {children}</>}</p>
    </div>
  )
}
