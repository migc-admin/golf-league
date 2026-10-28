import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import FlightsTeesCard, { teeOptionLabel } from './FlightsTeesCard'

const html = el => renderToStaticMarkup(el)
const tees = [{ name: 'Blue', color: 'blue', slope: 131, rating: 71.2 }, { name: 'White', slope: 125, rating: 69.4 }]
const two = [
  { key: 'A', title: 'Flight A', count: 3, value: '', onChange: () => {} },
  { key: 'B', title: 'Flight B', count: 1, value: 'Blue', onChange: () => {} },
]

describe('teeOptionLabel', () => {
  it('matches the old dropdown text, with the colour only when there is one', () => {
    expect(teeOptionLabel(tees[0])).toBe('Blue (blue) — Slope 131 / Rating 71.2')
    expect(teeOptionLabel(tees[1])).toBe('White — Slope 125 / Rating 69.4')
  })
})

describe('FlightsTeesCard', () => {
  it('shows the title and subtitle, and two side-by-side panels that stack on mobile', () => {
    const out = html(h(FlightsTeesCard, { panels: two, tees }))
    expect(out).toContain('Flights &amp; tees')
    expect(out).toContain('Choose which tees each flight plays from.')
    expect(out).toContain('sm:grid-cols-2')
    expect(out).toContain('Flight A')
    expect(out).toContain('Flight B')
  })

  it('shows player counts with correct singular/plural', () => {
    const out = html(h(FlightsTeesCard, { panels: two, tees }))
    expect(out).toContain('3 players')
    expect(out).toContain('1 player<')
  })

  it('each panel has a labelled Tees select with a "Not assigned" option and every tee', () => {
    const out = html(h(FlightsTeesCard, { panels: two, tees }))
    expect(out.match(/>Tees<\/label>/g)).toHaveLength(2)
    expect(out.match(/<option value=""[^>]*>Not assigned<\/option>/g)).toHaveLength(2)
    expect(out).toContain('aria-label="Tees for Flight A"')
    expect(out).toContain('Blue (blue) — Slope 131 / Rating 71.2')
    expect(out).toMatch(/<option value="Blue" selected="">/)
  })

  it('with no flights it shows a single panel and the player wording', () => {
    const out = html(h(FlightsTeesCard, { useFlights: false, tees, panels: [{ key: 'all', title: 'All players', value: '', onChange: () => {} }] }))
    expect(out).toContain('Choose which tees players play from.')
    expect(out).not.toContain('sm:grid-cols-2')
    expect(out.match(/>Tees<\/label>/g)).toHaveLength(1)
  })

  it('has no Auto-assign button (not built yet), keeps the anchor id, and uses only existing tokens', () => {
    const out = html(h(FlightsTeesCard, { panels: two, tees }))
    expect(out).not.toMatch(/Auto-assign/i)
    expect(out).toContain('id="flights-tees"')
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })

  it('wires each select to its own handler', () => {
    const calls = []
    const el = FlightsTeesCard({ tees, panels: [{ key: 'A', title: 'Flight A', value: '', onChange: v => calls.push(['A', v]) }, { key: 'B', title: 'Flight B', value: '', onChange: v => calls.push(['B', v]) }] })
    const grid = el.props.children[1]
    const panels = grid.props.children
    // each TeePanel gets its own panel object
    expect(panels).toHaveLength(2)
    panels[0].props.panel.onChange('Blue')
    panels[1].props.panel.onChange('White')
    expect(calls).toEqual([['A', 'Blue'], ['B', 'White']])
  })
})
