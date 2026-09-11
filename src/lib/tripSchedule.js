// Display helpers for trip scheduled entries (meals, social events).
// Entries are { date: 'YYYY-MM-DD', time: 'HH:MM', name, location }. Legacy rows
// stored a freeform `day` string and a 12-hour `time`, so both are tolerated here.

export function fmtShortDay(d) {
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function formatDisplayTime(time) {
  if (!time) return ''
  const t = String(time).trim()
  const m = t.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return t
  const hour = Number(m[1])
  const suffix = hour >= 12 ? 'PM' : 'AM'
  return `${hour % 12 === 0 ? 12 : hour % 12}:${m[2]} ${suffix}`
}

export function formatScheduledDay(entry) {
  if (entry.date) return fmtShortDay(entry.date)
  return entry.day || ''
}

// Itinerary entries use an ISO `date`; legacy rows used a freeform `label`.
export function formatItineraryDay(entry) {
  if (entry.date) return fmtShortDay(entry.date)
  return entry.label || ''
}

// Venue and street address, when both are present.
export function formatScheduledPlace(entry) {
  return [entry.venue, entry.location].filter(Boolean).join(' · ')
}

export function formatScheduledWhen(entry) {
  return [formatScheduledDay(entry), formatDisplayTime(entry.time)].filter(Boolean).join(' · ')
}

// Inclusive list of ISO dates between start and end (both 'YYYY-MM-DD').
export function enumerateDays(start, end) {
  if (!start) return []
  const days = []
  const last = end || start
  const cursor = new Date(start + 'T00:00:00')
  const stop = new Date(last + 'T00:00:00')
  while (cursor <= stop && days.length < 60) {
    days.push(toISODate(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

export function toISODate(date) {
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${mm}-${dd}`
}
