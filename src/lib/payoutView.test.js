import { describe, it, expect } from 'vitest'
import {
  money, parseKey, buildFlightTable, fullFieldKeys, ctpRows, sameAmounts, mirrorFlights, allocation, allocationSegments,
  tiedPrizeCount, paidSummary, totalPaid, cleanLabel, isTieLabel, winnerDisplay, categorySections, categoryParse,
} from './payoutView'

describe('parseKey', () => {
  it('reads flight, family and prize from every kind of key', () => {
    expect(parseKey('18_net_a_1st')).toMatchObject({ family: '18_net', familyLabel: '18-Hole Net', flight: 'A', prize: '1st', rank: 1 })
    expect(parseKey('f9_b_2nd')).toMatchObject({ family: 'f9', familyLabel: 'Front 9 Net', flight: 'B', rank: 2 })
    expect(parseKey('b9_a_1st').familyLabel).toBe('Back 9 Net')
    expect(parseKey('skins_a')).toMatchObject({ family: 'skins', flight: 'A', prize: 'Skins pool' })
    expect(parseKey('long_drive_b')).toMatchObject({ family: 'long_drive', flight: 'B', prize: 'Winner' })
    expect(parseKey('18_net_1st')).toMatchObject({ family: '18_net', flight: null })
    expect(parseKey('low_putts')).toMatchObject({ family: 'low_putts', flight: null })
    expect(parseKey('ctp_16')).toMatchObject({ family: 'ctp', hole: 16, flight: null, prize: 'Hole 16' })
    expect(parseKey('super_ctp_a_7')).toMatchObject({ family: 'super_ctp', flight: 'A', hole: 7 })
    expect(parseKey('nassau_net_f9').familyLabel).toBe('Nassau (Net)')
  })
  it('never drops an unknown key', () => {
    expect(parseKey('mystery_prize')).toMatchObject({ key: 'mystery_prize', flight: null })
  })
})

const keys = ['18_net_a_1st', '18_net_a_2nd', '18_net_a_3rd', '18_net_b_1st', '18_net_b_2nd', '18_net_b_3rd',
  'f9_a_1st', 'f9_a_2nd', 'f9_b_1st', 'f9_b_2nd', 'b9_a_1st', 'b9_a_2nd', 'b9_b_1st', 'b9_b_2nd',
  'skins_a', 'skins_b', 'long_drive_a', 'long_drive_b', 'low_putts', 'ctp_3', 'ctp_8', 'ctp_13', 'ctp_16']

describe('flight table', () => {
  const table = buildFlightTable(keys, ['A', 'B'])
  it('groups rows under 18-Hole Net, Front 9, Back 9, Skins and Long drive, in that order', () => {
    expect(table.map(g => g.label)).toEqual(['18-Hole Net', 'Front 9 Net', 'Back 9 Net', 'Skins', 'Long drive'])
  })
  it('has one row per prize with a key for each flight', () => {
    expect(table[0].rows.map(r => r.prize)).toEqual(['1st', '2nd', '3rd'])
    expect(table[0].rows[0].cells).toEqual({ A: '18_net_a_1st', B: '18_net_b_1st' })
    expect(table[3].rows[0].cells).toEqual({ A: 'skins_a', B: 'skins_b' })
  })
  it('is built from the config: a missing prize is simply absent, a third flight adds a column', () => {
    const t = buildFlightTable(['18_net_a_1st', '18_net_b_1st', '18_net_c_1st'], ['A', 'B', 'C'])
    expect(t[0].rows[0].cells).toEqual({ A: '18_net_a_1st', B: '18_net_b_1st', C: '18_net_c_1st' })
    expect(buildFlightTable(['18_net_a_1st', '18_net_a_2nd', '18_net_b_1st'], ['A', 'B'])[0].rows[1].cells).toEqual({ A: '18_net_a_2nd', B: null })
  })
  it('puts everything without a flight in the full-field list', () => {
    expect(fullFieldKeys(keys)).toEqual(['low_putts', 'ctp_3', 'ctp_8', 'ctp_13', 'ctp_16'])
  })
})

