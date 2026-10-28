/**
 * ResultsCard — the white card shell used by every section of the wager results page:
 * a forest-green header bar (gold title, pale-green subtitle) over a white body, with a 1px
 * warm border and 14px corners. Forest green reuses the existing token; the gold, subtitle
 * green and border are local to this page.
 */

export default function ResultsCard({ title, subtitle, children, className = '', id }) {
  return (
    <section id={id} className={`overflow-hidden rounded-[14px] border border-[#E4E1D8] bg-white ${className}`.trim()}>
      <header className="bg-fairway-700 px-5 py-3.5 sm:px-6">
        <h2 className="text-base font-semibold text-[#E3B94E]">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-[#CFE0D5]">{subtitle}</p>}
      </header>
      {children}
    </section>
  )
}
