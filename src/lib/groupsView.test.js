import { describe, it, expect } from 'vitest'
import {
  NO_SHOW_ENTRY, isGroupsLocked, scorerNamesByGroup, scorerIds, scorersFirst, playersWithoutMatch,
  withoutMatchSummary, pairingGroups, tiebreakBox, tiebreakOrderLabel, groupOptionLabel, moveItem,
  noShowScoreRows, NO_SHOW_OVER_PAR,
} from './groupsView'

let n = 0
const ep = (first, last, group, extra = {}) => ({ id: `e${++n}`, player_id: `p${n}`, player: { first_name: first, last_name: last }, group_number: group, ...extra })

describe('isGroupsLocked', () => {
  it('is locked only when the event is complete, so re-opening unlocks it', () => {
    expect(isGroupsLocked({ status: 'complete' })).toBe(true)
    for (const s of ['upcoming', 'active', undefined]) expect(isGroupsLocked({ status: s })).toBe(false)
    expect(isGroupsLocked(null)).toBe(false)
  })
})

describe('scorerNamesByGroup (the "no_show" bug)', () => {
  const tam = ep('Tam', 'Tran', 1)
  const colin = ep('Colin', 'Harrison', 1)
  const scores = [
    { player_id: tam.player_id, entered_by: 'Tam Tran' },
    { player_id: colin.player_id, entered_by: NO_SHOW_ENTRY },
    { player_id: colin.player_id, entered_by: '  ' },
    { player_id: colin.player_id, entered_by: null },
  ]
  it('never lists the no-show marker (or blanks) as a scorer', () => {
    const map = scorerNamesByGroup([tam, colin], scores)
    expect([...map[1]]).toEqual(['Tam Tran'])
  })
  it('ignores scores for players without a group', () => {
    expect(scorerNamesByGroup([ep('A', 'B', null)], [{ player_id: 'p1', entered_by: 'X' }])).toEqual({})
  })
})

describe('scorerIds / scorersFirst', () => {
  const a = ep('Colin', 'Harrison', 1), b = ep('Tam', 'Tran', 1), c = ep('Bryan', 'Cappelli', 1)
  it('matches scorer names to group members case-insensitively', () => {
    const ids = scorerIds([a, b, c], new Set(['tam tran']))
    expect([...ids]).toEqual([b.id])
  })
  it('puts scorers first and keeps the rest in order', () => {
    const out = scorersFirst([a, b, c], new Set([b.id]))
    expect(out.map(x => x.id)).toEqual([b.id, a.id, c.id])
  })
  it('returns an empty set when there is no scorer', () => {
    expect(scorerIds([a], undefined).size).toBe(0)
  })
})

describe('without a match', () => {
  const players = [ep('Bryan', 'Cappelli', 1), ep('Will', 'Vuong', 1), ep('Mat', 'Vigil', 4), ep('Tai', 'Ho', 2)]
  const pairings = [{ player_a_id: players[3].player_id, player_b_id: 'someone-else' }]
  it('lists players in no pairing and updates as matches are added or removed', () => {
    expect(playersWithoutMatch(players, pairings)).toHaveLength(3)
    expect(playersWithoutMatch(players, [...pairings, { player_a_id: players[0].player_id, player_b_id: players[1].player_id }])).toHaveLength(1)
    expect(playersWithoutMatch(players, [])).toHaveLength(4)
  })
  it('summarises names by group like the design', () => {
    expect(withoutMatchSummary(playersWithoutMatch(players, pairings))).toBe('Bryan Cappelli, Will Vuong (Group 1) · Mat Vigil (Group 4)')
  })
  it('labels players with no group', () => {
    expect(withoutMatchSummary([ep('A', 'B', null)])).toBe('A B (no group)')
  })
})

describe('pairingGroups', () => {
  const a = ep('A', 'A', 2), b = ep('B', 'B', 2), c = ep('C', 'C', 3)
  const map = Object.fromEntries([a, b, c].map(x => [x.player_id, x]))
  it('shows one group when both are together, two and a flag when they differ', () => {
    expect(pairingGroups({ player_a_id: a.player_id, player_b_id: b.player_id }, map)).toMatchObject({ differ: false, label: 'Group 2' })
    expect(pairingGroups({ player_a_id: a.player_id, player_b_id: c.player_id }, map)).toMatchObject({ differ: true, label: 'Group 2 / Group 3' })
  })
})