describe('closest to pin rows', () => {
  const ck = ['ctp_3', 'ctp_8', 'ctp_13', 'ctp_16']
  it('is ONE combined row when every hole has the same amount', () => {
    const rows = ctpRows({ ctp_3: 5, ctp_8: 5, ctp_13: 5, ctp_16: 5 }, ck)
    expect(rows).toEqual([{ combined: true, keys: ck, holes: [3, 8, 13, 16], amount: 5 }])
  })
  it('is one row per hole when the amounts differ', () => {
    const rows = ctpRows({ ctp_3: 5, ctp_8: 10, ctp_13: 5, ctp_16: 5 }, ck)
    expect(rows).toHaveLength(4)
    expect(rows[1]).toMatchObject({ combined: false, holes: [8], amount: 10 })
  })
  it('a single hole is never "combined", and no holes gives no rows', () => {
    expect(ctpRows({ ctp_3: 5 }, ['ctp_3'])[0].combined).toBe(false)
    expect(ctpRows({}, [])).toEqual([])
  })
})

describe('same amounts for every flight', () => {
  const table = buildFlightTable(['18_net_a_1st', '18_net_b_1st', 'skins_a', 'skins_b'], ['A', 'B'])
  it('is true only when every flight matches for every prize', () => {
    expect(sameAmounts({ '18_net_a_1st': 10, '18_net_b_1st': 10, skins_a: 5, skins_b: 5 }, table)).toBe(true)
    expect(sameAmounts({ '18_net_a_1st': 10, '18_net_b_1st': 8, skins_a: 5, skins_b: 5 }, table)).toBe(false)
  })
  it('mirrors Flight A into the other flights and keeps the same keys', () => {
    const cfg = { '18_net_a_1st': 10, '18_net_b_1st': 8, skins_a: 5, skins_b: 2, low_putts: 3 }
    const next = mirrorFlights(cfg, table, 'A')
    expect(next).toEqual({ '18_net_a_1st': 10, '18_net_b_1st': 10, skins_a: 5, skins_b: 5, low_putts: 3 })
    expect(Object.keys(next).sort()).toEqual(Object.keys(cfg).sort())
    expect(cfg['18_net_b_1st']).toBe(8) // original untouched
  })
})

describe('allocation', () => {
  it('Balanced when allocated equals the pot, otherwise Over or Under by the gap', () => {
    expect(allocation(798, 798)).toMatchObject({ status: 'balanced', percent: 100, text: 'Balanced' })
    expect(allocation(798, 800)).toMatchObject({ status: 'over', gap: 2, text: 'Over by $2.00' })
    expect(allocation(798, 700.5)).toMatchObject({ status: 'under', text: 'Under by $97.50' })
    expect(allocation(0, 0).percent).toBe(0)
  })
  it('splits the allocation into Flight A, Flight B and the rest', () => {
    const seg = allocationSegments({ '18_net_a_1st': 10, '18_net_b_1st': 8, low_putts: 3 }, k => (k === 'low_putts' ? 19 : k.includes('_a_') ? 10 : 9))
    expect(seg).toEqual({ flightA: 100, flightB: 72, field: 57, other: 0 })
  })
})

describe('results helpers', () => {
  const byPlayer = [{ playerId: 'p1', total: 234.5 }, { playerId: 'p2', total: 113.75 }, { playerId: 'p3', total: 9 }]
  const eps = [{ player_id: 'p1', flight: 'A' }, { player_id: 'p2', flight: 'B' }, { player_id: 'p3', flight: 'B' }, { player_id: 'p4', flight: 'A' }]
  it('counts players paid, by flight, and totals what was paid', () => {
    expect(paidSummary(byPlayer, eps)).toEqual({ paid: 3, perFlight: { A: 1, B: 2 } })
    expect(totalPaid(byPlayer)).toBe(357.25)
    expect(money(234.5)).toBe('$234.50')
  })
  it('counts tied prizes', () => {
    expect(tiedPrizeCount([{ isTied: true }, { isTied: false }, { isTied: true }])).toBe(2)
  })
  it('turns "(Tied — split 3 ways)" into a tag instead of part of the label', () => {
    expect(isTieLabel('Front 9 Net — Flight A, 1st (Tied — split 2 ways)')).toBe(true)
    expect(cleanLabel('Front 9 Net — Flight A, 1st (Tied — split 2 ways)')).toBe('Front 9 Net — Flight A, 1st')
    expect(isTieLabel('Skins — Flight A (14 skins)')).toBe(false)
    expect(cleanLabel('Skins — Flight A (14 skins)')).toBe('Skins — Flight A (14 skins)')
  })
})

