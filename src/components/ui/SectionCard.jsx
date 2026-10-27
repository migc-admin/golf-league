/**
 * SectionCard — a white card for one stage of the event (Pre-round, Scoring, Results).
 *
 *   STEP 1 · BEFORE THE ROUND                 [header action]
 *   Pre-round                                  (Done)
 *   ...children (hero card, rows)
 *
 * `done` shows a small green "Done" pill beside the title. `headerAction` is one quiet
 * button on the right of the header (e.g. "Download print packet").
 *
 * LockedSectionCard is the dashed, muted stand-in used for Results until the event is
 * marked complete: a heading, a one-line note and a plain list. It has no buttons.
 */

function Eyebrow({ children }) {
  return <p className="text-[11px] font-bold uppercase tracking-widest text-ink-muted">{children}</p>
}

export default function SectionCard({ eyebrow, title, done = false, headerAction = null, children, className = '' }) {
  return (
    <section className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            {done && (
              <span className="rounded-full bg-status-active-bg px-2.5 py-0.5 text-xs font-semibold text-status-active-text">
                Done
              </span>
            )}
          </div>
        </div>
        {headerAction}
      </header>
      {children}
    </section>
  )
}

export function LockedSectionCard({ eyebrow, title, note, items = [], className = '' }) {
  return (
    <section
      className={`rounded-sm border border-dashed border-surface-highest bg-surface-container p-5 sm:p-6 ${className}`.trim()}
      aria-label={`${title} (locked)`}
    >
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 className="mt-0.5 text-lg font-bold text-ink-muted">{title}</h2>
      {note && <p className="mt-1 text-sm text-ink-muted">{note}</p>}
      {items.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-ink-muted">
          {items.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
