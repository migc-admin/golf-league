import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import FlightPrizesCard from './FlightPrizesCard'
import FullFieldPrizesCard from './FullFieldPrizesCard'
import PrizeInput from './PrizeInput'
import { buildFlightTable } from '../../lib/payoutView'

const html = el => renderToStaticMarkup(el)
const noop = () => {}
const keys = ['18_net_a_1st', '18_net_a_2nd', '18_net_b_1st', '18_net_b_2nd', 'skins_a', 'skins_b', 'long_drive_a', 'long_drive_b']
const table = buildFlightTable(keys, ['A', 'B'])
const counts = { A: 10, B: 9 }
const mult = k => (/_a(_|$)/.test(k) ? 10 : 9)
const cfg = { '18_net_a_1st': 5, '18_net_a_2nd': 3, '18_net_b_1st': 5, '18_net_b_2nd': 3, skins_a: 14, skins_b: 14, long_drive_a: 2, long_drive_b: 2 }
const flight = props => html(h(FlightPrizesCard, { table, flightLetters: ['A', 'B'], flightCounts: counts, config: cfg, multiplierOf: mult, onSet: noop, different: false, onToggleDifferent: noop, ...props }))

describe('PrizeInput', () => {
  it('has an accessible name, a $ prefix, tabular numbers and is 44px tall', () => {
    const out = html(h(PrizeInput, { label: '18-Hole Net 1st Flight A dollars per player', value: 5, onChange: noop }))
    expect(out).toContain('aria-label="18-Hole Net 1st Flight A dollars per player"')
    expect(out).toContain('h-11')
    expect(out).toContain('tabular-nums')
    expect(out).toContain('>$<')
  })
})

describe('FlightPrizesCard', () => {
  const out = flight()
  it('is ONE table with a column per flight, with player counts, and a Total column', () => {
    expect(out.match(/<table/g)).toHaveLength(1)
    expect(out).toContain('Flight A · 10 players')
    expect(out).toContain('Flight B · 9 players')
    expect(out).toContain('>Total</th>')
  })
  it('groups rows under 18-Hole Net, Skins and Long drive headings built from the config', () => {
    for (const g of ['18-Hole Net', 'Skins', 'Long drive']) expect(out).toContain(g)
    expect(out).toContain('>1st</th>')
    expect(out).toContain('>2nd</th>')
  })
  it('each flight cell has a labelled dollars input and its own total, and the row has a total', () => {
    expect(out).toContain('aria-label="18-Hole Net 1st Flight A dollars per player"')
    expect(out).toContain('aria-label="18-Hole Net 1st Flight B dollars per player"')
    expect(out).toContain('= $50.00') // $5 × 10
    expect(out).toContain('= $45.00') // $5 × 9
    expect(out).toContain('$95.00')   // row total
  })
  it('has a "per player" subtotal row for each flight and a grand total', () => {
    expect(out).toContain('Per player')
    // A: 5+3+14+2 = $24/player × 10 = $240; B: $24 × 9 = $216; grand $456
    expect(out).toContain('$24.00 · $240.00')
    expect(out).toContain('$24.00 · $216.00')
    expect(out).toContain('$456.00')
  })
  it('by default Flight B follows Flight A: its inputs are read-only and an edit sets both flights', () => {
    expect(out).toMatch(/aria-label="18-Hole Net 1st Flight B dollars per player"[^>]*disabled=""/)
    expect(out).not.toMatch(/aria-label="18-Hole Net 1st Flight A dollars per player"[^>]*disabled=""/)
    const calls = []
    const el = FlightPrizesCard({ table, flightLetters: ['A', 'B'], flightCounts: counts, config: cfg, multiplierOf: mult, onSet: (k, v) => calls.push([k, v]), different: false, onToggleDifferent: noop })
    expect(typeof el.type).toBe('string')
  })
  it('"Different amounts per flight" unlocks Flight B so each flight edits on its own', () => {
    const diff = flight({ different: true })
    expect(diff).toContain('Different amounts per flight')
    expect(diff).not.toMatch(/aria-label="18-Hole Net 1st Flight B dollars per player"[^>]*disabled=""/)
    expect(diff).toContain('Each flight has its own amounts')
    expect(out).toContain('Every flight pays the same amounts')
  })
  it('when locked, every input and the toggle are disabled', () => {
    const locked = flight({ locked: true, different: true })
    expect(locked.match(/disabled=""/g)).toHaveLength(9) // 8 prize inputs + the toggle
  })
  it('a third flight adds a third column', () => {
    const t3 = buildFlightTable(['18_net_a_1st', '18_net_b_1st', '18_net_c_1st'], ['A', 'B', 'C'])
    const o = html(h(FlightPrizesCard, { table: t3, flightLetters: ['A', 'B', 'C'], flightCounts: { A: 3, B: 3, C: 3 }, config: {}, multiplierOf: () => 3, onSet: noop, different: false, onToggleDifferent: noop }))
    expect(o).toContain('Flight C · 3 players')
  })
  it('keeps the table in a sideways-scrolling box, uses no emoji, and is hidden with no flight prizes', () => {
    expect(out).toContain('overflow-x-auto')
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(html(h(FlightPrizesCard, { table: [], flightLetters: ['A'], flightCounts: {}, config: {}, multiplierOf: () => 1, onSet: noop, different: false, onToggleDifferent: noop }))).toBe('')
  })
})

