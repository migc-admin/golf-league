import { describe, it, expect } from 'vitest'
import { buildItinerary, timeToMinutes, time12, itineraryItems } from './tripItinerary'
import { tripTiles, tripStatus, daysUntil } from './tripView'

// The real Sand Valley 2026 data shape.
const trip = {
  start_date: '2026-09-10', end_date: '2026-09-14',
  itinerary: [
    { date: '2026-09-11', text: 'Check in begins at 3:00 p.m.\nDinner\nWhiskey Tasting' },
    { date: '2026-09-12', text: 'Breakfast\nGolf at X\nDinner\nPoker' },
    { date: '2026-09-14', text: 'Breakfast\nCheck out' },
  ],
  lodging: { name: 'Zion Canyon Mist Resort House', address: 'Hurricane, UT', checkin_date: '2026-09-11', checkin_time: '15:00', checkout_date: '2026-09-14', checkout_time: '10:00' },
  meals: [
    { date: '2026-09-11', name: 'Dinner', time: '17:00', venue: 'Mexian Cantina', location: '460 State Stree' },
    { date: '2026-09-12', name: 'Dinner', time: '18:00', venue: "Bob's Burgers", location: '100 State Street' },
    { date: '2026-09-13', name: 'Breakfast', time: '08:00', venue: 'Country Inn', location: '155 State Street' },
  ],
  social_events: [
    { date: '2026-09-11', name: 'Whiskey Tasting', time: '', venue: '', location: '460 State Stree' },
    { date: '2026-09-12', name: 'Poker', time: '', venue: '', location: '' },
  ],
}
const rounds = [
  { event_date: '2026-09-11', start_time: '09:30:00', name: 'Sand Hollow', course: { name: 'Sand Hollow Resort Championship' } },
  { event_date: '2026-09-12', start_time: '11:30:00', name: 'Copper Rock', course: { name: 'Copper Rock Golf Course' } },
]

describe('time helpers', () => {
  it('parses and formats', () => {
    expect(timeToMinutes('15:00')).toBe(900)
    expect(timeToMinutes('09:30:00')).toBe(570)
    expect(timeToMinutes('7:00 PM')).toBe(1140)
    expect(timeToMinutes('')).toBe(null)
    expect(time12('15:00')).toBe('3:00 PM')
    expect(time12('00:05')).toBe('12:05 AM')
  })
})

describe('buildItinerary', () => {
  const days = buildItinerary({ trip, rounds })
  const day = d => days.find(x => x.date === d)

  it('has one block per trip day, including empty ones', () => {
    expect(days.map(d => d.date)).toEqual(['2026-09-10', '2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14'])
    expect(day('2026-09-10').items).toEqual([])
  })

  it('includes every structured item exactly once', () => {
    const tags = d => day(d).items.filter(i => i.tag).map(i => `${i.tag}:${i.title}`)
    expect(tags('2026-09-11').sort()).toEqual(['GOLF:Sand Hollow', 'MEAL:Dinner · Mexian Cantina', 'SOCIAL:Whiskey Tasting', 'STAY:Check-in · Zion Canyon Mist Resort House'])
    const all = days.flatMap(d => d.items.filter(i => i.tag))
    expect(all.filter(i => i.tag === 'GOLF').length).toBe(2)
    expect(all.filter(i => i.tag === 'MEAL').length).toBe(3)
    expect(all.filter(i => i.tag === 'SOCIAL').length).toBe(2)
    expect(all.filter(i => i.tag === 'STAY').length).toBe(2)
  })

  it('sorts timed items by time, untimed after', () => {
    expect(day('2026-09-11').items.map(i => i.title)).toEqual([
      'Sand Hollow', 'Check-in · Zion Canyon Mist Resort House', 'Dinner · Mexian Cantina', 'Whiskey Tasting', 'Check in begins at 3:00 p.m.',
    ])
  })

  it('hides free-text lines that duplicate a structured item and keeps the rest untagged', () => {
    expect(day('2026-09-12').items.map(i => i.title)).toEqual(['Copper Rock', 'Dinner · Bob\'s Burgers', 'Poker', 'Breakfast', 'Golf at X'])
    expect(day('2026-09-12').items.filter(i => !i.tag).map(i => i.title)).toEqual(['Breakfast', 'Golf at X'])
    expect(day('2026-09-14').items.filter(i => !i.tag).map(i => i.title)).toEqual(['Breakfast', 'Check out'])
  })

  it('puts items without a date in a trailing block', () => {
    const d = buildItinerary({ trip: { ...trip, meals: [{ name: 'Lunch', date: '' }] }, rounds: [] })
    expect(d[d.length - 1]).toMatchObject({ date: null })
    expect(itineraryItems({ trip: { meals: [{ name: 'Lunch' }] } })[0].tag).toBe('MEAL')
  })
})

