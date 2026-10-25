/**
 * Helpers for the player profile page (the page an NFC tag / QR code opens).
 * Pure functions so the event-picking and result-summary logic can be unit tested.
 */

export function ordinal(n) {
  const v = n % 100
  if (v >= 11 && v <= 13) return `${n}th`
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] ?? 'th'}`
}

/** '09:50:00' -> '9:50 AM' */
export function formatClock(time) {
  if (!time) return null
  const [h, m] = String(time).split(':').map(Number)
  if (Number.isNaN(h)) return null
  return `${h % 12 || 12}:${String(m ?? 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Tee time and starting hole for a group in an event. */
export function teeInfo(event, groupNumber) {
  if (!event?.start_time || groupNumber == null) return { time: null, hole: null }
  const [h, m] = event.start_time.split(':').map(Number)
  if (event.shotgun_start) {
    const hole = event.group_hole_assignments?.[groupNumber] ?? null
    return { time: formatClock(event.start_time), hole: hole ? String(hole) : null, shotgun: true }
  }
  const total = h * 60 + m + (groupNumber - 1) * (event.tee_time_interval_mins ?? 10)
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return { time: formatClock(`${hh}:${mm}`), hole: '1', shotgun: false }
}

/**
 * Picks the event a player's profile should feature, from their event_players
 * rows (each with an embedded `event`).
 *   - an active event they are grouped in wins ("Today"),
 *   - otherwise their next upcoming event, soonest first.
 * Returns { kind: 'active' | 'upcoming', row } or null.
 */
export function pickCurrentEvent(rows, today = new Date().toISOString().slice(0, 10)) {
  const byDate = (a, b) => (a.event.event_date ?? '9999').localeCompare(b.event.event_date ?? '9999')
  const active = rows
    .filter(r => r.event?.status === 'active' && r.group_number != null)
    .sort((a, b) => byDate(b, a))
  if (active.length) return { kind: 'active', row: active[0] }

  const upcoming = rows.filter(r => r.event?.status === 'upcoming').sort(byDate)
  const next = upcoming.find(r => (r.event.event_date ?? '9999') >= today) ?? upcoming[0]
  return next ? { kind: 'upcoming', row: next } : null
}

/** Today's date as YYYY-MM-DD in the viewer's local time. */
export function localToday(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** The player's most recent completed events, newest first. */
export function recentCompleted(rows, limit = 5) {
  return rows
    .filter(r => r.event?.status === 'complete')
    .sort((a, b) => (b.event.event_date ?? '').localeCompare(a.event.event_date ?? ''))
    .slice(0, limit)
}

/**
 * Where a player finished, from computeLeaderboards() output (net, 18 holes).
 * Returns null if they did not complete 18 holes.
 */
export function summarizeResult(leaderboards, playerId) {
  for (const flightKey of ['A', 'B']) {
    const list = leaderboards?.full?.[flightKey] ?? []
    const me = list.find(p => p.player_id === playerId)
    if (!me) continue
    const tied = list.filter(p => p.rank === me.rank).length > 1
    return {
      rank: me.rank,
      place: tied ? `T${me.rank}` : ordinal(me.rank),
      fieldSize: list.length,
      flight: me.flight ?? null,
      net: me.net18,
      gross: me.gross18,
      netVsPar: me.netVsPar,
    }
  }
  return null
}

/** Handicap numbers to show: from the featured event, else the latest completed one. */
export function handicapSummary(current, completed) {
  const row = current?.row ?? completed[0] ?? null
  if (!row) return null
  // handicap_index of 0 is the app's "not entered yet" placeholder
  const index = [row.adjusted_handicap_index, row.handicap_index].find(v => v != null && Number(v) !== 0) ?? null
  return {
    courseHandicap: row.course_handicap ?? null,
    index: index != null ? Number(index) : null,
    eventName: row.event?.name ?? null,
  }
}

export function eventTitle(event) {
  return event?.name ?? (event?.event_number ? `Event #${event.event_number}` : 'Event')
}

/** Public URLs for an event, matching the routes used elsewhere in the app. */
export function eventUrls(event, migcOrgId) {
  const orgSlug    = event.league?.org?.slug ?? event.league?.slug ?? 'org'
  const leagueSlug = event.league?.slug ?? 'league'
  const eventSlug  = event.slug ?? event.id
  const base = `/${orgSlug}/${leagueSlug}/${eventSlug}`
  return {
    leaderboard: `${base}/leaderboard?eid=${event.id}`,
    scorecard:   `${base}/scorecard?eid=${event.id}`,
    wager:       migcOrgId && event.league?.org_id === migcOrgId && event.status !== 'complete' ? `/wager/${event.id}` : null,
  }
}