describe('winnerDisplay', () => {
  const nameOf = id => ({ a: 'Ann Lee', b: 'Bo Chen', c: 'Cy Diaz' })[id] ?? id
  it('shows a single winner by name', () => {
    expect(winnerDisplay({ key: '18_net_a_1st', amount: 50, playerId: 'a', playerIds: ['a'], isTied: false }, nameOf)).toMatchObject({ kind: 'single', text: 'Ann Lee', helper: null })
  })
  it('a tie for 2nd shows every name and says what was combined and what each gets — never "Unresolved"', () => {
    const d = winnerDisplay({ key: '18_net_a_2nd', amount: 45, playerIds: ['b', 'c'], isTied: true }, nameOf, 3)
    expect(d).toEqual({ kind: 'tie', names: ['Bo Chen', 'Cy Diaz'], text: 'Bo Chen & Cy Diaz', helper: 'Tie for 2nd · 2nd + 3rd combined · $22.50 each' })
  })
  it('a tie on a one-off prize shows all names and the share each', () => {
    const d = winnerDisplay({ key: 'low_putts', amount: 19, playerId: 'a', playerIds: ['a', 'b'], isTied: true }, nameOf)
    expect(d.text).toBe('Ann Lee & Bo Chen')
    expect(d.helper).toBe('Tie · $9.50 each')
  })
  it('a tie for last paid place does not claim a place that is not paid', () => {
    expect(winnerDisplay({ key: 'f9_a_2nd', amount: 10, playerIds: ['a', 'b'], isTied: true }, nameOf, 2).helper).toBe('Tie for 2nd · $5.00 each')
  })
  it('only a prize with nobody on it reads "No winner yet"', () => {
    expect(winnerDisplay({ key: 'long_drive_a', amount: 20, playerId: null, playerIds: [], isTied: false }, nameOf)).toMatchObject({ kind: 'none', text: 'No winner yet' })
  })
})

describe('categorySections', () => {
  const cats = [
    { key: '18_net_a_1st', amount: 50 }, { key: '18_net_b_1st', amount: 45 },
    { key: 'f9_a_1st', amount: 30 }, { key: 'skins_a_p1', amount: 140, isSkin: true },
    { key: 'long_drive_a', amount: 20 }, { key: 'ctp_3', amount: 95 }, { key: 'low_putts', amount: 19 },
    { key: 'stf_net_a_1st', amount: 10 },
  ]
  const sections = categorySections(cats)
  it('orders sections: net, front/back 9, other scoring, long drive, Full field, then Skins last', () => {
    expect(sections.map(s => s.title)).toEqual(['18-Hole Net', 'Front 9 Net', 'Stableford Net', 'Long drive', 'Side games', 'Skins'])
  })
  it('totals each section, and puts Closest to pin and Low putts together in Side games', () => {
    expect(sections[0].total).toBe(95)
    const field = sections.find(s => s.title === 'Side games')
    expect(field.total).toBe(114)
    expect(field.cats).toHaveLength(2)
  })
  it('reads skins winners (flight or whole group) by their skins flag', () => {
    expect(categoryParse({ key: 'skins_a_3f2c9e10-aaaa-bbbb-cccc-1234567890ab', isSkin: true })).toMatchObject({ family: 'skins', flight: 'A' })
    expect(categoryParse({ key: 'skins_3f2c9e10-aaaa-bbbb-cccc-1234567890ab', isSkin: true })).toMatchObject({ family: 'skins', flight: null })
    expect(categoryParse({ key: 'super_skins_b_x', isSkin: true })).toMatchObject({ family: 'super_skins', flight: 'B' })
    const whole = categorySections([{ key: 'skins_3f2c9e10-aaaa-bbbb-cccc-1234567890ab', amount: 40, isSkin: true }])
    expect(whole[0].title).toBe('Skins')
  })
  it('keeps each skins winner row inside the Skins section', () => {
    expect(sections.find(s => s.title === 'Skins').cats[0].cat.key).toBe('skins_a_p1')
  })
})
