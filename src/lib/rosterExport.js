// CSV of an event's roster in the same columns the roster import reads
// (first_name, last_name, handicap_index, flight, course_handicap), so the file can be filled in
// and uploaded back to set flights and handicaps. Pure functions.
//
// The import's CSV reader splits on plain commas and has no byte-order-mark handling, so cells are
// never quoted and the file has no BOM; commas inside a name are turned into spaces.

import { sortRoster } from '../components/ui/RosterCard'

export const ROSTER_HEADERS = ['first_name', 'last_name', 'handicap_index', 'flight', 'course_handicap']

const text = v => String(v ?? '').replace(/[,\r\n"]+/g, ' ').replace(/\s+/g, ' ').trim()

// handicap_index is NOT NULL in the database and 0 is the "not entered yet" placeholder
const hi = ep => {
  const n = Number(ep.handicap_index)
  return ep.handicap_index == null || !Number.isFinite(n) || n === 0 ? '' : String(n)
}

const whole = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? '' : String(Math.round(Number(v))))

/** One row per player on the event, first name A to Z. Blank cells where a value isn't set yet. */
export function rosterToCsv(players) {
  const lines = [ROSTER_HEADERS.join(',')]
  for (const ep of sortRoster(players)) {
    lines.push([
      text(ep.player?.first_name),
      text(ep.player?.last_name),
      hi(ep),
      ep.is_guest ? '' : text(ep.flight),
      whole(ep.course_handicap),
    ].join(','))
  }
  return lines.join('\n') + '\n'
}

/** "roster-event-11.csv" style file name from whatever label the event has. */
export function rosterFileName(label) {
  const slug = String(label ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return `roster-${slug || 'event'}.csv`
}