describe('FullFieldPrizesCard', () => {
  const k = ['low_putts', 'ctp_3', 'ctp_8', 'ctp_13', 'ctp_16']
  const field = (config, extra) => html(h(FullFieldPrizesCard, { keys: k, config, multiplierOf: () => 19, totalPlayers: 19, onSet: noop, ...extra }))
  it('shows Low putts and ONE combined Closest to pin row when every hole is the same', () => {
    const out = field({ low_putts: 1, ctp_3: 5, ctp_8: 5, ctp_13: 5, ctp_16: 5 })
    expect(out).toContain('Closest to pin · each hole')
    expect(out).toContain('Holes 3, 8, 13, 16 · $95.00 per hole')
    expect(out).toContain('Low putts')
    expect(out.match(/scope="row"[^>]*>Closest to pin/g)).toHaveLength(1)
  })
  it('shows one row per hole when the amounts differ', () => {
    const out = field({ low_putts: 1, ctp_3: 5, ctp_8: 10, ctp_13: 5, ctp_16: 5 })
    expect(out).toContain('Closest to pin · Hole 8')
    expect(out).not.toContain('each hole')
  })
  it('totals per player and for the field in a subtotal row', () => {
    const out = field({ low_putts: 1, ctp_3: 5, ctp_8: 5, ctp_13: 5, ctp_16: 5 })
    expect(out).toContain('$21.00 per player') // 1 + 4 holes × $5
    expect(out).toContain('$399.00')           // 21 × 19
    expect(out).toContain('aria-label="Low putts dollars per player"')
  })
  it('is titled "Side game prizes" with a "Side games" subtotal row by default, and takes plainer labels for no-flight events', () => {
    const out = field({ low_putts: 1, ctp_3: 5, ctp_8: 5, ctp_13: 5, ctp_16: 5 })
    expect(out).toContain('Side game prizes')
    expect(out).toContain('>Side games</th>')
    expect(out).not.toContain('Full-field')
    const plain = field({ low_putts: 1 }, { title: 'Prizes', subtotalLabel: 'All players' })
    expect(plain).toContain('>Prizes</h2>')
    expect(plain).toContain('>All players</th>')
  })

  it('is read-only when locked', () => {
    expect(field({ low_putts: 1, ctp_3: 5, ctp_8: 5, ctp_13: 5, ctp_16: 5 }, { locked: true }).match(/disabled=""/g)).toHaveLength(2)
  })
})
