import { aboutHtml } from './AboutCard'

/** Collapsible local rules (native details/summary). Hidden when the event has none. Text is shown as typed. */
export default function LocalRulesCard({ text }) {
  if (!text?.trim()) return null
  return (
    <details className="group rounded-sm border border-surface-border bg-white">
      <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 sm:px-6 [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">Local rules</span>
        <svg className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </summary>
      <div
        className="break-words px-5 pb-5 text-[15px] leading-[1.65] text-ink sm:px-6"
        dangerouslySetInnerHTML={{ __html: aboutHtml(text) }}
      />
    </details>
  )
}
