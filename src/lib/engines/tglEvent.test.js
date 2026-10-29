import { describe, it, expect } from 'vitest'
import { computeEventTglResults } from './tglEvent'

const course = { stroke_index: Array.from({ length: 18 }, (_, i) => i + 1), par_per_hole: Array.from({ length: 18 }, () => 4) }
const ep = (id, flight) => ({ player_id: id, flight, course_handicap: 0, tee: null, is_guest: false, group_number: 1, player: { first_name: id, last_name: '' } })
const flat = (id, g) => Array.from({ length: 18 }, (_, i) => ({ player_id: id, hole_number: i + 1, gross_score: g }))

describe('computeEventTglResults', () => {
  const eventPlayers = [ep('a1', 'A'), ep('a2', 'A'), ep('b1', 'B'), ep('b2', 'B')]
  const scores = [...flat('a1', 4), ...flat('a2', 5), ...flat('b1', 4), ...flat('b2', 6)]
  const teams = [{ id: 't1', name: 'One' }, { id: 't2', name: 'Two' }]
  const selections = [
    { team_id: 't1', player_id: 'a1' }, { team_id: 't1', player_id: 'b2' },
    { team_id: 't2', player_id: 'a2' }, { team_id: 't2', player_id: 'b1' },
  ]
  const members = selections.map(s => ({ team_id: s.team_id, player_id: s.player_id }))
  const args = { eventPlayers, allScores: scores, course, tglSelections: selections, tglTeams: teams, tglMembers: members }

  it('ranks players inside their own flight and adds each team’s selected players', () => {
    const r = computeEventTglResults(args)
    expect(r.teamResults).toHaveLength(2)
    const pts = Object.fromEntries(r.teamResults.map(t => [t.team.id, t.teamPoints]))
    // Each flight's winner and runner-up earn points: One has A's winner + B's last, Two has A's last + B's winner.
    expect(pts.t1 + pts.t2).toBeGreaterThan(0)
    expect(r.playerPoints.a1).toBeGreaterThan(r.playerPoints.a2)
    expect(r.playerPoints.b1).toBeGreaterThan(r.playerPoints.b2)
  })

  it('returns null with no scores, no course or no teams', () => {
    expect(computeEventTglResults({ ...args, allScores: [] })).toBeNull()
    expect(computeEventTglResults({ ...args, course: null })).toBeNull()
    expect(computeEventTglResults({ ...args, tglTeams: [] })).toBeNull()
  })

  it('never throws on bad data', () => {
    expect(computeEventTglResults({ ...args, eventPlayers: null })).toBeNull()
  })
})
