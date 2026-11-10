import { Fragment, useMemo, useState } from 'react'
import { parseBylaws, inlineParts, groupSections } from '../../lib/bylaws'

/**
 * League rules & bylaws on the public league page. Each article is a collapsed row that
 * opens to show what's inside; "Expand all" opens every one. Text is shown as the admin
 * pasted it (title-like lines become headings, "-" lines become bullets, line breaks kept)
 * and rendered as React elements only (no raw HTML), so pasted text is always safe.
 */

function Inline({ line }) {
  return inlineParts(line).map((p, i) => {
    if (p.type === 'bold') return <strong key={i} className="font-semibold">{p.value}</strong>
    if (p.type === 'link') {
      return (
        <a key={i} href={p.value} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-fairway-700 underline underline-offset-2">
          {p.value}
        </a>
      )
    }
    return <Fragment key={i}>{p.value}</Fragment>
  })
}

function Blocks({ blocks }) {
  return blocks.map((b, i) => {
    if (b.type === 'heading') {
      return <h4 key={i} className="mt-5 text-[15px] font-bold text-ink first:mt-0"><Inline line={b.text} /></h4>
    }
    if (b.type === 'list') {
      return (
        <ul key={i} className="mt-2 list-disc space-y-1 pl-6 marker:text-fairway-700 first:mt-0">
          {b.items.map((item, j) => <li key={j}><Inline line={item} /></li>)}
        </ul>
      )
    }
    return (
      <p key={i} className="mt-3 first:mt-0">
        {b.lines.map((line, j) => (
          <Fragment key={j}>{j > 0 && <br />}<Inline line={line} /></Fragment>
        ))}
      </p>
    )
  })
}

function Chevron() {
  return (
    <svg className="shrink-0 text-ink-muted transition-transform group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 9l6 6 6-6" />
    </svg>
  )
}

export default function BylawsCard({ leagueName, text, updatedAt }) {
  const { intro, sections } = useMemo(() => groupSections(parseBylaws(text)), [text])
  const [open, setOpen] = useState(() => new Set())
  const allOpen = sections.length > 0 && open.size === sections.length
  const updated = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  function toggle(id, isOpen) {
    setOpen(prev => {
      const next = new Set(prev)
      if (isOpen) next.add(id); else next.delete(id)
      return next
    })
  }

  return (
    <article className="rounded-sm border border-surface-border bg-white px-5 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-surface-border pb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{leagueName}</p>
          <h2 className="mt-1 text-2xl font-extrabold text-ink" style={{ letterSpacing: '-0.02em' }}>League rules &amp; bylaws</h2>
          {updated && <p className="mt-1 text-sm text-ink-muted">Last updated {updated}</p>}
        </div>
        {sections.length > 1 && (
          <button
            type="button"
            onClick={() => setOpen(allOpen ? new Set() : new Set(sections.map(s => s.id)))}
            className="min-h-[44px] rounded-sm border border-surface-border px-4 text-sm font-semibold text-fairway-700 hover:bg-surface-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        )}
      </header>

      <div className="break-words text-[15px] leading-[1.65] text-ink">
        {intro.length > 0 && <div className="mt-5 max-w-[72ch]"><Blocks blocks={intro} /></div>}

        {sections.length > 0 && (
          <div className="mt-4">
            {sections.map(s => (
              <details
                key={s.id}
                open={open.has(s.id)}
                onToggle={e => toggle(s.id, e.currentTarget.open)}
                className="group border-b border-surface-border last:border-b-0"
              >
                <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between gap-3 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 [&::-webkit-details-marker]:hidden">
                  <span className="text-[16px] font-bold text-ink"><Inline line={s.title} /></span>
                  <Chevron />
                </summary>
                {s.blocks.length > 0 && <div className="max-w-[72ch] pb-5"><Blocks blocks={s.blocks} /></div>}
              </details>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}
