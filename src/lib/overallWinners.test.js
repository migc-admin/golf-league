import { describe, it, expect, vi } from 'vitest'

// Leaderboards are replaced by fixed ranks so only the tallying is tested.
vi.mock('./engines/scoring', () => ({
  computeLeaderboards: (eps) => {
    const mk = (flight) => eps.filter(e => e.flight === flight).map(e => ({ player_id: e.player_id, player: e.player, rank: e.rank, net18: e.net18, netVsPar: e.netVsPar }))
    return { full: { A: mk('A'), B: mk('B') } }
  },
}))

import { overallWinners, placeGroups } from './overallWinners'

const P = (id, first, flight, rank) => ({ player_id: id, flight, rank, net18: 70 + rank, netVsPar: -2, player: { first_name: first, last_name: 'X' } })
const course = { par_per_hole: [4] }
const ev = (id, date = '2026-06-01') => ({ id, course, name: `Event ${id}`, event_date: date })

describe('placeGroups', () => {
  it('orders by 1sts then 2nds then 3rds and shares places for equal counts', () => {
    const rows = placeGroups({
      a: { id: 'a', name: 'Ann', finishes: [], first: 1, second: 1, third: 0 },
      b: { id: 'b', name: 'Bo', finishes: [], first: 1, second: 0, third: 1 },
      c: { id: 'c', name: 'Cy', finishes: [], first: 1, second: 0, third: 1 },
      d: { id: 'd', name: 'Di', finishes: [], first: 0, second: 0, third: 1 },
      e: { id: 'e', name: 'Ed', finishes: [], first: 0, second: 0, third: 0 },
    })
    expect(rows.map(r => [r.rank, r.players.map(p => p.name)])).toEqual([[1, ['Ann']], [2, ['Bo', 'Cy']], [4, ['Di']]])
  })
})

describe('overallWinners', () => {
  const scores = [{ player_id: 'x' }]
  it('counts 1st, 2nd and 3rd per flight across events and ignores 4th and below', () => {
    const out = overallWinners({
      events: [ev('e1'), ev('e2')],
      epsByEvent: {
        e1: [P('a', 'Ann', 'A', 1), P('b', 'Bo', 'A', 2), P('c', 'Cy', 'A', 4), P('d', 'Di', 'B', 1)],
        e2: [P('a', 'Ann', 'A', 3), P('b', 'Bo', 'A', 1), P('d', 'Di', 'B', 2)],
      },
      scoresByEvent: { e1: scores, e2: scores },
    })
    expect(out.map(f => f.label)).toEqual(['Flight A', 'Flight B'])
    const a = out[0].rows
    expect(a.map(r => [r.rank, r.players[0].name, r.first, r.second, r.third])).toEqual([[1, 'Bo X', 1, 1, 0], [2, 'Ann X', 1, 0, 1]])
  })
  it('is labelled Overall when there is only one flight, and skips unscored events', () => {
    const out = overallWinners({
      events: [ev('e1'), { id: 'e2', course: null }],
      epsByEvent: { e1: [P('a', 'Ann', 'A', 1)], e2: [P('a', 'Ann', 'A', 1)] },
      scoresByEvent: { e1: scores, e2: scores },
    })
    expect(out).toHaveLength(1)
    expect(out[0].label).toBe('Overall')
    expect(out[0].rows[0].first).toBe(1)
  })
  it('keeps each placing, oldest first, with net score and whether it was tied', () => {
    const out = overallWinners({
      events: [ev('e2', '2026-08-01'), ev('e1', '2026-06-01')],
      epsByEvent: {
        e1: [P('a', 'Ann', 'A', 2), P('b', 'Bo', 'A', 2)],
        e2: [P('a', 'Ann', 'A', 1)],
      },
      scoresByEvent: { e1: scores, e2: scores },
    })
    const ann = out[0].rows[0].players.find(p => p.name === 'Ann X')
    expect(ann.finishes.map(f => [f.eventName, f.place, f.tied, f.net])).toEqual([['Event e1', 2, true, 72], ['Event e2', 1, false, 71]])
  })
})
