import { describe, it, expect } from 'vitest'
import { computeLeaderboards } from './engines/scoring'
import {
  ordinal, formatClock, teeInfo, pickCurrentEvent, recentCompleted,
  summarizeResult, handicapSummary, eventUrls, localToday,
} from './playerProfile'

const row = (id, status, date, extra = {}) => ({ event_id: id, group_number: 1, event: { id, status, event_date: date, ...extra.event }, ...extra.row })

describe('ordinal / formatClock', () => {
  it('formats places', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 103].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '103rd'])
  })
  it('formats clock times', () => {
    expect(formatClock('09:50:00')).toBe('9:50 AM')
    expect(formatClock('13:05:00')).toBe('1:05 PM')
    expect(formatClock('00:10:00')).toBe('12:10 AM')
    expect(formatClock(null)).toBeNull()
  })
})

describe('teeInfo', () => {
  const ev = { start_time: '09:50:00', tee_time_interval_mins: 10 }
  it('staggers tee times by group and starts on hole 1', () => {
    expect(teeInfo(ev, 1)).toMatchObject({ time: '9:50 AM', hole: '1' })
    expect(teeInfo(ev, 3)).toMatchObject({ time: '10:10 AM', hole: '1' })
  })
  it('uses the shotgun start time and the group\'s starting hole', () => {
    const shot = { ...ev, shotgun_start: true, group_hole_assignments: { 4: 12 } }
    expect(teeInfo(shot, 4)).toMatchObject({ time: '9:50 AM', hole: '12', shotgun: true })
  })
  it('returns blanks without a group or start time', () => {
    expect(teeInfo(ev, null)).toEqual({ time: null, hole: null })
    expect(teeInfo({}, 2)).toEqual({ time: null, hole: null })
  })
})

describe('pickCurrentEvent', () => {
  it('prefers an active event the player is grouped in', () => {
    const rows = [row('u', 'upcoming', '2026-11-01'), row('a', 'active', '2026-10-25'), row('c', 'complete', '2026-09-01')]
    expect(pickCurrentEvent(rows, '2026-10-25')).toMatchObject({ kind: 'active', row: { event_id: 'a' } })
  })
  it('ignores an active event the player has no group in', () => {
    const rows = [row('a', 'active', '2026-10-25', { row: { group_number: null } }), row('u', 'upcoming', '2026-11-01')]
    expect(pickCurrentEvent(rows, '2026-10-25').row.event_id).toBe('u')
  })
  it('picks the soonest upcoming event on or after today', () => {
    const rows = [row('later', 'upcoming', '2026-12-01'), row('soon', 'upcoming', '2026-11-01'), row('old', 'upcoming', '2026-01-01')]
    expect(pickCurrentEvent(rows, '2026-10-24').row.event_id).toBe('soon')
  })
  it('returns null when there is nothing active or upcoming', () => {
    expect(pickCurrentEvent([row('c', 'complete', '2026-09-01')], '2026-10-24')).toBeNull()
    expect(pickCurrentEvent([], '2026-10-24')).toBeNull()
  })
})

describe('localToday', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(localToday(new Date(2026, 9, 5))).toBe('2026-10-05')
  })
})

describe('recentCompleted', () => {
  it('returns completed events newest first, limited', () => {
    const rows = [row('a', 'complete', '2026-06-01'), row('b', 'complete', '2026-09-01'), row('c', 'upcoming', '2026-11-01'), row('d', 'complete', '2026-08-01')]
    expect(recentCompleted(rows, 2).map(r => r.event_id)).toEqual(['b', 'd'])
  })
})

describe('summarizeResult', () => {
  const course = { stroke_index: Array.from({ length: 18 }, (_, i) => i + 1), par_per_hole: Array.from({ length: 18 }, () => 4) }
  const ep = (id, ch) => ({ player_id: id, course_handicap: ch, flight: 'A', tee: null, is_guest: false, player: { first_name: id, last_name: '' } })
  const flat = (id, g) => Array.from({ length: 18 }, (_, i) => ({ player_id: id, hole_number: i + 1, gross_score: g }))

  it('reports place, field size, net and gross, with T for ties', () => {
    // p1 net 72-0, p2 net 90-18=72 (tie), p3 net 100
    const lb = computeLeaderboards([ep('p1', 0), ep('p2', 18), ep('p3', 0)], [...flat('p1', 4), ...flat('p2', 5), ...flat('p3', 5.5 | 0)], course)
    const me = summarizeResult(lb, 'p2')
    expect(me).toMatchObject({ place: 'T1', fieldSize: 3, net: 72, gross: 90, flight: 'A' })
    expect(summarizeResult(lb, 'p3').place).toBe('3rd')
  })
  it('is null when the player did not finish 18 holes', () => {
    const lb = computeLeaderboards([ep('p1', 0), ep('p2', 0)], [...flat('p1', 4), ...flat('p2', 4).slice(0, 9)], course)
    expect(summarizeResult(lb, 'p2')).toBeNull()
  })
})

describe('handicapSummary', () => {
  it('uses the featured event, treating a 0 index as not entered', () => {
    const current = { kind: 'upcoming', row: { course_handicap: 14, handicap_index: 0, adjusted_handicap_index: 0, event: { name: 'Playoffs' } } }
    expect(handicapSummary(current, [])).toEqual({ courseHandicap: 14, index: null, eventName: 'Playoffs' })
  })
  it('falls back to the latest completed event', () => {
    const done = [{ course_handicap: 9, adjusted_handicap_index: 8.4, event: { name: 'San Vicente' } }]
    expect(handicapSummary(null, done)).toEqual({ courseHandicap: 9, index: 8.4, eventName: 'San Vicente' })
  })
  it('is null with no events', () => {
    expect(handicapSummary(null, [])).toBeNull()
  })
})

describe('eventUrls', () => {
  const event = { id: 'e1', slug: 'playoffs', status: 'upcoming', league: { slug: 'mi', org_id: 'ORG', org: { slug: 'migc' } } }
  it('builds the public leaderboard and scorecard links', () => {
    const u = eventUrls(event, 'ORG')
    expect(u.leaderboard).toBe('/migc/mi/playoffs/leaderboard?eid=e1')
    expect(u.scorecard).toBe('/migc/mi/playoffs/scorecard?eid=e1')
  })
  it('offers the wager board only for the Mulligan\'s Island org and unfinished events', () => {
    expect(eventUrls(event, 'ORG').wager).toBe('/wager/e1')
    expect(eventUrls(event, 'OTHER').wager).toBeNull()
    expect(eventUrls({ ...event, status: 'complete' }, 'ORG').wager).toBeNull()
  })
})
