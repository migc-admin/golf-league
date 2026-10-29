import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MatchupsCard from './MatchupsCard'
import { matchupRows } from '../../lib/eventPageView'

const pairings = [
  { id: 'm1', match_number: 1, player_a_id: 'a', player_b_id: 'b', playerA: { first_name: 'Sam', last_name: 'Lee' }, playerB: { first_name: 'Joe', last_name: 'Ng' } },
  { id: 'm2', match_number: 2, player_a_id: 'c', player_b_id: 'd', playerA: { first_name: 'Al', last_name: 'Ray' }, playerB: { first_name: 'Bo', last_name: 'Fox' } },
]
const eps = [
  { player_id: 'a', course_handicap: 12 }, { player_id: 'b', course_handicap: 8 },
  { player_id: 'c', course_handicap: 5 }, { player_id: 'd', course_handicap: 5 },
]

describe('matchupRows', () => {
  it('gives the higher handicap the difference in strokes', () => {
    const [m1, m2] = matchupRows(pairings, eps)
    expect(m1.a).toEqual({ name: 'Sam Lee', strokes: 4 })
    expect(m1.b).toEqual({ name: 'Joe Ng', strokes: 0 })
    expect(m2.a.strokes).toBe(0)
  })
  it('handles no pairings', () => {
    expect(matchupRows(null, null)).toEqual([])
  })
})

describe('MatchupsCard', () => {
  const rows = matchupRows(pairings, eps)
  it('renders nothing without matches', () => {
    expect(renderToStaticMarkup(h(MatchupsCard, { rows: [] }))).toBe('')
  })
  it('lists each match with names and strokes only where they apply', () => {
    const out = renderToStaticMarkup(h(MatchupsCard, { rows, onSeePairings() {} }))
    expect(out).toContain('Matchups')
    expect(out).toContain('Match 1')
    expect(out).toContain('Sam Lee')
    expect(out).toContain('+4')
    expect(out).not.toContain('+0')
    expect(out).toContain('Tee times &amp; pairings')
  })
  it('hides the pairings link without a handler and uses no flight colors', () => {
    const out = renderToStaticMarkup(h(MatchupsCard, { rows, subtitle: 'Team A vs Team B' }))
    expect(out).not.toContain('Tee times')
    expect(out).toContain('Team A vs Team B')
    expect(out).not.toMatch(/blue|purple|1d4ed8|6d28d9/)
  })
})
