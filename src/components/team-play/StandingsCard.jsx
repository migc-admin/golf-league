/**
 * StandingsCard — "Standings": teams ranked by points, highest first.
 *
 *   Rank | Team                                  | Players                              | Points
 *   #1   | The Money Team                        | John Nothdurft 10 · Mikel Hodges 4   |   14
 *        | ████████████████████                  |                                      |
 *
 * Presentational. `rows` come from `standingsRows` (ranks shared on ties, a bar fraction of the
 * leader's points, and each team's selected players). Teams are told apart by name and rank, never
 * by color, so the bar is the app's own green. Before scores exist the rows keep roster order, with
 * "—" for points and empty bars. On a phone each team's player chips wrap under its name.
 * `toggle` is an optional control for the header (the "This event | Season" switch).
 */

import { fmtPts } from '../../lib/teamPlayView'

function Row({ r }) {
  const scored = r.points != null
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 border-t border-surface-border py-4 first:border-t-0 md:grid-cols-[3.5rem_minmax(0,1.2fr)_minmax(0,2fr)_5rem] md:items-center">
      <span className="text-sm font-bold tabular-nums text-ink">{r.rank != null ? `#${r.rank}` : '—'}</span>

      <div className="min-w-0">
        <p className="text-sm font-bold text-ink">{r.team.name}</p>
        <div
          role="img"
          aria-label={scored ? `${r.team.name}: ${fmtPts(r.points)} points, ${Math.round(r.fraction * 100)} percent of the leader` : `${r.team.name}: no points yet`}
          className="mt-1.5 h-1.5 w-full max-w-[16rem] overflow-hidden rounded-full bg-surface-high"
        >
          <div className="h-full rounded-full bg-fairway-700" style={{ width: `${Math.round(r.fraction * 100)}%` }} />
        </div>
      </div>

      <span className="text-right text-2xl font-bold tabular-nums leading-none text-ink md:order-last">{scored ? fmtPts(r.points) : '—'}</span>

      <ul className="col-span-3 flex flex-wrap gap-2 md:col-span-1">
        {r.players.length === 0
          ? <li className="text-sm text-ink-muted">{scored ? 'No players selected' : '—'}</li>
          : r.players.map(p => (
            <li key={p.id} className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container px-2.5 py-1 text-sm text-ink">
              {p.name}
              <strong className="font-bold tabular-nums">{fmtPts(p.points)}</strong>
            </li>
          ))}
      </ul>
    </li>
  )
}

export default function StandingsCard({ rows, title = 'Standings', subtitle = 'Team points for this event, highest first.', toggle = null, id = 'standings', className = '' }) {
  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{title}</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p>
        </div>
        {toggle}
      </header>

      {rows.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted">No teams yet. Create up to 4 teams for this league.</p>
      ) : (
        <>
          <div className="hidden border-b border-surface-border pb-2 text-[11px] font-bold uppercase tracking-widest text-ink-muted md:grid md:grid-cols-[3.5rem_minmax(0,1.2fr)_minmax(0,2fr)_5rem] md:gap-x-3" aria-hidden="true">
            <span>Rank</span><span>Team</span><span>Players</span><span className="text-right">Points</span>
          </div>
          <ul>{rows.map(r => <Row key={r.team.id} r={r} />)}</ul>
        </>
      )}
    </section>
  )
}
