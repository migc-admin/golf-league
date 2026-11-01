/**
 * Small display helpers for the trip admin page: status, countdown and the four stat tiles.
 * Trips have no stored status, so it is worked out from the dates (nothing is saved).
 */
import { toISODate } from './tripSchedule'

const DAY = 86400000
const at = iso => new Date(`${iso}T00:00:00`)
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

export function tripStatus(trip, today = new Date()) {
  const now = at(toISODate(today))
  if (trip.start_date && now < at(trip.start_date)) return 'upcoming'
  const end = trip.end_date || trip.start_date
  if (end && now > at(end)) return 'complete'
  return trip.start_date ? 'active' : 'upcoming'
}

export function daysUntil(trip, today = new Date()) {
  if (!trip.start_date) return null
  return Math.round((at(trip.start_date) - at(toISODate(today))) / DAY)
}

export function nightsOf(trip) {
  if (!trip.start_date || !trip.end_date) return 0
  return Math.max(0, Math.round((at(trip.end_date) - at(trip.start_date)) / DAY))
}

const mmmD = iso => at(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export function dateRangeShort(trip) {
  if (!trip.start_date) return 'Dates TBD'
  if (!trip.end_date || trip.end_date === trip.start_date) return mmmD(trip.start_date)
  return `${mmmD(trip.start_date)} – ${mmmD(trip.end_date)}`
}

/** Tiles for StatTiles. `travelers` are trip_travelers rows; `rounds` are the trip's events. */
export function tripTiles({ trip, travelers, rounds }, today = new Date()) {
  const status = tripStatus(trip, today)
  const days = daysUntil(trip, today)
  const nights = nightsOf(trip)
  const startsIn = status === 'active' ? 'In progress' : status === 'complete' ? 'Complete' : days == null ? 'TBD' : plural(days, 'day')

  const guests = travelers.filter(t => !t.player_id).length
  const assigned = travelers.filter(t => t.room_number).length
  const unassigned = travelers.length - assigned
  const roomCount = new Set(travelers.filter(t => t.room_number).map(t => t.room_number)).size
  const roomHelper = travelers.length === 0 ? 'No travelers yet' : unassigned === 0 ? '✓ Everyone has a room' : `${unassigned} not in a room`
  const roomTone = travelers.length === 0 ? 'neutral' : unassigned === 0 ? 'good' : 'warn'

  const courses = [...new Set(rounds.map(r => r.course?.name).filter(Boolean))]

  return [
    { label: 'Starts in', value: startsIn, helper: `${plural(nights, 'night')} · ${dateRangeShort(trip)}` },
    { label: 'Travelers', value: travelers.length, helper: `${plural(travelers.length - guests, 'member')} · ${plural(guests, 'guest')}` },
    { label: 'Rooms', value: roomCount, helper: roomHelper, tone: roomTone },
    { label: 'Rounds', value: rounds.length, helper: courses.length ? courses.join(', ') : 'No rounds yet' },
  ]
}

// ─── Public trip page ─────────────────────────────────────────────

const dayFmt = (iso, withYear) => at(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}) })

// "St. George Regional Airport" -> "St. George Regional", "Las Vegas International" -> "Las Vegas".
export function airportShortName(name) {
  const n = String(name ?? '').replace(/\s+airport\s*$/i, '').trim()
  return n.replace(/\s+(international|intl\.?|regional|municipal)\s*$/i, '').trim() || n
}
export const airportRowName = name => String(name ?? '').replace(/\s+airport\s*$/i, '').trim()
export const shortDistance = d => String(d ?? '').replace(/\bmiles?\b/i, 'mi').trim()

const orList = codes => (codes.length <= 1 ? codes.join('') : `${codes.slice(0, -1).join(', ')} or ${codes[codes.length - 1]}`)

/** The hero's three fact rows. A row is null when the trip has nothing for it. */
export function heroFacts({ trip, rounds = [] }) {
  const start = trip.start_date, end = trip.end_date
  let dates = null
  if (start || end) {
    const nights = nightsOf(trip)
    const sub = [nights > 0 ? plural(nights, 'night') : null, plural(rounds.length, 'round')].filter(Boolean).join(' · ')
    const line = start && end && start !== end ? `${dayFmt(start)} – ${dayFmt(end, true)}` : dayFmt(start || end, true)
    dates = { title: line, sub }
  }

  const l = trip.lodging && typeof trip.lodging === 'object' ? trip.lodging : {}
  const lodging = l.name ? { title: l.name, city: l.address || '' } : null

  const airports = (Array.isArray(trip.nearest_airports) ? trip.nearest_airports : []).filter(a => a.code || a.name)
  let fly = null
  if (airports.length > 0) {
    const codes = airports.map(a => a.code).filter(Boolean)
    fly = {
      title: codes.length ? `Fly into ${orList(codes)}` : `Fly into ${orList(airports.map(a => airportShortName(a.name)))}`,
      sub: airports.map(a => [airportShortName(a.name), shortDistance(a.distance)].filter(Boolean).join(' ')).join(' · '),
    }
  }
  return { dates, lodging, fly }
}

/** "Day 3 of 5" while the trip is on. */
export function dayOfTrip(trip, today = new Date()) {
  if (!trip.start_date) return null
  const total = trip.end_date ? Math.round((at(trip.end_date) - at(trip.start_date)) / DAY) + 1 : 1
  const day = Math.round((at(toISODate(today)) - at(trip.start_date)) / DAY) + 1
  return { day: Math.min(Math.max(day, 1), total), total }
}

/** Two-letter avatar initials: "Andy Pendleton" -> "AP", "Guest 1" -> "G1". */
export function initials(name) {
  const words = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}