describe('trip tiles', () => {
  const travelers = [
    { player_id: 'a', room_number: 1 }, { player_id: 'b', room_number: 1 }, { player_id: null, room_number: null },
  ]
  const before = new Date('2026-08-30T12:00:00')
  it('computes status and countdown from dates', () => {
    expect(tripStatus(trip, before)).toBe('upcoming')
    expect(daysUntil(trip, before)).toBe(11)
    expect(tripStatus(trip, new Date('2026-09-12T12:00:00'))).toBe('active')
    expect(tripStatus(trip, new Date('2026-10-30T12:00:00'))).toBe('complete')
  })
  it('builds the four tiles', () => {
    const [starts, trav, rooms, rnds] = tripTiles({ trip, travelers, rounds }, before)
    expect(starts).toMatchObject({ value: '11 days', helper: '4 nights · Sep 10 – Sep 14' })
    expect(trav).toMatchObject({ value: 3, helper: '2 members · 1 guest' })
    expect(rooms).toMatchObject({ value: 1, helper: '1 not in a room', tone: 'warn' })
    expect(rnds.helper).toBe('Sand Hollow Resort Championship, Copper Rock Golf Course')
    const all = tripTiles({ trip, travelers: travelers.slice(0, 2), rounds }, before)[2]
    expect(all).toMatchObject({ helper: '✓ Everyone has a room', tone: 'good' })
  })
})

import { heroFacts, dayOfTrip, initials, airportShortName, shortDistance } from './tripView'

describe('public trip hero helpers', () => {
  const t = {
    start_date: '2026-09-10', end_date: '2026-09-14',
    lodging: { name: 'Zion Canyon Mist Resort House', address: 'Hurricane, UT' },
    nearest_airports: [{ code: 'SGU', name: 'St. George Regional Airport', distance: '23 miles' }, { code: 'LAS', name: 'Las Vegas Interational', distance: '144 miles' }],
  }
  it('builds the three fact rows', () => {
    const f = heroFacts({ trip: t, rounds: [{}, {}] })
    expect(f.dates).toEqual({ title: 'Thu, Sep 10 – Mon, Sep 14, 2026', sub: '4 nights · 2 rounds' })
    expect(f.lodging).toEqual({ title: 'Zion Canyon Mist Resort House', city: 'Hurricane, UT' })
    expect(f.fly).toEqual({ title: 'Fly into SGU or LAS', sub: 'St. George 23 mi · Las Vegas Interational 144 mi' })
  })
  it('hides rows with no data', () => {
    expect(heroFacts({ trip: { start_date: null, end_date: null } })).toEqual({ dates: null, lodging: null, fly: null })
  })
  it('formats helpers', () => {
    expect(airportShortName('Las Vegas International')).toBe('Las Vegas')
    expect(shortDistance('144 miles')).toBe('144 mi')
    expect(initials('Andy Pendleton')).toBe('AP')
    expect(initials('Guest 1')).toBe('G1')
    expect(dayOfTrip(t, new Date('2026-09-12T12:00:00'))).toEqual({ day: 3, total: 5 })
  })
})
