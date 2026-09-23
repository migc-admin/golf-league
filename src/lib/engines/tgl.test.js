import { describe, it, expect } from 'vitest'
import {
  assignTGLPoints,
  computeTGLEventResults,
  computeTGLSeasonStandings,
} from './tgl.js'

// ─── assignTGLPoints ─────────────────────────────────────────────────────────
describe('assignTGLPoints', () => {
  it('awards fieldSize - rank + 1 points with no ties', () => {
    const ranked = [
      { player_id: 'p1', rank: 1 },
      { player_id: 'p2', rank: 2 },
      { player_id: 'p3', rank: 3 },
      { player_id: 'p4', rank: 4 },
      { player_id: 'p5', rank: 5 },
    ]
    const points = assignTGLPoints(ranked, 5)
    expect(points).toEqual({ p1: 5, p2: 4, p3: 3, p4: 2, p5: 1 })
  })

  it('splits combined place points evenly for a 2-way tie (docstring example)', () => {
    // 2-way tie for 1st in a 10-player field → (10+9)/2 = 9.5 each
    const ranked = [
      { player_id: 'a', rank: 1 },
      { player_id: 'b', rank: 1 },
      { player_id: 'c', rank: 3 },
    ]
    const points = assignTGLPoints(ranked, 10)
    expect(points.a).toBe(9.5)
    expect(points.b).toBe(9.5)
    expect(points.c).toBe(8)
  })

  it('splits combined place points evenly for a 3-way tie', () => {
    // 3-way tie for 2nd in a 6-player field occupies places 2,3,4 → (5+4+3)/3 = 4
    const ranked = [
      { player_id: 'a', rank: 2 },
      { player_id: 'b', rank: 2 },
      { player_id: 'c', rank: 2 },
    ]
    const points = assignTGLPoints(ranked, 6)
    expect(points.a).toBe(4)
    expect(points.b).toBe(4)
    expect(points.c).toBe(4)
  })

  it('floors points at zero when rank exceeds field size', () => {
    const ranked = [{ player_id: 'p1', rank: 10 }]
    const points = assignTGLPoints(ranked, 5)
    expect(points.p1).toBe(0)
  })
})

// ─── computeTGLEventResults ──────────────────────────────────────────────────
describe('computeTGLEventResults', () => {
  const ranked = [
    { player_id: 'p1', rank: 1, player: { first_name: 'Ann', last_name: 'Lee' } },
    { player_id: 'p2', rank: 2, player: { first_name: 'Bo', last_name: 'Kim' } },
    { player_id: 'p3', rank: 3, player: { first_name: 'Cy', last_name: 'Park' } },
    { player_id: 'p4', rank: 4, player: { first_name: 'Di', last_name: 'Choi' } },
  ]
  const tglTeams = [{ id: 't1', name: 'Red' }, { id: 't2', name: 'Blue' }]
  const tglSelections = [
    { team_id: 't1', player_id: 'p1' },
    { team_id: 't1', player_id: 'p3' },
    { team_id: 't2', player_id: 'p2' },
    { team_id: 't2', player_id: 'p4' },
  ]
  const tglMembers = [
    { team_id: 't1', player_id: 'p1' },
    { team_id: 't1', player_id: 'p3' },
    { team_id: 't1', player_id: 'p5' }, // roster member not selected this event
    { team_id: 't2', player_id: 'p2' },
    { team_id: 't2', player_id: 'p4' },
  ]

  it('sums selected players points per team and ranks teams by total', () => {
    // fieldSize=4 → p1=4, p2=3, p3=2, p4=1. Team Red = p1+p3 = 6, Team Blue = p2+p4 = 4.
    const { teamResults } = computeTGLEventResults(ranked, tglSelections, tglTeams, tglMembers)
    const red = teamResults.find(t => t.team.id === 't1')
    const blue = teamResults.find(t => t.team.id === 't2')
    expect(red.teamPoints).toBe(6)
    expect(blue.teamPoints).toBe(4)
    expect(red.rank).toBe(1)
    expect(blue.rank).toBe(2)
  })

  it('includes full roster memberIds even for players not selected this event', () => {
    const { teamResults } = computeTGLEventResults(ranked, tglSelections, tglTeams, tglMembers)
    const red = teamResults.find(t => t.team.id === 't1')
    expect(red.memberIds).toEqual(['p1', 'p3', 'p5'])
  })

  it('builds selected player names and ranks from the leaderboard', () => {
    const { teamResults } = computeTGLEventResults(ranked, tglSelections, tglTeams, tglMembers)
    const red = teamResults.find(t => t.team.id === 't1')
    const p1 = red.selectedPlayers.find(p => p.player_id === 'p1')
    expect(p1.name).toBe('Ann Lee')
    expect(p1.rank).toBe(1)
    expect(p1.points).toBe(4)
  })

  it('falls back to the player id as name when the player is not on the leaderboard', () => {
    const selections = [{ team_id: 't1', player_id: 'ghost' }]
    const { teamResults } = computeTGLEventResults(ranked, selections, tglTeams, [])
    const red = teamResults.find(t => t.team.id === 't1')
    expect(red.selectedPlayers[0]).toEqual({ player_id: 'ghost', points: 0, rank: null, name: 'ghost' })
  })

  it('uses precomputedPoints instead of recalculating from fieldSize when provided', () => {
    const precomputedPoints = { p1: 100, p2: 1, p3: 1, p4: 1 }
    const { teamResults, playerPoints } = computeTGLEventResults(
      ranked, tglSelections, tglTeams, tglMembers, precomputedPoints
    )
    expect(playerPoints).toBe(precomputedPoints)
    const red = teamResults.find(t => t.team.id === 't1')
    expect(red.teamPoints).toBe(101) // p1(100) + p3(1)
  })
})

// ─── computeTGLSeasonStandings ───────────────────────────────────────────────
describe('computeTGLSeasonStandings', () => {
  const tglTeams = [{ id: 't1', name: 'Red' }, { id: 't2', name: 'Blue' }, { id: 't3', name: 'Green' }]

  it('sums team points across events and ranks descending', () => {
    const eventResultsByEventId = {
      e1: { teamResults: [{ team: tglTeams[0], teamPoints: 6 }, { team: tglTeams[1], teamPoints: 4 }] },
      e2: { teamResults: [{ team: tglTeams[0], teamPoints: 3 }, { team: tglTeams[1], teamPoints: 7 }] },
    }
    const standings = computeTGLSeasonStandings(eventResultsByEventId, tglTeams)
    const red = standings.find(s => s.team.id === 't1')
    const blue = standings.find(s => s.team.id === 't2')
    expect(red.seasonPoints).toBe(9)
    expect(blue.seasonPoints).toBe(11)
    expect(blue.rank).toBe(1)
    expect(red.rank).toBe(2)
  })

  it('gives a team with no event results a season total of zero', () => {
    const eventResultsByEventId = {
      e1: { teamResults: [{ team: tglTeams[0], teamPoints: 5 }] },
    }
    const standings = computeTGLSeasonStandings(eventResultsByEventId, tglTeams)
    const green = standings.find(s => s.team.id === 't3')
    expect(green.seasonPoints).toBe(0)
  })

  it('returns an empty array when there are no teams', () => {
    expect(computeTGLSeasonStandings({}, [])).toEqual([])
  })
})
