import { describe, it, expect, vi } from 'vitest'

vi.mock('./engines/scoring', () => ({
  computeLeaderboards: (eps) => ({
    full: {
      A: eps.filter(e => e.flight === 'A').map(e => ({ ...e, grossF9: 40, grossB9: 41, gross18: 81, net18: 74, totalPutts: e.putts ?? null, course_handicap: 7 })),
      B: eps.filter(e => e.flight === 'B').map(e => ({ ...e, grossF9: 50, grossB9: 52, gross18: 102, net18: 80, totalPutts: null, course_handicap: 22 })),
    },
  }),
}))

import { playerScoringRows, sortScoringRows, filterScoringRows, scoringFilterOptions } from './playerScoring'

const ep = (id, first, flight, putts) => ({ player_id: id, flight, putts, player: { first_name: first, last_name: 'X' } })
const ev = (id, name, date) => ({ id, name, event_date: date, course: { par_per_hole: [4] } })
const scores = [{ player_id: 'x' }]

const rows = () => playerScoringRows({
  events: [ev('e1', 'CCRB', '2026-08-02'), ev('e2', 'Native Oaks', '2026-06-28'), { id: 'e3', name: 'No course', course: null }],
  epsByEvent: { e1: [ep('b', 'Bo', 'B'), ep('a', 'Ann', 'A', 30)], e2: [ep('a', 'Ann', 'A')], e3: [ep('a', 'Ann', 'A')] },
  scoresByEvent: { e1: scores, e2: scores, e3: scores },
})

describe('playerScoringRows', () => {
  it('has one row per player per scored event, sorted by player then date', () => {
    const r = rows()
    expect(r.map(x => [x.player, x.event])).toEqual([['Ann X', 'Native Oaks'], ['Ann X', 'CCRB'], ['Bo X', 'CCRB']])
  })
  it('carries handicap, gross, net, nines and putts', () => {
    const r = rows().find(x => x.player === 'Bo X')
    expect([r.flight, r.hcp, r.gross, r.net, r.front9, r.back9, r.putts]).toEqual(['B', 22, 102, 80, 50, 52, null])
    expect(rows().find(x => x.player === 'Ann X' && x.event === 'CCRB').putts).toBe(30)
  })
})

describe('sort and filter', () => {
  it('sorts numbers and text in either direction and keeps empty values last', () => {
    const r = rows()
    expect(sortScoringRows(r, 'gross', 'desc')[0].player).toBe('Bo X')
    expect(sortScoringRows(r, 'putts', 'asc')[0].putts).toBe(30)
    expect(sortScoringRows(r, 'putts', 'desc')[0].putts).toBe(30)
    expect(sortScoringRows(r, 'event', 'asc')[0].event).toBe('CCRB')
  })
  it('filters by event and player', () => {
    const r = rows()
    expect(filterScoringRows(r, { eventId: 'e1' })).toHaveLength(2)
    expect(filterScoringRows(r, { playerId: 'a' })).toHaveLength(2)
    expect(filterScoringRows(r, { eventId: 'e1', playerId: 'a' })).toHaveLength(1)
    expect(filterScoringRows(r, {})).toHaveLength(3)
  })
  it('builds the filter lists', () => {
    const o = scoringFilterOptions(rows())
    expect(o.players.map(p => p.label)).toEqual(['Ann X', 'Bo X'])
    expect(o.events.map(e => e.label)).toEqual(['Native Oaks', 'CCRB'])
  })
})
