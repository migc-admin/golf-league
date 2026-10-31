/**
 * HeroEmailCard — the green-tinted email card at the top of the Pre-round and Results
 * panels ("Tournament details email", "Results email").
 *
 *   [GMAIL]  Tournament details email                [Preview] [Copy email]
 *            One-line description
 *
 * Purely presentational: the page passes the handler. The button opens the email modal,
 * which has the preview and the real copy action. "Copy email" is the one Primary button.
 */

import { ActionButton } from './Button'

export default function HeroEmailCard({ title, description, onCopy, stacked = false, className = '' }) {
  return (
    <div
      className={`mb-5 flex flex-col gap-4 rounded-sm border border-fairway-200 bg-fairway-50 p-4 ` +
        `${stacked ? '' : 'sm:flex-row sm:items-center sm:justify-between'} ${className}`.trim()}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-bold text-ink">{title}</h3>
          <span className="rounded-sm bg-white px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fairway-700">
            GMAIL
          </span>
        </div>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      <div className={`flex flex-wrap items-center gap-2 ${stacked ? '' : 'sm:shrink-0'}`}>
        <ActionButton variant="primary" onClick={onCopy}>Copy email</ActionButton>
      </div>
    </div>
  )
}
