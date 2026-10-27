/**
 * ExportRow — one line in a Pre-round / Scoring / Results card.
 *
 *   Title  [PNG]                              [Preview] [Download]
 *   One-line description
 *
 * `actions` is whatever buttons the row needs (ActionButton, or an existing export
 * component). Rows are separated by a 1px divider; the first row in a card has none.
 * On narrow screens the actions drop below the text and wrap. `stacked` forces that layout
 * at every width, for rows that live in the narrow side column.
 *
 * Tags are the file type the row produces: PNG, CSV, XLSX, PRINT or GMAIL.
 */

export const ROW_TAGS = ['PNG', 'CSV', 'XLSX', 'PRINT', 'GMAIL']

export default function ExportRow({ id, title, tag, description, actions, stacked = false, className = '' }) {
  return (
    <div
      id={id}
      className={`flex flex-col gap-3 py-4 border-t border-surface-border first:border-t-0 first:pt-0 ` +
        `${stacked ? '' : 'sm:flex-row sm:items-center sm:justify-between sm:gap-4'} ${className}`.trim()}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="text-sm font-semibold text-ink">{title}</h4>
          {tag && (
            <span className="rounded-sm bg-surface-container px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink-muted">
              {tag}
            </span>
          )}
        </div>
        {description && <p className="mt-0.5 text-sm text-ink-muted">{description}</p>}
      </div>
      {actions && <div className={`flex flex-wrap items-center gap-2 ${stacked ? '' : 'sm:justify-end sm:shrink-0'}`}>{actions}</div>}
    </div>
  )
}
