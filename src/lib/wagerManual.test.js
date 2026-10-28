import { describe, it, expect } from 'vitest'
import { buildManualWagerRow } from './wagerManual'

const base = { eventId: 'e1', bettor: '  Jeff Carey ', amount: '5', method: 'cash' }

describe('buildManualWagerRow', () => {
  it('WIN bet: pick_1st only, trimmed name, rounded amount, payment method kept', () => {
    expect(buildManualWagerRow({ ...base, kind: 'win', playerId: 'p1' }).row).toEqual({
      event_id: 'e1', bettor_name: 'Jeff Carey', amount: 5, payment_method: 'cash', pick_1st: 'p1', pick_2nd: null,
    })
  })

  it('PLACE bet: pick_2nd only', () => {
    const { row } = buildManualWagerRow({ ...base, kind: 'place', playerId: 'p2', amount: '7.499' })
    expect(row.pick_1st).toBeNull()
    expect(row.pick_2nd).toBe('p2')
    expect(row.amount).toBe(7.5)
  })

  it('MATCH bet: match id and picked winner, no WIN/PLACE picks', () => {
    const { row } = buildManualWagerRow({ ...base, kind: 'match', matchId: 'm1', matchPick: 'p3', method: '' })
    expect(row).toMatchObject({ match_pairing_id: 'm1', pick_match: 'p3', payment_method: null })
    expect(row.pick_1st).toBeUndefined()
  })

  it('rejects missing or bad input with a clear message', () => {
    expect(buildManualWagerRow({ ...base, bettor: '  ', kind: 'win', playerId: 'p1' }).error).toMatch(/name/i)
    expect(buildManualWagerRow({ ...base, amount: '0', kind: 'win', playerId: 'p1' }).error).toMatch(/amount/i)
    expect(buildManualWagerRow({ ...base, amount: 'x', kind: 'win', playerId: 'p1' }).error).toMatch(/amount/i)
    expect(buildManualWagerRow({ ...base, kind: 'win' }).error).toMatch(/player/i)
    expect(buildManualWagerRow({ ...base, kind: 'match', matchId: 'm1' }).error).toMatch(/match/i)
    expect(buildManualWagerRow({ ...base, kind: 'nope', playerId: 'p1' }).error).toMatch(/WIN, PLACE or MATCH/)
  })

  it('works regardless of betting being open or closed (it never looks at event state)', () => {
    expect(buildManualWagerRow({ ...base, kind: 'win', playerId: 'p1' }).error).toBeUndefined()
  })
})
