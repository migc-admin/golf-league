/**
 * StandingsBadge — a small tag that says whether a game's winnings count toward the league's
 * season standings. The answer comes from the league's Standings Settings (lib/standingsBuckets).
 *
 *   <StandingsBadge gameKey="skins" config={league.standings_config} />
 *   <StandingsLegend keys={activePayoutKeys(event)} config=... leagueName="..." />
 *
 * Display only: nothing here changes what is paid or how standings are worked out.
 */
import { bucketOfKey, bucketName, countsForEvent, countsTowardStandings, standingsConfig } from '../../lib/standingsBuckets'

const Check = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
)
const Dash = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 12h12" /></svg>
)

export function StandingsBadge({ gameKey, bucket, config, overrides, onToggle, isTrip = false, className = '' }) {
  const b = bucket ?? bucketOfKey(gameKey)
  const counts = countsForEvent(b, config, overrides)
  const overridden = counts !== countsTowardStandings(b, config)
  const tone = counts ? 'bg-fairway-50 text-fairway-700' : 'bg-surface-high text-ink-muted'
  const text = (
    <>
      {counts ? Check : Dash}
      {counts ? 'Counts toward standings' : 'Not in standings'}
      {overridden && <span className="font-medium opacity-80"> · {isTrip ? 'round' : 'event'} override</span>}
    </>
  )
  const base = `inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone} ${className}`.trim()
  // A trip keeps its own standings, apart from every league.
  const scope = isTrip ? "this trip's standings" : "this league's season standings"
  const source = isTrip ? " (from the trip's standings settings)" : " (from the league's Standings Settings)"
  const unit = isTrip ? 'round' : 'event'
  const title = `${counts ? `Winnings count toward ${scope}` : `Winnings do not count toward ${scope}`}${overridden ? ` for this ${unit} only` : source}.${onToggle ? ` Click to change it for this ${unit}.` : ''}`
  if (!onToggle) return <span title={title} className={base}>{text}</span>
  return (
    <button
      type="button"
      title={title}
      aria-pressed={counts}
      onClick={e => { e.preventDefault(); e.stopPropagation(); onToggle(b) }}
      className={`${base} cursor-pointer ring-1 ring-inset ring-transparent hover:ring-fairway-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500`}
    >
      {text}
    </button>
  )
}

/** One card listing each kind of game this event pays out and whether it counts toward standings. */
export function StandingsLegend({ keys, config, overrides, leagueName, tripName = null }) {
  const cfg = standingsConfig(config)
  const buckets = [...new Set(keys.map(bucketOfKey))]
  if (buckets.length === 0) return null
  return (
    <div className="rounded-sm border border-surface-border bg-white p-4 sm:p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{tripName ? 'Trip standings' : 'Season standings'}</div>
      {tripName ? (
        <p className="mt-1 text-sm text-ink-muted">
          Which of this round's prizes count toward the {tripName} standings. A trip keeps its own standings,
          separate from your leagues. Change the trip default in Standings on the trip page, or change one game for this round in Edit Event.
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">
          Which of this event's prizes count toward {leagueName ? `the ${leagueName}` : "this league's"} season standings.
          Each league keeps its own standings. Change the league default in its Standings Settings, or change one game for this event in Edit Event.
        </p>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {buckets.map(b => (
          <li key={b} className="flex items-center gap-2">
            <span className="text-sm font-semibold text-ink">{bucketName(b)}</span>
            <StandingsBadge bucket={b} config={cfg} overrides={overrides} isTrip={!!tripName} />
          </li>
        ))}
      </ul>
    </div>
  )
}
