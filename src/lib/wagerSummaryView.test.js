import { describe, it, expect } from 'vitest'
import { legendOf, bettorRows, buildSummary, filterBettorRows, filterPoolCards, poolView } from './wagerSummaryView'

// A small settled event: WIN pool 100 to Sam; PLACE pool 20 to Sam+Joe; match 1 pool 30 to Joe; match 2 halved.
const model = {
  final: true,
  betCount: 9,
  pools: { win: 100, place: 20, match: 50, total: 170 },
  panels: [
    { key: 'win', title: 'WIN pool', pool: 100, pill: 'x', note: 'n', winnerText: 'Sam Lee', rows: [{ name: 'Ann', stake: 10, payout: 100, net: 90 }] },
    { key: 'place', title: 'PLACE pool', pool: 20, pill: 'y', note: 'n', winnerText: 'Sam Lee · Joe Ng', rows: [{ name: 'Ann', stake: 5, payout: 12, net: 7 }, { name: 'Bo', stake: 5, payout: 8, net: 3 }] },
  ],
  matches: [
    { id: 'a', number: 1, a: 'Sam Lee', b: 'Joe Ng', pool: 30, winnerText: 'Joe Ng', pill: 'w', rows: [{ name: 'Bo', stake: 10, payout: 30, net: 20 }] },
    { id: 'b', number: 2, a: 'Al Ray', b: 'Cy Fox', pool: 20, winnerText: 'Halved', pill: 'h', rows: [{ name: 'Cy', stake: 20, payout: 20, net: 0 }] },
  ],
}

describe('bettorRows', () => {
  it('combines a bettor across pools with chips, biggest payout first', () => {
    const rows = bettorRows(model)
    expect(rows.map(r => r.name)).toEqual(['Ann', 'Bo', 'Cy'])
    expect(rows[0]).toMatchObject({ rank: 1, staked: 15, payout: 112, net: 97 })
    expect(rows[0].chips.map(c => c.label)).toEqual(['WIN', 'PLACE'])
    expect(rows[1].chips.map(c => c.label)).toEqual(['PLACE', 'M1'])
  })
  it('filters by name', () => {
    expect(filterBettorRows(bettorRows(model), 'bo').map(r => r.name)).toEqual(['Bo'])
    expect(filterBettorRows(bettorRows(model), '')).toHaveLength(3)
  })
})

describe('buildSummary', () => {
  const s = buildSummary(model)
  it('ties the payouts to the pot', () => {
    expect(s.tiles.pot.value).toBe(170)
    expect(s.tiles.paid.value).toBe(170)
    expect(s.tiles.paid.ties).toBe(true)
    expect(s.tiles.paid.helper).toBe('Ties to the pot · $0.00 difference')
    expect(s.tieOut.every(r => r.status.kind === 'ties')).toBe(true)
    expect(s.tieTotals.status.kind).toBe('ties')
  })
  it('counts winning and losing bets', () => {
    expect(s.tiles.settled.value).toBe(9)
    expect(s.tiles.settled.winning).toBe(5)
    expect(s.tiles.settled.losing).toBe(4)
  })
  it('names the top earner and totals the winners', () => {
    expect(s.tiles.top.name).toBe('Ann')
    expect(s.tiles.top.helper).toBe('$112.00 paid · +$97.00')
    expect(s.totals).toEqual({ winners: 3, staked: 50, payout: 170, net: 120 })
    expect(s.losingStakes).toBe(120)
  })
  it('uses last names for match pools in the tie-out', () => {
    expect(s.tieOut.find(r => r.key === 'ma').pool).toBe('Match 1 · Lee vs Ng')
  })
})

describe('mismatch and club cases', () => {
  it('flags a pool that does not tie', () => {
    const bad = { ...model, panels: [{ ...model.panels[0], rows: [{ name: 'Ann', stake: 10, payout: 90, net: 80 }] }, model.panels[1]] }
    const s = buildSummary(bad)
    expect(s.tiles.paid.ties).toBe(false)
    expect(s.tiles.paid.helper).toBe('Off by $10.00')
    expect(s.tieOut[0].status).toMatchObject({ kind: 'off', label: 'Off by $10.00' })
  })
  it('treats a pool with no winning bets as rolled to the club, not a mismatch', () => {
    const club = { ...model, panels: [{ ...model.panels[0], rows: [] }, model.panels[1]] }
    const s = buildSummary(club)
    expect(s.tieOut[0].status.kind).toBe('club')
    expect(s.tiles.paid.ties).toBe(true)
    expect(s.tiles.paid.helper).toBe('Ties to the pot · $100.00 rolls to the club')
  })
  it('handles no results at all', () => {
    const s = buildSummary({ final: false, betCount: 0, pools: { win: 0, place: 0, match: 0, total: 0 }, panels: [], matches: [] })
    expect(s.bettors).toEqual([])
    expect(s.tiles.top).toBe(null)
    expect(s.tiles.paid.value).toBe(0)
  })
})

describe('pool view', () => {
  it('lists each pool and filters by bettor', () => {
    const cards = poolView(model)
    expect(cards.map(c => c.kind)).toEqual(['Win', 'Place', 'Match', 'Match'])
    expect(filterPoolCards(cards, 'cy').map(c => c.key)).toEqual(['mb'])
    expect(filterPoolCards(cards, '')).toHaveLength(4)
  })
})

describe('legend', () => {
  it('explains WIN, PLACE and each match number with the players', () => {
    expect(buildSummary(model).legend).toEqual([
      { label: 'WIN', text: 'Win pool' },
      { label: 'PLACE', text: 'Place pool' },
      { label: 'M1', text: 'Lee vs Ng' },
      { label: 'M2', text: 'Ray vs Fox' },
    ])
    expect(legendOf([])).toEqual([])
  })
})
