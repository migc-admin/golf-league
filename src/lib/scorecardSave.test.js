import { describe, it, expect } from 'vitest'
import { splitHoleEntries, missingScoresMessage } from './scorecardSave'

const ep = (id, first) => ({ player_id: id, player: { first_name: first, last_name: 'X' } })
const group = [ep('p1', 'Tam'), ep('p2', 'Colin'), ep('p3', 'Dana'), ep('p4', 'Lee')]
const from = typed => id => typed[id] ?? { gross: '', putts: '' }

describe('splitHoleEntries (the "blank saves as a 1" bug)', () => {
  it('never saves a blank score as a number', () => {
    const { toSave, missing } = splitHoleEntries(group, from({
      p1: { gross: 4, putts: 2 }, p2: { gross: 5, putts: '' }, p3: { gross: 6, putts: '' },
    }))
    expect(toSave.map(s => [s.ep.player_id, s.gross, s.putts])).toEqual([['p1', 4, 2], ['p2', 5, null], ['p3', 6, null]])
    expect(missing.map(m => m.player_id)).toEqual(['p4'])
    expect(toSave.some(s => s.ep.player_id === 'p4')).toBe(false)
  })

  it('saves nothing when every box is blank', () => {
    const { toSave, missing } = splitHoleEntries(group, from({}))
    expect(toSave).toEqual([])
    expect(missing).toHaveLength(4)
  })

  it('treats zero, negative and unreadable scores as missing', () => {
    const { toSave, missing } = splitHoleEntries(group, from({
      p1: { gross: 0 }, p2: { gross: -3 }, p3: { gross: 'abc' }, p4: { gross: null },
    }))
    expect(toSave).toEqual([])
    expect(missing).toHaveLength(4)
  })

  it('still saves a real hole-in-one and keeps zero putts', () => {
    const { toSave, missing } = splitHoleEntries([group[0]], from({ p1: { gross: 1, putts: 0 } }))
    expect(toSave).toEqual([{ ep: group[0], gross: 1, putts: 0 }])
    expect(missing).toEqual([])
  })

  it('accepts scores typed as text', () => {
    const { toSave } = splitHoleEntries([group[0]], from({ p1: { gross: '7', putts: '3' } }))
    expect(toSave[0]).toMatchObject({ gross: 7, putts: 3 })
  })

  it('handles an empty group', () => {
    expect(splitHoleEntries([], from({}))).toEqual({ toSave: [], missing: [] })
    expect(splitHoleEntries(null, from({}))).toEqual({ toSave: [], missing: [] })
  })
})

describe('missingScoresMessage', () => {
  it('says nothing when no one is missing', () => {
    expect(missingScoresMessage([], 4, 5)).toBe(null)
  })
  it('names the players who were left blank', () => {
    expect(missingScoresMessage([group[3]], 4, 5)).toBe('No score entered for Lee on hole 5. Nothing was saved for them.')
    expect(missingScoresMessage([group[1], group[3]], 4, 5)).toBe('No score entered for Colin and Lee on hole 5. Nothing was saved for them.')
    expect(missingScoresMessage(group.slice(1), 4, 5)).toBe('No score entered for Colin, Dana and Lee on hole 5. Nothing was saved for them.')
  })
  it('asks for a score when the whole hole is blank', () => {
    expect(missingScoresMessage(group, 4, 12)).toBe('Enter a score for hole 12 before saving.')
  })
  it('copes with a player record that has no name', () => {
    expect(missingScoresMessage([{ player_id: 'p9' }], 4, 2)).toBe('No score entered for a player on hole 2. Nothing was saved for them.')
  })
})
