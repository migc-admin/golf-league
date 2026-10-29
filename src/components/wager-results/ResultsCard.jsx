/**
 * ResultsCard — the white card shell used by every section of the wager results page:
 * a forest-green header bar (gold title, pale-green subtitle) over a white body, with a 1px
 * warm border and 14px corners. `aside` is an optional short note on the right of the header
 * (e.g. "0 of 2"). `radius="sm"` gives the admin pages' 8px corners (default is the wager results page's 14px). Forest green reuses the existing token; the gold, subtitle
 * green and border are local to this page.
 */

export default function ResultsCard({ title, subtitle, aside, children, className = '', id, radius = 'lg' }) {
  return (
    <section id={id} className={`overflow-hidden ${radius === 'sm' ? 'rounded-sm' : 'rounded-[14px]'} border border-[#E4E1D8] bg-white ${className}`.trim()}>
      <header className="flex items-start justify-between gap-3 bg-fairway-700 px-5 py-3.5 sm:px-6">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-[#E3B94E]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[13px] text-[#CFE0D5]">{subtitle}</p>}
        </div>
        {aside && <span className="shrink-0 pt-0.5 text-[13px] font-semibold text-[#CFE0D5]">{aside}</span>}
      </header>
      {children}
    </section>
  )
}
