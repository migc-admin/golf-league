/**
 * TeeSheet — the printable tee sheet (Letter landscape). Presentational.
 *
 * Page 1 has the header with First tee / Interval / Field tiles; later pages (more than FIRST_PAGE
 * groups) repeat a slim header and the column headings. `forPng` renders every group on one tall page.
 */
import ExportHeader from '../ui/ExportHeader'
import { ExportFooter, SmallHead, FlightTag } from './ExportParts'

const GOLD = '#C9A84C'
export const FIRST_PAGE = 8
export const NEXT_PAGE = 10

/** Group numbers split into pages: up to 8 on the first page, 10 on each after. */
export function teeSheetChunks(groupNums) {
  if (groupNums.length <= FIRST_PAGE) return [groupNums]
  const chunks = [groupNums.slice(0, FIRST_PAGE)]
  for (let i = FIRST_PAGE; i < groupNums.length; i += NEXT_PAGE) chunks.push(groupNums.slice(i, i + NEXT_PAGE))
  return chunks
}

export function teeTime12(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  const total = h * 60 + m + (groupNum - 1) * (intervalMins ?? 10)
  const hh = Math.floor(total / 60) % 24
  return `${hh % 12 || 12}:${String(total % 60).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`
}

const nameOf = ep => [ep?.player?.first_name, ep?.player?.last_name].filter(Boolean).join(' ') || '—'
const cols = 'grid-cols-[104px_52px_minmax(0,1.25fr)_minmax(0,1fr)_72px]'
const colsNoMatch = 'grid-cols-[104px_52px_minmax(0,1fr)_72px]'

function Tile({ label, value, good }) {
  return (
    <div className={`rounded-sm border px-3.5 py-2 ${good ? 'border-fairway-200 bg-status-active-bg' : 'border-surface-border bg-white'}`}>
      <div className={`text-[11px] ${good ? 'text-status-active-text' : 'text-ink-muted'}`}>{label}</div>
      <div className={`text-[18px] font-extrabold leading-tight tabular-nums ${good ? 'text-status-active-text' : 'text-ink'}`}>{value}</div>
    </div>
  )
}

function StrokeTag({ n }) {
  return <span className="ml-1 rounded-sm bg-status-active-bg px-1.5 py-px text-[11px] font-bold text-status-active-text">+{n}</span>
}

