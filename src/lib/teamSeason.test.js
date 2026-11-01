import { describe, it, expect, vi } from 'vitest'

// Two events, two teams: the engine is replaced by fixed results so only the season maths is tested.
vi.mock('./engines/tglEvent', () => ({
  computeEventTglResults: ({ course }) => {
    if (!course) return null
    const pts = course.pts
    return {
      teamResults: [
        { team: { id: 'a', name: 'Alpha' }, teamPoints: pts.a, selectedPlayers: [{ player_id: 'p1', name: 'P One', points: pts.a }], memberIds: [] },
        { team: { id: 'b', name: 'Beta' }, teamPoints: pts.b, selectedPlayers: [], memberIds: [] },
        { team: { id: 'c', name: 'Gamma' }, teamPoints: pts.c, selectedPlayers: [], memberIds: [] },
      ],
      playerPoints: {},
    }
  },
}))

import { teamSeasonView } from './teamSeason'

const teams = [{ id: 'a', name: 'Alpha' }, { id: 'b', name: 'Beta' }, { id: 'c', name: 'Gamma' }]
const ev = (id, pts) => ({ id, course: pts ? { pts } : null })

describe('teamSeasonView', () => {
  it('adds each scored event and ranks with shared ties', () => {
    const v = teamSeasonView({
      events: [ev('e1', { a: 10, b: 6, c: 6 }), ev('e2', { a: 5, b: 9, c: 9 })],
      epsByEvent: {}, scoresByEvent: {}, tglTeams: teams, tglMembers: [], tglSelections: [],
    })
    expect(v.scoredEventIds).toEqual(['e1', 'e2'])
    expect(v.season.map(r => [r.team.name, r.points, r.rank])).toEqual([['Alpha', 15, 1], ['Beta', 15, 1], ['Gamma', 15, 1]])
  })
  it('orders by points and gives a bar fraction of the leader', () => {
    const v = teamSeasonView({
      events: [ev('e1', { a: 10, b: 6, c: 2 })], epsByEvent: {}, scoresByEvent: {}, tglTeams: teams, tglMembers: [], tglSelections: [],
    })
    expect(v.season.map(r => r.team.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    expect(v.season.map(r => r.rank)).toEqual([1, 2, 3])
    expect(v.season[1].fraction).toBeCloseTo(0.6)
    expect(v.byEvent.e1[0].team.name).toBe('Alpha')
  })
  it('lists each scored event for every team, oldest first, with that event\'s place and points', () => {
    const v = teamSeasonView({
      events: [{ ...ev('e2', { a: 5, b: 9, c: 1 }), name: 'Later', event_date: '2026-08-01' }, { ...ev('e1', { a: 10, b: 6, c: 6 }), name: 'Earlier', event_date: '2026-06-01' }],
      epsByEvent: {}, scoresByEvent: {}, tglTeams: teams, tglMembers: [], tglSelections: [],
    })
    const alpha = v.season.find(r => r.team.name === 'Alpha')
    expect(alpha.events.map(e => [e.name, e.rank, e.points])).toEqual([['Earlier', 1, 10], ['Later', 2, 5]])
    expect(alpha.events[0].players[0].name).toBe('P One')
    const gamma = v.season.find(r => r.team.name === 'Gamma')
    expect(gamma.events.map(e => [e.rank, e.points])).toEqual([[2, 6], [3, 1]])
  })
  it('gives no place to a team that earned no points in an event', () => {
    const v = teamSeasonView({
      events: [ev('e1', { a: 0, b: 0, c: 0 })], epsByEvent: {}, scoresByEvent: {}, tglTeams: teams, tglMembers: [], tglSelections: [],
    })
    expect(v.season[0].events[0].rank).toBeNull()
    expect(v.season[0].events[0].points).toBe(0)
  })
  it('skips events that cannot be scored and still lists every team', () => {
    const v = teamSeasonView({
      events: [ev('e1', null)], epsByEvent: {}, scoresByEvent: {}, tglTeams: teams, tglMembers: [], tglSelections: [],
    })
    expect(v.scoredEventIds).toEqual([])
    expect(v.season).toHaveLength(3)
    expect(v.season.every(r => r.points === null && r.rank === null)).toBe(true)
  })
})
