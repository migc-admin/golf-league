/**
 * The trip itinerary as plain data: one block per day, every item from every existing source
 * (rounds, meals, social events, lodging check-in / check-out and the free-text day-by-day lines).
 * Nothing is stored or changed; this only re-arranges what the trip already has.
 *
 * Item: { key, tag: 'GOLF' | 'MEAL' | 'SOCIAL' | 'STAY' | null, time: 'HH:MM' | '', title, sub }
 * Day:  { date: 'YYYY-MM-DD' | null, items: [Item] }
 */
import { enumerateDays } from './tripSchedule'

const ISO = /^\d{4}-\d{2}-\d{2}$/

// 'HH:MM', 'HH:MM:SS' or '7:00 PM' -> minutes after midnight, or null.
export function timeToMinutes(time) {
  if (!time) return null
  const t = String(time).trim()
  let m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  m = t.match(/^(\d{1,2}):(\d{2})\s*([AaPp])\.?[Mm]?\.?$/)
  if (m) return (Number(m[1]) % 12 + (m[3].toLowerCase() === 'p' ? 12 : 0)) * 60 + Number(m[2])
  return null
}

// '15:00' / '09:30:00' / '7:00 PM' -> '3:00 PM' (anything unparseable is returned as typed).
export function time12(time) {
  const mins = timeToMinutes(time)
  if (mins == null) return time ? String(time).trim() : ''
  const h = Math.floor(mins / 60)
  return `${h % 12 === 0 ? 12 : h % 12}:${String(mins % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

const norm = s => String(s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const clean = s => (s == null ? '' : String(s).trim())

export function itineraryItems({ trip, rounds = [] }) {
  const items = []
  let n = 0
  const add = (date, item) => items.push({ date: ISO.test(date ?? '') ? date : null, ...item, key: `${item.tag ?? 'text'}-${n++}` })

  rounds.forEach(r => add(r.event_date, {
    tag: 'GOLF', time: clean(r.start_time), title: r.name || `Round ${r.event_number ?? ''}`.trim(), sub: r.course?.name ?? '',
  }))

  ;(Array.isArray(trip.meals) ? trip.meals : []).forEach(m => {
    const name = clean(m.name) || 'Meal'
    const place = clean(m.venue)
    add(m.date, { tag: 'MEAL', time: clean(m.time), title: place ? `${name} · ${place}` : name, sub: clean(m.location), alias: name })
  })

  ;(Array.isArray(trip.social_events) ? trip.social_events : []).forEach(s => {
    add(s.date, { tag: 'SOCIAL', time: clean(s.time), title: clean(s.name) || 'Social event', sub: [clean(s.venue), clean(s.location)].filter(Boolean).join(' · ') })
  })

  const lodging = trip.lodging && typeof trip.lodging === 'object' ? trip.lodging : {}
  if (lodging.checkin_date) add(lodging.checkin_date, { tag: 'STAY', time: clean(lodging.checkin_time), title: `Check-in${lodging.name ? ` · ${lodging.name}` : ''}`, sub: clean(lodging.address) })
  if (lodging.checkout_date) add(lodging.checkout_date, { tag: 'STAY', time: clean(lodging.checkout_time), title: `Check-out${lodging.name ? ` · ${lodging.name}` : ''}`, sub: clean(lodging.address) })

  // Free text: one untagged line per non-empty line. A line identical to a structured item on the
  // same day (by its title, or a meal's bare name such as "Dinner") is hidden as a duplicate.
  const structured = new Set()
  items.forEach(i => { structured.add(`${i.date}|${norm(i.title)}`); if (i.alias) structured.add(`${i.date}|${norm(i.alias)}`) })
  ;(Array.isArray(trip.itinerary) ? trip.itinerary : []).forEach(entry => {
    const date = entry.date || null
    const lines = clean(entry.text).split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length === 0 && !date) return
    lines.forEach(line => {
      if (structured.has(`${date}|${norm(line)}`)) return
      add(date, { tag: null, time: '', title: line, sub: '' })
    })
  })
  return items
}

export function buildItinerary({ trip, rounds = [] }) {
  const items = itineraryItems({ trip, rounds })
  const byDate = new Map()
  items.forEach(i => { const k = i.date ?? ''; if (!byDate.has(k)) byDate.set(k, []); byDate.get(k).push(i) })

  const dates = new Set(enumerateDays(trip.start_date, trip.end_date))
  items.forEach(i => { if (i.date) dates.add(i.date) })

  // Timed items first by time; everything without a time keeps its source order after them.
  const order = list => {
    const withIdx = list.map((item, idx) => ({ item, idx, mins: timeToMinutes(item.time) }))
    withIdx.sort((a, b) => {
      if (a.mins != null && b.mins != null) return a.mins - b.mins || a.idx - b.idx
      if (a.mins != null) return -1
      if (b.mins != null) return 1
      return a.idx - b.idx
    })
    return withIdx.map(x => x.item)
  }

  const days = [...dates].sort().map(date => ({ date, items: order(byDate.get(date) ?? []) }))
  if (byDate.has('')) days.push({ date: null, items: order(byDate.get('')) })
  return days
}
