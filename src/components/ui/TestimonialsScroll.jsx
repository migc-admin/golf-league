// Homepage testimonials and traction numbers.
// Real quotes only, each with the person's permission and how they asked to be named.
// One review can be split into several cards by topic; keep the reviewer's own words.
// Rendered without scroll-reveal animation so the proof is never left invisible.

// photo: path under /public (e.g. '/images/people/darrick-s.jpg'), only with the person's permission.
// Until a photo is added, the card shows their initials.
const REVIEWER = {
  name: 'Darrick S.',
  club: "Mulligan's Island Golf Club",
  context: '40-player monthly league',
  photo: null,
}

const testimonials = [
  {
    topic: 'Live scores & payouts',
    text: 'With a "competitive" group of golfers battling throughout the season, the app has made tracking live scores, tournament standings and winning payouts easier than ever.',
    ...REVIEWER,
  },
  {
    topic: 'Event day',
    text: 'Scorify Golf App has been a game changer for our Mulligan’s Island Golf Club (MIGC)! It brings excitement, transparency and friendly trash talk to every event!',
    ...REVIEWER,
  },
  {
    topic: 'Running the club',
    text: 'Scorify Golf has helped us stay organized while making the overall experience more enjoyable for our members. A must-have for any competitive golf club!',
    ...REVIEWER,
  },
]

// Mulligan's Island, 2026 season. Update the numbers and the date together.
const STATS = [
  { num: '14', label: 'Events scored in 2026' },
  { num: '340+', label: 'Rounds scored' },
  { num: '$0', label: 'To get started' },
]
const STATS_AS_OF = "Mulligan's Island Golf Club, 2026 season · as of November 2026"

// Player photos for the strip beside the stats — real league players, with permission only.
// e.g. { name: 'Darrick S.', photo: '/images/people/darrick-s.jpg' }. The strip stays hidden while empty.
const PLAYER_PHOTOS = []

const initials = name => name.split(/\s+/).map(w => w[0]).join('').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase()

function Avatar({ name, photo, size = 'h-10 w-10' }) {
  if (photo) return <img src={photo} alt={name} className={`${size} shrink-0 rounded-full border-2 border-white object-cover`} loading="lazy" />
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-fairway-700 text-xs font-bold text-white`} aria-hidden="true">
      {initials(name)}
    </span>
  )
}

function QuoteMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" className="text-fairway-200" aria-hidden="true">
      <path d="M9.5 6C6.5 6.6 4 9.3 4 13v5h6v-6H7c0-2.2 1.3-3.6 3-4l-.5-2zm10 0c-3 .6-5.5 3.3-5.5 7v5h6v-6h-3c0-2.2 1.3-3.6 3-4l-.5-2z" />
    </svg>
  )
}

function TestimonialCard({ topic, text, name, club, context, photo }) {
  return (
    <figure className="flex h-full flex-col rounded-sm border border-surface-border bg-white p-7 shadow-card-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-fairway-700">{topic}</span>
        <QuoteMark />
      </div>
      <blockquote className="flex-1 text-[15px] leading-relaxed text-ink">“{text}”</blockquote>
      <figcaption className="mt-6 flex items-center gap-3 border-t border-surface-border pt-4">
        <Avatar name={name} photo={photo} />
        <span className="min-w-0">
          <span className="block text-sm font-bold text-ink">{name}</span>
          <span className="block text-sm text-ink-muted">{club}</span>
          {context && <span className="block text-xs text-ink-muted">{context}</span>}
        </span>
      </figcaption>
    </figure>
  )
}

export default function TestimonialsScroll() {
  return (
    <section className="bg-surface py-24">
      <div className="mx-auto max-w-6xl px-6">

        {/* Header */}
        <div className="mb-14 flex flex-col items-center">
          <div className="mb-4 rounded-full bg-status-active-bg px-4 py-1 text-xs font-bold uppercase tracking-widest text-fairway-700">
            Testimonials
          </div>
          <h2 className="mb-4 text-center text-3xl font-bold text-ink md:text-4xl">
            What organizers are saying
          </h2>
          <p className="max-w-md text-center text-base text-ink-muted">
            From the clubs running their season on Scorify.
          </p>
        </div>

        {/* Social proof: player photos (when added), the numbers, and where they come from */}
        <div className="mb-14 flex flex-col items-center gap-6">
          {PLAYER_PHOTOS.length > 0 && (
            <div className="flex -space-x-2" aria-label="Players scoring on Scorify">
              {PLAYER_PHOTOS.map(p => <Avatar key={p.name} {...p} />)}
            </div>
          )}
          <div className="flex flex-col items-center justify-center gap-8 sm:flex-row">
            {STATS.map((s, i) => (
              <div key={s.label} className="flex items-center gap-8">
                {i > 0 && <div className="hidden h-8 w-px bg-surface-highest sm:block" aria-hidden="true" />}
                <div className="text-center">
                  <div className="text-3xl font-bold text-fairway-700">{s.num}</div>
                  <div className="mt-1 text-sm text-ink-muted">{s.label}</div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-ink-muted">{STATS_AS_OF}</p>
        </div>

        {/* Quotes */}
        <div className="grid gap-5 md:grid-cols-3">
          {testimonials.map(t => <TestimonialCard key={t.topic} {...t} />)}
        </div>

        {/* Payment trust note */}
        <div className="mt-12 flex flex-col items-center gap-4 rounded-sm border border-surface-border bg-status-active-bg px-6 py-4 text-center sm:flex-row sm:text-left">
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0 text-fairway-700" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm text-status-active-text">
            <strong>Payments stay between you and your players.</strong> Scorify connects to Venmo and PayPal links you control — we never hold or process your league funds.
          </p>
        </div>

      </div>
    </section>
  )
}
