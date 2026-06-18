import { supabase } from './supabase'

/**
 * Fetches all data needed to generate scorecards for an event.
 * Returns { groups, course, event_config } shaped for api/generate_scorecard.
 */
export async function fetchScorecardData(eventId) {
  // 1. Event + course in one query
  const { data: event, error: evErr } = await supabase
    .from('events')
    .select('id, name, event_number, event_date, start_time, tee_time_interval_mins, long_drive_hole, ctp_holes, include_putts, use_flights, course:courses(par_per_hole, stroke_index, tees)')
    .eq('id', eventId)
    .single()
  if (evErr) throw evErr

  const course = event.course
  if (!course) throw new Error('No course attached to this event')

  // 2. Players in this event ordered by group_number
  const { data: players, error: pErr } = await supabase
    .from('event_players')
    .select('player_id, group_number, flight, course_handicap, tee, player:players(first_name, last_name)')
    .eq('event_id', eventId)
    .order('group_number')
    .order('adjusted_handicap_index')
  if (pErr) throw pErr

  // 3. Build groups — compute tee time from event start_time + interval
  const intervalMins = event.tee_time_interval_mins ?? 10
  function computeTeeTime(groupNum) {
    if (!event.start_time) return ''
    const [h, m] = event.start_time.split(':').map(Number)
    const total = h * 60 + m + (groupNum - 1) * intervalMins
    const hh = Math.floor(total / 60) % 24
    const mm = total % 60
    const ampm = hh >= 12 ? 'PM' : 'AM'
    const h12 = hh % 12 || 12
    return `${h12}:${mm.toString().padStart(2, '0')} ${ampm}`
  }

  // Determine default tee — use tee_flight_a from event if stored, else first tee
  const defaultTee = course.tees?.[0]?.name?.toUpperCase() ?? 'YELLOW'

  const groupMap = {}
  for (const ep of players) {
    const g = ep.group_number
    if (!g) continue
    if (!groupMap[g]) groupMap[g] = { num: g, time: computeTeeTime(g), players: [] }
    const firstName = ep.player?.first_name ?? ''
    const lastName  = ep.player?.last_name  ?? ''
    groupMap[g].players.push({
      name:            `${firstName} ${lastName}`.trim() || `Player ${ep.player_id.slice(0, 6)}`,
      flight:          ep.flight ?? 'A',
      course_handicap: ep.course_handicap ?? 0,
      tee:             (ep.tee ?? defaultTee).toUpperCase(),
    })
  }

  const groups = Object.values(groupMap).sort((a, b) => a.num - b.num)

  if (groups.length === 0) throw new Error('No players assigned to groups yet')

  // 4. Format event date
  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const eventName = event.name ?? `Event #${event.event_number}`

  // 5. CTP holes — prefer new ctp_holes column, fall back to payout_config keys
  let ctpHoles = event.ctp_holes ?? null

  // Normalize tees — ensure yardages key matches what the Python expects
  const normalizedTees = (course.tees ?? []).map(t => ({
    name:     t.name,
    rating:   t.rating,
    slope:    t.slope,
    yardages: t.yardage ?? t.yardages ?? [],
  }))

  return {
    groups,
    course: {
      par_per_hole: course.par_per_hole,
      stroke_index: course.stroke_index,
      tees:         normalizedTees,
    },
    event_config: {
      name:            eventName,
      date:            eventDate,
      long_drive_hole: event.long_drive_hole ?? null,
      ctp_holes:       ctpHoles,
      include_putts:   event.include_putts ?? false,
    },
  }
}
