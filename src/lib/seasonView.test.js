import { describe, it, expect } from 'vitest'
import { parseLocalDate, monthDay, playerName, moneyRows, sideRows, moneyListSubtitle, sideGameSubtitle, nextEventOf, seasonMeta } from './seasonView'

const P = (first, last, id) => ({ id, first_name: first, last_name: last })

describe('dates', () => {
  it('reads a date-only string as the same local day', () => {
    expect(parseLocalDate('2026-10-25').getDate()).toBe(25)
    expect(monthDay('2026-10-25')).toEqual({ mon: 'OCT', day: 25 })
    expect(monthDay(null)).toBeNull()
  })
})

describe('playerName', () => {
  it('returns null for a missing or blank player', () => {
    expect(playerName(null)).toBeNull()
    expect(playerName({ first_name: '', last_name: '' })).toBeNull()
    expect(playerName(P('Tai', 'Ho'))).toBe('Tai Ho')
  })
})

describe('moneyRows', () => {
  const st = [
    { player: P('A', 'One', 1), totalEarnings: 200, eventsPlayed: 2 },
    { player: P('B', 'Two', 2), totalEarnings: 100, eventsPlayed: 4 },
    { player: null, totalEarnings: 100, eventsPlayed: 1 },
    { player: P('D', 'Four', 4), totalEarnings: 50, eventsPlayed: 0 },
  ]
  it('ties share a rank and the next rank skips', () => {
    expect(moneyRows(st).map(r => r.rank)).toEqual([1, 2, 2, 4])
  })
  it('per event is earnings over events, bar scales to the leader', () => {
    const r = moneyRows(st)
    expect(r[0].perEvent).toBe(100)
    expect(r[1].perEvent).toBe(25)
    expect(r[3].perEvent).toBe(0)
    expect(r[0].pct).toBe(100)
    expect(r[1].pct).toBe(50)
  })
  it('a missing player has a null name and a stable key', () => {
    const r = moneyRows(st)
    expect(r[2].name).toBeNull()
    expect(r[2].key).toBe('row-2')
  })
})

describe('sideRows', () => {
  it('sorts by side total, highest first', () => {
    const rows = sideRows([
      { player: P('A', 'a', 1), skinsWon: 5, skinsTotal: 10, ctpWins: 0, ctpTotal: 0, ldWins: 0, ldTotal: 0, lpWins: 0, lpTotal: 0 },
      { player: P('B', 'b', 2), skinsWon: 1, skinsTotal: 30, ctpWins: 1, ctpTotal: 20, ldWins: 0, ldTotal: 0, lpWins: 1, lpTotal: 5 },
    ])
    expect(rows.map(r => r.total)).toEqual([55, 10])
    expect(rows[0].lp).toBe(1)
  })
})

describe('subtitles', () => {
  it('lists what the money list counts', () => {
    expect(moneyListSubtitle({ include_skins: false, include_low_putts: true })).toBe('Season earnings from scoring, closest to pin, long drive and low putts.')
  })
  it('says skins are left out when the league turns them off', () => {
    expect(sideGameSubtitle({ include_skins: false }, { skins: true })).toBe("Includes skins, which don't count toward the money list.")
    expect(sideGameSubtitle({ include_skins: false }, { skins: true, ld: true, lp: true })).toBe("Includes skins and low putts, which don't count toward the money list.")
    expect(sideGameSubtitle({}, { ld: true })).toBe('Long drive winnings across the season.')
  })
})

describe('nextEventOf / seasonMeta', () => {
  it('picks the earliest open event', () => {
    const evs = [
      { id: 'a', status: 'complete', event_date: '2026-10-25' },
      { id: 'c', status: 'upcoming', event_date: '2026-11-15', event_number: 13 },
      { id: 'b', status: 'upcoming', event_date: '2026-11-15', event_number: 12 },
    ]
    expect(nextEventOf(evs).id).toBe('b')
    expect(nextEventOf([evs[0]])).toBeNull()
  })
  it('builds the meta line', () => {
    expect(seasonMeta({ played: 6, inMoney: 37, latestName: 'Playoffs – Round 1' })).toBe('6 events played · 37 players in the money · Updated after Playoffs – Round 1')
    expect(seasonMeta({ played: 1, inMoney: null, latestName: null })).toBe('1 event played')
  })
})