describe('tiebreakBox — only on matches tied after 18', () => {
  it('no box for decided matches, matches in progress, or no result', () => {
    expect(tiebreakBox(undefined, 'A', 'B')).toBeNull()
    expect(tiebreakBox({ tiedAfter18: false, winner: 'A' }, 'A', 'B')).toBeNull()
    expect(tiebreakBox({ tiedAfter18: false, winner: null }, 'A', 'B')).toBeNull()
  })
  it('resolved by tiebreak: headline names the winner, detail has the deciding stat', () => {
    const box = tiebreakBox({ tiedAfter18: true, winner: 'A', tiebreak: { by: 'net_total', label: 'Net total', unit: 'net', valueA: 89, valueB: 91 } }, 'Spencer Higgins', 'Darrick Sogabe')
    expect(box).toEqual({ headline: 'Tied after 18 · Spencer Higgins wins on tiebreak', detail: 'Net total (net) 89 vs 91', showSelect: true })
  })
  it('reads the stat from the winner’s side when B wins', () => {
    const box = tiebreakBox({ tiedAfter18: true, winner: 'B', tiebreak: { by: 'putts', label: 'Fewest putts', valueA: 34, valueB: 31 } }, 'A', 'B')
    expect(box.detail).toBe('Fewest putts 31 vs 34')
  })
  it('putt-off: asks for a winner, no detail line', () => {
    expect(tiebreakBox({ tiedAfter18: true, needsWinner: true, needsPuttOff: true }, 'A', 'B')).toEqual({ headline: 'Tied after 18 · Putt-off: pick the winner', detail: null, showSelect: true })
  })
  it('halved: headline only and no Winner select', () => {
    expect(tiebreakBox({ tiedAfter18: true, winner: 'halve' }, 'A', 'B')).toEqual({ headline: 'Tied after 18 · Halved (½ point each)', detail: null, showSelect: false })
  })
  it('an admin-picked winner keeps the select so it can be changed', () => {
    const box = tiebreakBox({ tiedAfter18: true, winner: 'B', tiebreak: { by: 'manual' } }, 'A', 'Max')
    expect(box.headline).toBe('Tied after 18 · Max wins (decided by admin)')
    expect(box.showSelect).toBe(true)
  })
})

describe('labels', () => {
  it('shows tiebreak steps with arrows', () => {
    expect(tiebreakOrderLabel('Net total, fewest putts, most net pars or better, putt-off')).toBe('Net total → fewest putts → most net pars or better → putt-off')
    expect(tiebreakOrderLabel('Net total, then back 9, last 6, last 3, last hole')).toBe('Net total → back 9 → last 6 → last 3 → last hole')
    expect(tiebreakOrderLabel('Back 9, then last 6, last 3, last hole')).toBe('Back 9 → last 6 → last 3 → last hole')
  })
  it('builds the mobile group option text', () => {
    expect(groupOptionLabel({ groupNumber: 4, teeTime: '10:20 AM', count: 3 })).toBe('Group 4 · 10:20 AM (1 open)')
    expect(groupOptionLabel({ groupNumber: 1, teeTime: '9:50 AM', count: 4 })).toBe('Group 1 · 9:50 AM (full)')
    expect(groupOptionLabel({ groupNumber: 2, teeTime: null, count: 0 })).toBe('Group 2 (4 open)')
  })
})

describe('moveItem', () => {
  it('moves up and down, and does nothing past either end (the disabled arrows)', () => {
    expect(moveItem(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(['a', 'b', 'c'], 1, 1)).toEqual(['a', 'c', 'b'])
    const first = ['a', 'b']
    expect(moveItem(first, 0, -1)).toBe(first)
    const last = ['a', 'b']
    expect(moveItem(last, 1, 1)).toBe(last)
  })
})

describe('noShowScoreRows', () => {
  it('scores every hole 5 over par gross, tagged as a no-show, with no putts', () => {
    const rows = noShowScoreRows({ eventId: 'e', playerId: 'p', pars: [4, 3, 5] })
    expect(NO_SHOW_OVER_PAR).toBe(5)
    expect(rows.map(r => r.gross_score)).toEqual([9, 8, 10])
    expect(rows.map(r => r.hole_number)).toEqual([1, 2, 3])
    expect(rows.every(r => r.entered_by === NO_SHOW_ENTRY && r.putts === null && r.event_id === 'e' && r.player_id === 'p')).toBe(true)
  })
  it('falls back to 18 par-4 holes when the course has no par data', () => {
    const rows = noShowScoreRows({ eventId: 'e', playerId: 'p', pars: undefined })
    expect(rows).toHaveLength(18)
    expect(rows[0].gross_score).toBe(9)
  })
})
