import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PayoutResultsCard from './PayoutResultsCard'

const html = el => renderToStaticMarkup(el)
const names = { p1: 'John Nothdurft', p2: 'Paul Hsieh', p3: 'Max Obrien', p4: 'Will Vuong' }
const nameOf = id => names[id] ?? id
const flightOf = id => ({ p1: 'A', p2: 'B', p3: 'B', p4: 'B' })[id]

const byPlayer = [
  { playerId: 'p1', total: 234.5, items: [
    { category: '18-Hole Net — Flight A, 1st', amount: 50 },
    { category: 'Skins — Flight A (14 skins)', amount: 140 },
    { category: 'Front 9 Net — Flight A, 1st (Tied — split 2 ways)', amount: 15 },
    { category: 'Low Putts (Full Field) (Tied — split 2 ways)', amount: 9.5 },
  ] },
  { playerId: 'p2', total: 113.75, items: [{ category: '18-Hole Net — Flight B, 1st', amount: 113.75 }] },
  { playerId: 'p4', total: 9, items: [{ category: 'Closest to Pin — Hole 3 (Full Field)', amount: 9 }] },
]
const byCategory = [
  { key: '18_net_a_1st', label: '18-Hole Net — Flight A, 1st', amount: 50, playerId: 'p1', playerIds: ['p1'], isTied: false },
  { key: '18_net_b_1st', label: '18-Hole Net — Flight B, 1st', amount: 45, playerId: 'p2', playerIds: ['p2'], isTied: false },
  { key: '18_net_b_2nd', label: '18-Hole Net — Flight B, 2nd (Tied — split 2 ways)', amount: 45, playerIds: ['p3', 'p4'], isTied: true },
  { key: 'skins_a_p1', label: 'Skins — Flight A (14 skins)', amount: 140, playerId: 'p1', isSkin: true },
  { key: 'long_drive_a', label: 'Long Drive — Flight A', amount: 20, playerId: null, playerIds: [], isTied: false },
  { key: 'low_putts', label: 'Low Putts (Full Field) (Tied — split 2 ways)', amount: 19, playerId: 'p1', playerIds: ['p1', 'p2'], isTied: true },
  { key: 'ctp_3', label: 'Closest to Pin — Hole 3 (Full Field)', amount: 9, playerId: 'p4', playerIds: ['p4'], isTied: false },
]
const base = { byPlayer, byCategory, nameOf, flightOf, noPayout: ['Bryan Cappelli', 'Daniel Lopez'], maxRank: { '18_net': 3 }, longDriveHole: 12 }
const render = props => html(h(PayoutResultsCard, { ...base, ...props }))

describe('Payout results — By player', () => {
  const out = render({ defaultView: 'player' })
  it('is one card with the title, the paid count and a By category | By player toggle', () => {
    expect(out).toContain('Payout results')
    expect(out).toContain('3 players paid, highest first. Select a player to see what they won.')
    expect(out).toMatch(/aria-pressed="true"[^>]*>By player</)
    expect(out).toMatch(/aria-pressed="false"[^>]*>By category</)
    expect(out.indexOf('>By category<')).toBeLessThan(out.indexOf('>By player<'))
  })
  it('shows one collapsed row per player: rank, name, flight tag, prize count and total', () => {
    expect(out).toContain('John Nothdurft')
    expect(out).toContain('4 prizes')
    expect(out).toContain('1 prize<')
    expect(out).toContain('$234.50')
    expect(out).toContain('$113.75')
    expect(out).toContain('$9.00')
    expect(out.match(/aria-expanded="false"/g)).toHaveLength(3)
    expect(out).not.toContain('Skins — Flight A') // breakdown hidden until expanded
  })
  it('rows are real buttons that control their breakdown', () => {
    expect(out).toMatch(/<button type="button" aria-expanded="false" aria-controls="prizes-p1"/)
    expect(out).toContain('>Expand all<')
  })
  it('the footer lists players with no payout and the total paid', () => {
    expect(out).toContain('No payout: Bryan Cappelli, Daniel Lopez')
    expect(out).toContain('Total paid $357.25')
  })
  it('only one list is on screen: the category sections are not rendered', () => {
    expect(out).not.toContain('Side games')
    expect(out).not.toContain('18-Hole Net</h3>')
  })
  it('uses money in tabular numbers and no emoji or off-palette colors', () => {
    expect(out).toContain('tabular-nums')
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })
})

describe('Payout results — By category (the default)', () => {
  const out = render()
  it('shows sections with their totals and Flight A / Flight B side by side', () => {
    expect(out).toContain('18-Hole Net</h3>')
    expect(out).toContain('$140.00')
    expect(out).toContain('Flight A')
    expect(out).toContain('Flight B')
    expect(out).toContain('md:grid-cols-2')
    expect(out).toContain('Side games</h3>')
  })
  it('lists Skins at the bottom, after every other section', () => {
    const order = ['18-Hole Net</h3>', 'Long drive · Hole 12</h3>', 'Side games</h3>', 'Skins</h3>'].map(t => out.indexOf(t))
    expect(order.every(i => i > 0)).toBe(true)
    expect([...order].sort((x, y) => x - y)).toEqual(order)
  })
  it('skins rows show the skin count and a per-skin value; long drive shows the hole', () => {
    expect(out).toContain('14 skins')
    expect(out).toContain('$10.00 per skin')
    expect(out).toContain('Long drive · Hole 12')
  })
  it('a tie lists every tied name on one row with a helper line — never "Unresolved"', () => {
    expect(out).toContain('Max Obrien &amp; Will Vuong')
    expect(out).toContain('Tie for 2nd · 2nd + 3rd combined · $22.50 each')
    expect(out).toContain('John Nothdurft &amp; Paul Hsieh')
    expect(out).toContain('Tie · $9.50 each')
    expect(out).not.toMatch(/Unresolved/i)
  })
  it('a prize nobody has won reads "No winner yet"', () => {
    expect(out).toContain('No winner yet')
  })
  it('opens on By category, with the toggle listing By category first', () => {
    expect(out).toMatch(/aria-pressed="true"[^>]*>By category</)
    expect(out).toMatch(/aria-pressed="false"[^>]*>By player</)
    expect(out.indexOf('>By category<')).toBeLessThan(out.indexOf('>By player<'))
  })
  it('the By player list is not rendered at the same time', () => {
    expect(out).not.toContain('Expand all')
  })
})

describe('Payout results — expanded rows and empty state', () => {
  it('shows an empty message when nothing is resolved', () => {
    expect(render({ byPlayer: [], byCategory: [] })).toContain('No payouts resolved yet.')
  })
})
