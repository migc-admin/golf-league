// White card with a small uppercase green eyebrow title. Shared by every body card on the public event page.
// `aside` is an optional node shown at the right end of the title row (a link or a count).

export default function EventCard({ title, id, aside = null, children, className = '' }) {
  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      {title && (aside ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{title}</h2>
          {aside}
        </div>
      ) : (
        <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{title}</h2>
      ))}
      {children}
    </section>
  )
}