export default function TeeSheetPage({
  event, eventPlayers, tglSelections = [], matchupsByGroup = {}, groups, groupNums, allGroupCount,
  first = true, last = true, pageNum = 1, pageCount = 1, forPng = false,
}) {
  const league = event?.league ?? {}
  const eventName = event?.name ?? (event?.event_number ? `Event #${event.event_number}` : '')
  const isShotgun = event?.shotgun_start ?? false
  const interval = event?.tee_time_interval_mins ?? 10
  const holeMap = event?.group_hole_assignments ?? {}
  const dateLong = event?.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''
  const hasFlights = eventPlayers.some(ep => ep.flight === 'A' || ep.flight === 'B')
  const tglSet = tglSelections.length > 0 ? new Set(tglSelections.map(s => s.player_id)) : null
  const hasMatches = Object.keys(matchupsByGroup).length > 0
  const playerCount = eventPlayers.filter(ep => ep.group_number).length
  const gridCols = hasMatches ? cols : colsNoMatch
  const firstTee = teeTime12(event?.start_time, interval, 1)

  const tiles = (
    <div className="flex shrink-0 gap-2.5">
      <Tile label={isShotgun ? 'Shotgun start' : 'First tee'} value={firstTee ?? '—'} good />
      {!isShotgun && <Tile label="Interval" value={`${interval} min`} />}
      <Tile label="Field" value={`${allGroupCount} group${allGroupCount === 1 ? '' : 's'} · ${playerCount}`} />
    </div>
  )

  return (
    <div
      className="flex flex-col bg-white font-sans text-ink"
      style={{
        width: '11in', boxSizing: 'border-box', padding: '0.42in 0.5in',
        ...(forPng ? {} : { height: '8.5in', overflow: 'hidden' }),
        ...(last ? {} : { pageBreakAfter: 'always' }),
      }}
    >
      {first ? (
        <ExportHeader
          leagueName={league.name ?? ''}
          logoUrl={league.logo_url ?? null}
          logoSize={64}
          title={`Tee sheet · ${eventName}`}
          meta={[dateLong, event?.course?.name].filter(Boolean).join(' · ')}
          rightSlot={tiles}
        />
      ) : (
        <ExportHeader leagueName={league.name ?? ''} logoUrl={league.logo_url ?? null} title={`Tee sheet · ${eventName}`} compact />
      )}

      <section className="mt-4 rounded border border-surface-border bg-white px-4 pb-1 pt-3">
        <div className={`grid ${gridCols} items-end gap-x-4 border-b border-surface-border pb-2`}>
          <SmallHead>{isShotgun ? 'Start' : 'Tee time'}</SmallHead>
          <SmallHead>Group</SmallHead>
          <SmallHead>Players</SmallHead>
          {hasMatches && <SmallHead>Matches (strokes)</SmallHead>}
          <SmallHead>{isShotgun ? 'Hole' : 'Start'}</SmallHead>
        </div>
        {groupNums.map(g => {
          const members = groups[g] ?? []
          const time = isShotgun ? firstTee : teeTime12(event?.start_time, interval, g)
          const hole = isShotgun ? (holeMap[g] ? `Hole ${holeMap[g]}` : '—') : 'Hole 1'
          const matches = matchupsByGroup[g] ?? []
          return (
            <div key={g} className={`grid ${gridCols} items-center gap-x-4 border-b border-surface-border py-2.5 last:border-b-0`} style={{ breakInside: 'avoid' }}>
              <span className="text-[20px] font-extrabold leading-tight tabular-nums text-fairway-700">{time ?? '—'}</span>
              <span className="text-[13px] font-bold text-ink-muted">#{g}</span>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[13px] font-semibold">
                {members.map(ep => (
                  <span key={ep.id ?? ep.player_id} className="truncate">
                    {nameOf(ep)}
                    {hasFlights && <FlightTag flight={ep.flight} />}
                    {tglSet?.has(ep.player_id) && <span className="ml-1.5 inline-block h-[7px] w-[7px] rounded-full align-middle" style={{ background: GOLD }} aria-label="Team play" />}
                  </span>
                ))}
              </div>
              {hasMatches && (
                <div className="space-y-0.5 text-[12.5px]">
                  {matches.map((m, i) => (
                    <div key={i}>
                      <span className="font-semibold">{m.nameA}</span>{m.relA > 0 && <StrokeTag n={m.relA} />}
                      <span className="mx-1 text-ink-muted">vs</span>
                      <span className="font-semibold">{m.nameB}</span>{m.relB > 0 && <StrokeTag n={m.relB} />}
                    </div>
                  ))}
                </div>
              )}
              <span className="text-[13px] font-bold text-ink-muted">{hole}</span>
            </div>
          )
        })}
        {groupNums.length === 0 && <div className="py-12 text-center text-[13px] text-ink-muted">No groups assigned yet.</div>}
      </section>

      {last && (hasFlights || tglSet || hasMatches) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-ink-muted">
          {hasFlights && <><span><FlightTag flight="A" /> Flight A</span><span><FlightTag flight="B" /> Flight B</span></>}
          {tglSet && <span><span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-middle" style={{ background: GOLD }} />Playing team play this event</span>}
          {hasMatches && <span><b className="text-status-active-text">+N</b> strokes received</span>}
        </div>
      )}

      <div className="mt-auto">
        <ExportFooter
          left={`Printed ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}${pageCount > 1 ? ` · Page ${pageNum} of ${pageCount}` : ''}`}
        />
      </div>
    </div>
  )
}
