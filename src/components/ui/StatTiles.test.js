import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StatTiles, { playerTiles } from './StatTiles'

const ep = (flight, extra = {}) => ({ flight, is_guest: false, ...extra })

describe('playerTiles', () => {
  it('matches the screenshot: 4 players, none in a flight → Unassigned 4 (warn)', () => {
    const tiles = playerTiles([ep(null), ep(null), ep(null), ep(null)])
    expect(tiles.map(t => [t.label, t.value])).toEqual([['Players', 4], ['Flight A', 0], ['Flight B', 0], ['Unassigned', 4]])
    expect(tiles[3].tone).toBe('warn')
  })

  it('counts flights and unassigned from real assignments; guests are excluded', () => {
    const tiles = playerTiles([ep('A'), ep('A'), ep('B'), ep(null), ep(null, { is_guest: true })])
    expect(tiles.map(t => t.value)).toEqual([4, 2, 1, 1])
  })

  it('Unassigned is neutral when everyone has a flight', () => {
    expect(playerTiles([ep('A'), ep('B')])[3].tone).toBe('neutral')
  })

  it('handles an empty roster', () => {
    expect(playerTiles([]).map(t => t.value)).toEqual([0, 0, 0, 0])
  })
})

describe('StatTiles', () => {
  it('renders one tile per entry, 4 across on wide screens and 2 on narrow ones', () => {
    const out = renderToStaticMarkup(h(StatTiles, { tiles: playerTiles([ep(null)]) }))
    expect(out).toContain('grid-cols-2')
    expect(out).toContain('min-[700px]:grid-cols-4')
    for (const l of ['Players', 'Flight A', 'Flight B', 'Unassigned']) expect(out).toContain(`>${l}<`)
  })

  it('only the warn tile gets the gold tint; a zero shows as 0', () => {
    const warn = renderToStaticMarkup(h(StatTiles, { tiles: playerTiles([ep(null)]) }))
    expect(warn.match(/bg-status-upcoming-bg/g)).toHaveLength(1)
    const calm = renderToStaticMarkup(h(StatTiles, { tiles: playerTiles([ep('A')]) }))
    expect(calm).not.toContain('bg-status-upcoming-bg')
    expect(calm).toMatch(/Flight B<\/p><p[^>]*>0<\/p>/)
  })

  it('uses only existing tokens and no emoji', () => {
    const out = renderToStaticMarkup(h(StatTiles, { tiles: playerTiles([ep(null)]) }))
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|amber|yellow|green|red)-/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('StatTiles helper text and green tone', () => {
  it('shows a helper line under the number and a green tile for "good"', () => {
    const out = renderToStaticMarkup(h(StatTiles, { tiles: [
      { label: 'Total pot', value: '$798.00', helper: '19 players × $42' },
      { label: 'Allocated', value: '100%', helper: 'Balanced · $798.00', tone: 'good' },
    ] }))
    expect(out).toContain('19 players × $42')
    expect(out).toContain('Balanced · $798.00')
    expect(out.match(/bg-status-active-bg/g)).toHaveLength(1)
    expect(out).not.toContain('bg-status-upcoming-bg')
  })
})
