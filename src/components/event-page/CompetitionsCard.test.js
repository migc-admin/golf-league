import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CompetitionsCard from './CompetitionsCard'
import { competitionGroups } from '../../lib/eventPageView'

const html = groups => renderToStaticMarkup(h(CompetitionsCard, { groups }))

describe('CompetitionsCard', () => {
  it('renders nothing when nothing is enabled', () => {
    expect(html([])).toBe('')
    expect(html(competitionGroups({}))).toBe('')
  })
  it('shows groups, rows and their variants', () => {
    const out = html(competitionGroups({
      formats: ['net_stroke', 'net_stroke_front9', 'net_stroke_back9'],
      side_game_options: ['skins_a', 'skins_b', 'ctp'],
    }))
    expect(out).toContain('Competitions &amp; side games')
    expect(out).toContain('Scoring')
    expect(out).toContain('Side games')
    expect(out).toContain('Net Stroke Play')
    expect(out).toContain('Overall · Front 9 · Back 9')
    expect(out).toContain('Flight A · Flight B')
    expect(out).toContain('Closest to Pin')
    expect(out).not.toContain('Other')
  })
  it('shows the hole in parentheses when set', () => {
    const out = html(competitionGroups({ side_game_options: ['long_drive'], long_drive_hole: 7 }))
    expect(out).toContain('(Hole 7)')
    expect(html(competitionGroups({ side_game_options: ['long_drive'] }))).not.toContain('(Hole')
  })
  it('flags a separate entry without gold', () => {
    const out = html([{ title: 'Side games', rows: [{ title: 'Skins', variants: [], sepEntry: true }] }])
    expect(out).toContain('Separate entry')
    expect(out).not.toMatch(/D4AF37|amber|yellow/i)
  })
})
