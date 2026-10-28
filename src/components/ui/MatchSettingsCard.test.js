import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MatchSettingsCard from './MatchSettingsCard'

const html = el => renderToStaticMarkup(el)
const noop = () => {}
const presets = [
  { key: 'full', label: 'Net total, then back 9, last 6, last 3, last hole' },
  { key: 'putts', label: 'Net total, fewest putts, most net pars or better, putt-off' },
  { key: 'manual', label: 'No automatic tiebreaker (I will pick the winner)' },
]
const base = { teamAName: '', teamBName: '', onTeamAName: noop, onTeamBName: noop, requireWinner: true, onRequireWinner: noop, tiePreset: 'putts', onTiePreset: noop, presets, onSave: noop }
const render = props => html(h(MatchSettingsCard, { ...base, ...props }))

describe('MatchSettingsCard (editable)', () => {
  it('has the title, subtitle, and both halves: Team names (optional) and Ties after 18 holes', () => {
    const out = render()
    expect(out).toContain('Match settings')
    expect(out).toContain('Usually set once per season.')
    expect(out).toContain('(optional)')
    expect(out).toContain('Shown on the leaderboard and results. Leave blank for no labels.')
    expect(out).toContain('Ties after 18 holes')
    expect(out).toContain('md:grid-cols-2')
  })

  it('has labelled Team A / Team B inputs and a labelled checkbox with the shorter helper', () => {
    const out = render()
    expect(out).toMatch(/<label for="[^"]+"[^>]*>Team A<\/label>/)
    expect(out).toMatch(/<label for="[^"]+"[^>]*>Team B<\/label>/)
    expect(out).toContain('Every match must have a winner')
    expect(out).toContain('Off: a tie is halved (½ point each).')
    expect(out).toContain('checked=""')
  })

  it('shows the tiebreaker options with arrows and keeps the manual-pick option', () => {
    const out = render()
    expect(out).toContain('Net total → back 9 → last 6 → last 3 → last hole')
    expect(out).toContain('Net total → fewest putts → most net pars or better → putt-off')
    expect(out).toContain('No automatic tiebreaker (I will pick the winner)')
    expect(out).toContain('The first step that separates the players decides it. A putt-off waits for you to pick the winner.')
  })

  it('greys the tiebreaker select while "must have a winner" is off, but keeps it visible', () => {
    const off = render({ requireWinner: false })
    expect(off).toContain('Tiebreaker order')
    expect(off).toMatch(/<select[^>]*disabled=""/)
    expect(render()).not.toMatch(/<select[^>]*disabled=""/)
  })

  it('has ONE save button, in the footer', () => {
    const out = render()
    expect(out.match(/Save match settings/g)).toHaveLength(1)
    expect(out).not.toMatch(/Save team names|Save Tie Rules/)
    expect(out).toContain('<footer')
  })

  it('uses only existing tokens and no emoji', () => {
    const out = render()
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|amber|yellow|green|blue|purple|red)-/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('MatchSettingsCard (locked)', () => {
  const out = render({ locked: true })
  it('uses the locked subtitle and removes the Save button', () => {
    expect(out).toContain('Locked for this event. Changes apply to future events.')
    expect(out).not.toContain('Save match settings')
    expect(out).not.toContain('<footer')
  })
  it('greys the inputs, the checkbox and the tiebreaker select (read-only)', () => {
    expect(out.match(/disabled=""/g)?.length).toBeGreaterThanOrEqual(4)
    expect(out).toMatch(/<input id="[^"]+" type="checkbox"[^>]*disabled=""/)
    expect(out).toMatch(/<select[^>]*disabled=""/)
  })
})
