// White card with a small uppercase green eyebrow title. Shared by every body card on the public event page.

export default function EventCard({ title, id, children, className = '' }) {
  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      {title && <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{title}</h2>}
      {children}
    </section>
  )
}
