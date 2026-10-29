// Public event page hero. Text column first (stacks above the image on phones),
// cover image / registration card are passed in as slots so each stays its own component.

const PILL = {
  open:     'bg-fairway-50 text-fairway-700 border-fairway-200',
  closed:   'bg-surface-high text-ink-muted border-surface-border',
  complete: 'bg-fairway-700 text-white border-fairway-700',
}

function StatusPill({ kind, label }) {
  return (
    <span className={`inline-flex items-center gap-2 self-start rounded-full border px-3 py-1 text-xs font-bold ${PILL[kind] ?? PILL.closed}`}>
      {kind === 'open' && <span className="h-2 w-2 rounded-full bg-fairway-500" aria-hidden="true" />}
      {label}
    </span>
  )
}

function FactRow({ icon, children }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm bg-fairway-50 text-fairway-700" aria-hidden="true">
        {icon}
      </div>
      <div className="min-w-0 pt-0.5">{children}</div>
    </div>
  )
}

const CalendarIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
)
const PinIcon = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
  </svg>
)

/**
 * Props: clubName, logoUrl, pill { kind, label }, title, dateLabel, timeLabel,
 * courseName, courseAddress, directionsHref, children (registration/results slot), media (cover image slot).
 */
export default function EventHero({
  clubName, logoUrl, pill, title, dateLabel, timeLabel, courseName, courseAddress,
  directionsHref = '#getting-there', children, media,
}) {
  return (
    <section className="bg-white border-b border-surface-border">
      <div className={`mx-auto grid max-w-[1100px] gap-8 px-4 py-6 sm:px-6 lg:py-10 ${media ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-12' : ''}`}>
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-sm border border-surface-border object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-fairway-700 text-xs font-extrabold text-white" aria-hidden="true">
                {(clubName ?? '').slice(0, 2).toUpperCase()}
              </div>
            )}
            <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-muted">{clubName}</span>
          </div>

          {pill && <StatusPill kind={pill.kind} label={pill.label} />}

          <div>
            <h1 className="text-[clamp(28px,6vw,44px)] font-extrabold leading-[1.08] text-ink" style={{ letterSpacing: '-0.03em' }}>
              {title}
            </h1>
            <div className="mt-3 h-1 w-11 rounded-full bg-fairway-700" aria-hidden="true" />
          </div>

          <div className="flex flex-col gap-4">
            {dateLabel && (
              <FactRow icon={CalendarIcon}>
                <div className="text-[15px] font-bold text-ink">{dateLabel}</div>
                {timeLabel && <div className="text-sm text-ink-muted">{timeLabel}</div>}
              </FactRow>
            )}
            <FactRow icon={PinIcon}>
              <div className="text-[15px] font-bold text-ink">{courseName ?? 'TBD'}</div>
              {courseAddress && (
                <div className="text-sm text-ink-muted">
                  {courseAddress}
                  <span aria-hidden="true"> · </span>
                  <a href={directionsHref} className="inline-flex min-h-[44px] items-center font-semibold text-fairway-700 underline sm:min-h-0">Directions</a>
                </div>
              )}
            </FactRow>
          </div>

          {children}
        </div>

        {media}
      </div>
    </section>
  )
}
