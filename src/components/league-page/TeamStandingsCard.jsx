/**
 * TeamStandingsCard — Team Play on the public league page: every team ranked by points, for the
 * whole season or for a single event (chosen from a list). Presentational over rows from
 * teamSeasonView(); `events` is [{ id, label }] for the single-event list.
 */
import { useState } from 'react'
import SegmentedToggle from '../ui/SegmentedToggle'
import RankBadge from './RankBadge'
import { fmtPts } from '../../lib/teamPlayView'
import { parseLocalDate } from '../../lib/seasonView'

const ORD = n => (n == null ? '–' : n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)
const dateText = str => {
  const d = parseLocalDate(str)
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
}
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500'

/** Team name, bar and points: the same markup whether the row is a button (season) or plain (one event). */
function Summary({ r, scored }) {
  return (
    <>
      <RankBadge n={r.rank} />
      <div className="min-w-0">
        <div className="truncate text-[15px] font-semibold text-ink">{r.team.name}</div>
        <div
          role="img"
          aria-label={scored ? `${r.team.name}: ${fmtPts(r.points)} points` : `${r.team.name}: no points yet`}
          className="mt-1 h-1 max-w-[260px] rounded-full bg-surface-high"
        >
          <div className="h-1 rounded-full bg-fairway-700" style={{ width: `${Math.round((r.fraction ?? 0) * 100)}%` }} />
        </div>
      </div>
      <div className="text-right">
        <span className="text-[15px] font-bold tabular-nums text-ink">{scored ? fmtPts(r.points) : '–'}</span>
        <span className="ml-1 text-xs text-ink-muted">pts</span>
      </div>
    </>
  )
}

const GRID = 'grid grid-cols-[36px_minmax(0,1fr)_auto] items-center gap-x-2'

function EventResults({ team, id }) {
  return (
    <div id={id} className="bg-surface-dim pb-3 pl-[44px] pr-2 pt-1">
      <p className="mb-1 text-xs font-semibold text-ink-muted">{team.team.name} · result in each event</p>
      <ul className="divide-y divide-surface-border">
        {team.events.map(e => (
          <li key={e.eventId} className="py-1.5 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{e.name}</span>
                <span className="block text-xs text-ink-muted">{dateText(e.date)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-bold text-ink">{ORD(e.rank)}</span>
                <span className="block text-xs tabular-nums text-ink-muted">{fmtPts(e.points)} pts</span>
              </span>
            </div>
            {e.players.length > 0 && (
              <p className="mt-0.5 text-xs text-ink-muted">{e.players.map(p => `${p.name} ${fmtPts(p.points)}`).join(' · ')}</p>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Row({ r, showPlayers, open, onToggle }) {
  const scored = r.points != null
  // Season rows open to the team's result in every event; single-event rows show the players inline.
  if (!showPlayers && r.events?.length) {
    const id = `team-results-${r.team.id}`
    return (
      <li className="border-b border-surface-border last:border-b-0">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={id}
          onClick={onToggle}
          className={`${GRID} min-h-[56px] w-full py-3 text-left transition-colors hover:bg-surface-dim ${FOCUS} ${open ? 'bg-surface-dim' : ''}`}
        >
          <Summary r={r} scored={scored} />
        </button>
        {open && <EventResults team={r} id={id} />}
      </li>
    )
  }
  return (
    <li className="border-b border-surface-border py-3 last:border-b-0">
      <div className={GRID}><Summary r={r} scored={scored} /></div>
      {showPlayers && r.players.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 pl-[44px]">
          {r.players.map(p => (
            <li key={p.id} className="inline-flex items-center gap-1.5 rounded-sm bg-surface-container px-2.5 py-1 text-sm text-ink">
              {p.name}
              <strong className="font-bold tabular-nums">{fmtPts(p.points)}</strong>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function TeamStandingsCard({ view, events, teamLabel = 'Team play' }) {
  const [mode, setMode] = useState('season')
  const [eventId, setEventId] = useState(null)
  const [open, setOpen] = useState(null)
  const scored = events.filter(e => view.byEvent[e.id])
  const pick = eventId && view.byEvent[eventId] ? eventId : scored[0]?.id
  const rows = mode === 'season' ? view.season : (view.byEvent[pick] ?? [])
  const subtitle = mode === 'season'
    ? `Team points added up across ${view.scoredEventIds.length} event${view.scoredEventIds.length === 1 ? '' : 's'}. Tap a team to see each event.`
    : 'Team points for one event, highest first.'

  return (
    <section className="rounded-sm border border-surface-border bg-white p-5 sm:p-6" aria-labelledby="team-standings-title">
      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 id="team-standings-title" className="text-lg font-bold text-ink">{teamLabel} standings</h2>
          <p className="text-sm text-ink-muted">{subtitle}</p>
        </div>
        {scored.length > 0 && (
          <SegmentedToggle
            label="Team standings view"
            value={mode}
            onChange={setMode}
            options={[{ value: 'season', label: 'Season' }, { value: 'event', label: 'Single event' }]}
            className="self-start"
          />
        )}
      </div>

      {mode === 'event' && scored.length > 0 && (
        <div className="mb-3">
          <label htmlFor="team-event" className="sr-only">Event</label>
          <select id="team-event" value={pick} onChange={e => setEventId(e.target.value)} className="input min-h-[44px] w-full">
            {scored.map(e => <option key={e.id} value={e.id}>{e.label}</option>)}
          </select>
        </div>
      )}

      {scored.length === 0 && <p className="mb-2 text-sm text-ink-muted">No team points yet. Standings appear after an event is scored.</p>}
      <ul>{rows.map(r => <Row key={r.team.id} r={r} showPlayers={mode === 'event'} open={open === r.team.id} onToggle={() => setOpen(open === r.team.id ? null : r.team.id)} />)}</ul>
    </section>
  )
}
