import { describe, it, expect } from 'vitest'
import { TEAM_SIZE, fmtPts, lockState, selectionBlock, sharedRanks, standingsRows, teamTiles, teamSelection } from './teamPlayView'

const team = (id, name) => ({ id, name, color: '#000' })
const teams = [team('t1', '19th Hole Cartel'), team('t2', 'Just the Tips'), team('t3', 'The Money Team'), team('t4', 'White Rice')]
const res = (t, pts, players = []) => ({ team: t, teamPoints: pts, selectedPlayers: players, memberIds: [] })

describe('basics', () => {
  it('formats points, showing halves', () => {
    expect([fmtPts(13.5), fmtPts(14), fmtPts(0), fmtPts(null)]).toEqual(['13.5', '14', '0', '—'])
    expect(TEAM_SIZE).toBe(2)
  })
  it('locks when the event is complete or the pre-round lock is on', () => {
    expect(lockState({ status: 'complete' }, false)).toEqual({ locked: true, reason: 'complete' })
    expect(lockState({ status: 'complete' }, true).reason).toBe('complete')
    expect(lockState({ status: 'upcoming' }, true)).toEqual({ locked: true, reason: 'manual' })
    expect(lockState({ status: 'active' }, false)).toEqual({ locked: false, reason: null })
  })
})

describe('shared ranks (display only)', () => {
  it('ties share a rank and the next team skips ahead', () => {
    const r = sharedRanks([res(teams[0], 11), res(teams[1], 11), res(teams[2], 14), res(teams[3], 5)])
    expect(r.map(x => [x.team.name, x.displayRank])).toEqual([['The Money Team', 1], ['19th Hole Cartel', 2], ['Just the Tips', 2], ['White Rice', 4]])
  })
})

// Playoffs – Round 1
const results = {
  teamResults: [
    res(teams[2], 14, [{ player_id: 'a', name: 'John Nothdurft', points: 10 }, { player_id: 'b', name: 'Mikel Hodges', points: 4 }]),
    res(teams[1], 13.5, [{ player_id: 'c', name: 'Kevin Vargas', points: 9 }, { player_id: 'd', name: 'Tam Tran', points: 4.5 }]),
    res(teams[0], 11, [{ player_id: 'e', name: 'Kevin Taylor', points: 5 }, { player_id: 'f', name: 'Daniel Lopez', points: 6 }]),
    res(teams[3], 5, [{ player_id: 'g', name: 'Will Vuong', points: 3 }, { player_id: 'h', name: 'David Wu', points: 2 }]),
  ],
}

describe('standingsRows', () => {
  const rows = standingsRows({ eventResults: results, tglTeams: teams })
  it('lists teams highest first with their points unchanged', () => {
    expect(rows.map(r => [r.team.name, r.rank, r.points])).toEqual([['The Money Team', 1, 14], ['Just the Tips', 2, 13.5], ['19th Hole Cartel', 3, 11], ['White Rice', 4, 5]])
  })
  it('fills each bar to the team’s share of the leader’s points', () => {
    expect(rows[0].fraction).toBe(1)
    expect(rows[1].fraction).toBeCloseTo(13.5 / 14)
    expect(rows[3].fraction).toBeCloseTo(5 / 14)
  })
  it('keeps each team’s selected players with their points', () => {
    expect(rows[0].players).toEqual([{ id: 'a', name: 'John Nothdurft', points: 10 }, { id: 'b', name: 'Mikel Hodges', points: 4 }])
  })
  it('before scores: roster order, no rank, no points, empty bars', () => {
    const none = standingsRows({ eventResults: null, tglTeams: teams })
    expect(none.map(r => r.team.name)).toEqual(teams.map(t => t.name))
    expect(none.every(r => r.rank === null && r.points === null && r.fraction === 0)).toBe(true)
  })
})

