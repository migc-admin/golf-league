/**
 * TeamPlaySheet — the "Team play results" PNG (1000px). Same layout as the Team Play page standings:
 * Rank | Team (dot, name, points bar in the team's color) | Players | Team points.
 */
import ExportHeader from '../ui/ExportHeader'
import { ExportSheet, SmallHead, ExportFooter } from './ExportParts'
import { fmtPts } from '../../lib/teamPlayView'

const FALLBACK_COLOR = '#1B4332'
const cols = 'grid-cols-[56px_minmax(0,1.15fr)_minmax(0,1.6fr)_96px]'

export default function TeamPlaySheet({ view, leagueName, logoUrl }) {
  return (
    <ExportSheet>
      <ExportHeader
        leagueName={leagueName}
        logoUrl={logoUrl}
        title="Team play results"
        pill="Final"
        meta={[view.eventName, view.courseName, view.dateShort].filter(Boolean).join(' · ')}
        right={[`${view.rows.length} teams · ${view.playersEach} players each`, 'Points this event']}
      />

      <section className="mt-5 rounded border border-surface-border bg-white px-5 pb-2 pt-4">
        <div className={`grid ${cols} items-end gap-x-4 border-b border-surface-border pb-2`}>
          <SmallHead>Rank</SmallHead>
          <SmallHead>Team</SmallHead>
          <SmallHead>Players · event rank · points</SmallHead>
          <SmallHead className="text-right">Points</SmallHead>
        </div>
        {!view.scored && <p className="py-8 text-center text-[14px] text-ink-muted">No scores available yet</p>}
        {view.rows.map((r, i) => {
          const color = r.team.color || FALLBACK_COLOR
          return (
            <div key={i} className={`grid ${cols} items-center gap-x-4 border-t border-surface-border py-4 first:border-t-0`}>
              <span className="text-[15px] font-bold tabular-nums">{r.rank != null ? `#${r.rank}` : '—'}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
                  <span className="truncate text-[17px] font-bold">{r.team.name}</span>
                </div>
                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-high">
                  <div className="h-full rounded-full" style={{ width: `${Math.round(r.fraction * 100)}%`, background: color }} />
                </div>
              </div>
              <div className="space-y-1.5">
                {r.players.length === 0 && <span className="text-[13px] text-ink-muted">No players selected</span>}
                {r.players.map((p, j) => (
                  <div key={j} className="flex items-center gap-3 rounded-sm bg-surface px-3 py-1.5 text-[13px]">
                    <span className="min-w-0 flex-1 font-bold">{p.name}</span>
                    <span className="text-[12px] text-ink-muted">{p.rank != null ? `Rank #${p.rank}` : '—'}</span>
                    <span className="w-[52px] text-right font-bold tabular-nums">{fmtPts(p.points)} pts</span>
                  </div>
                ))}
              </div>
              <span className="text-right text-[34px] font-extrabold leading-none tabular-nums">{r.points != null ? fmtPts(r.points) : '—'}</span>
            </div>
          )
        })}
      </section>

      <p className="mt-3 text-[11px] text-ink-muted">
        Event rank = the player's finishing position within their own flight this event. Team points add up the two players' points.
      </p>
      <ExportFooter left={`Final results · ${view.dateShort}`} />
    </ExportSheet>
  )
}
