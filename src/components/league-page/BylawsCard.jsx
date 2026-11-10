import { Fragment, useMemo } from 'react'
import { parseBylaws, inlineParts } from '../../lib/bylaws'

/**
 * League rules & bylaws on the public league page. Text is shown as the admin pasted it:
 * title-like lines become headings, "-" lines become bullets, everything else keeps its
 * line breaks. Rendered as React elements only (no raw HTML), so pasted text is always safe.
 * With three or more headings, a contents list at the top jumps to each section.
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

function jumpTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

export default function BylawsCard({ leagueName, text, updatedAt }) {
  const blocks = useMemo(() => parseBylaws(text), [text])
  const headings = blocks.filter(b => b.type === 'heading')
  const updated = updatedAt
    ? new Date(updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null

  return (
    <article className="rounded-sm border border-surface-border bg-white px-5 py-6 sm:px-8 sm:py-8">
      <header className="border-b border-surface-border pb-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{leagueName}</p>
        <h2 className="mt-1 text-2xl font-extrabold text-ink" style={{ letterSpacing: '-0.02em' }}>League rules &amp; bylaws</h2>
        {updated && <p className="mt-1 text-sm text-ink-muted">Last updated {updated}</p>}
      </header>

      {headings.length >= 3 && (
        <nav aria-label="Sections" className="mt-5 rounded-sm bg-surface-dim px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-ink-muted">Contents</p>
          <ul className="mt-1">
            {headings.map(h => (
              <li key={h.id}>
                <button
                  type="button"
                  onClick={() => jumpTo(h.id)}
                  className="min-h-[44px] w-full py-2 text-left text-[15px] font-medium text-fairway-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
                >
                  {h.text}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-5 max-w-[72ch] break-words text-[15px] leading-[1.65] text-ink">
        {blocks.map((b, i) => {
          if (b.type === 'heading') {
            return (
              <h3 key={i} id={b.id} className="mt-7 scroll-mt-24 text-[17px] font-bold text-ink first:mt-0">
                <Inline line={b.text} />
              </h3>
            )
          }
          if (b.type === 'list') {
            return (
              <ul key={i} className="mt-3 list-disc space-y-1 pl-6 marker:text-fairway-700">
                {b.items.map((item, j) => <li key={j}><Inline line={item} /></li>)}
              </ul>
            )
          }
          return (
            <p key={i} className="mt-3">
              {b.lines.map((line, j) => (
                <Fragment key={j}>{j > 0 && <br />}<Inline line={line} /></Fragment>
              ))}
            </p>
          )
        })}
      </div>
    </article>
  )
}