describe('teamTiles', () => {
  const rows = standingsRows({ eventResults: results, tglTeams: teams })
  const tiles = teamTiles({ rows, selectedCount: 8, final: true })
  it('shows teams, a full selection count, the winner and its margin, and total points awarded', () => {
    expect(tiles[0]).toMatchObject({ label: 'Teams', value: 4, helper: '2 players each this event' })
    expect(tiles[1]).toMatchObject({ value: '8 of 8', helper: 'All teams full', tone: 'neutral' })
    expect(tiles[2]).toEqual({ label: 'Winner', value: 'The Money Team', helper: '14 pts · won by 0.5' })
    expect(tiles[3]).toMatchObject({ label: 'Points awarded', value: '43.5', helper: 'Across 8 players' })
  })
  it('open spots turn the Selections tile amber; in progress it says Leader and "leads by"', () => {
    const t = teamTiles({ rows, selectedCount: 5, final: false })
    expect(t[1]).toMatchObject({ value: '5 of 8', helper: '3 spots open', tone: 'warn' })
    expect(t[2].label).toBe('Leader')
    expect(t[2].helper).toBe('14 pts · leads by 0.5')
    expect(teamTiles({ rows, selectedCount: 7, final: false })[1].helper).toBe('1 spot open')
  })
  it('a tie for first says Tied', () => {
    const tied = standingsRows({ eventResults: { teamResults: [res(teams[0], 10, [{ player_id: 'a', name: 'A', points: 10 }]), res(teams[1], 10, [{ player_id: 'b', name: 'B', points: 10 }])] }, tglTeams: teams.slice(0, 2) })
    expect(teamTiles({ rows: tied, selectedCount: 2, final: true })[2]).toEqual({ label: 'Winner', value: '19th Hole Cartel & Just the Tips', helper: 'Tied · 10 pts' })
  })
  it('before any scores: dashes and "No scores yet"', () => {
    const none = teamTiles({ rows: standingsRows({ eventResults: null, tglTeams: teams }), selectedCount: 0, final: false })
    expect(none[2]).toEqual({ label: 'Leader', value: '—', helper: 'No scores yet' })
    expect(none[3]).toMatchObject({ value: '—', helper: 'No scores yet' })
  })
})

describe('team selection and the rules', () => {
  const members = ['p1', 'p2', 'p3', 'p4', 'p5'].map((id, i) => ({ player_id: id, team_id: 't1', player: { first_name: `F${i + 1}`, last_name: 'L' } }))
  const base = { team: teams[0], members, teams, registeredIds: new Set(['p1', 'p2', 'p3', 'p4']), pointsByPlayer: { p1: 5, p2: 6 }, lock: { locked: false, reason: null } }

  it('lists the selected players with points, and the rest with registered players first', () => {
    const sel = [{ id: 's1', team_id: 't1', player_id: 'p1' }]
    const t = teamSelection({ ...base, selections: sel, allSelections: sel })
    expect(t.selected).toEqual([{ player_id: 'p1', name: 'F1 L', points: 5 }])
    expect(t.rest.map(r => r.player_id)).toEqual(['p2', 'p3', 'p4', 'p5'])
    expect(t.rest.find(r => r.player_id === 'p5')).toMatchObject({ registered: false, disabled: true, reason: 'That player is not registered for this event.' })
    expect(t.rest.find(r => r.player_id === 'p2')).toMatchObject({ registered: true, disabled: false })
  })

  it('registered players sort ahead of unregistered ones even when the roster lists them later', () => {
    const t = teamSelection({ ...base, registeredIds: new Set(['p5']), selections: [], allSelections: [] })
    expect(t.rest.map(r => r.player_id)[0]).toBe('p5')
  })

  it('a full team disables every unchecked player until one is unchecked', () => {
    const sel = [{ id: 's1', team_id: 't1', player_id: 'p1' }, { id: 's2', team_id: 't1', player_id: 'p2' }]
    const full = teamSelection({ ...base, selections: sel, allSelections: sel })
    expect(full.full).toBe(true)
    expect(full.rest.every(r => r.disabled)).toBe(true)
    expect(full.rest.find(r => r.player_id === 'p3').reason).toBe('Max 2 players per team per event.')
    const one = teamSelection({ ...base, selections: sel.slice(0, 1), allSelections: sel.slice(0, 1) })
    expect(one.rest.filter(r => r.registered).every(r => !r.disabled)).toBe(true)
  })

  it('a player already picked by another team is blocked, naming that team, and can be released', () => {
    const all = [{ id: 'x9', team_id: 't2', player_id: 'p3' }]
    const t = teamSelection({ ...base, selections: [], allSelections: all })
    expect(t.rest.find(r => r.player_id === 'p3')).toMatchObject({ disabled: true, otherTeamName: 'Just the Tips', otherSelectionId: 'x9', reason: 'Already selected for Just the Tips this event.' })
  })

  it('when selections are locked nobody can be picked', () => {
    const complete = teamSelection({ ...base, lock: { locked: true, reason: 'complete' }, selections: [], allSelections: [] })
    expect(complete.rest.every(r => r.disabled)).toBe(true)
    expect(complete.rest[0].reason).toBe('This event is complete. Re-open it to change team selections.')
    expect(selectionBlock({ lock: { locked: true, reason: 'manual' } })).toBe('Selections are locked. Unlock to make changes.')
  })

  it('an unlocked, registered, free player on a team with room has no block', () => {
    expect(selectionBlock({ lock: { locked: false }, registered: true, teamFull: false, otherTeamName: null })).toBeNull()
  })
})
