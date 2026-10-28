import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MatchPairingsCard from './MatchPairingsCard'
import AmberBanner from './AmberBanner'

const html = el => renderToStaticMarkup(el)
const noop = () => {}
const row = (n, extra = {}) => ({
  id: `m${n}`, number: n, nameA: `A${n} Player`, nameB: `B${n} Player`, strokesA: 0, strokesB: 0,
  group: { label: 'Group 2', differ: false }, box: null, playerAId: `pa${n}`, playerBId: `pb${n}`, winnerId: null, note: null, ...extra,
})
const handlers = { onReorder: noop, onRemove: noop, onRenumber: noop, onSetWinner: noop, onAdd: noop }
const render = props => html(h(MatchPairingsCard, { rows: [row(1), row(2), row(3)], unpaired: [{ value: 'x', label: 'Bryan Cappelli' }], ...handlers, ...props }))

describe('AmberBanner', () => {
  it('shows a line warning icon, the title and the text, with no emoji', () => {
    const out = html(h(AmberBanner, { title: '3 players have no match:' }, 'Bryan (Group 1)'))
    expect(out).toContain('<svg')
    expect(out).toContain('3 players have no match:')
    expect(out).toContain('Bryan (Group 1)')
    expect(out).toContain('bg-status-upcoming-bg')
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('MatchPairingsCard (editable)', () => {
  it('shows the title, the desktop and phone subtitles, and Renumber', () => {
    const out = render()
    expect(out).toContain('Match pairings')
    expect(out).toContain('Drag to reorder. Strokes go to the higher-handicap player.')
    expect(out).toContain('Use the arrows to reorder.')
    expect(out).toContain('>Renumber<')
    expect(out).not.toMatch(/Auto-pair/i)
  })

  it('desktop table has # | Team A | Team B | Group headers, and custom team names replace Team A/B', () => {
    expect(render()).toMatch(/<span>#<\/span><span>Team A<\/span><span><\/span><span>Team B<\/span><span>Group<\/span>/)
    expect(render({ teamAName: 'USA', teamBName: 'Europe' })).toContain('<span>USA</span>')
  })

  it('each match has a drag handle, a grey-to-red trash button, and ▲/▼ on phones, all named by match number', () => {
    const out = render()
    expect(out).toContain('aria-label="Drag match 2"')
    expect(out).toContain('aria-label="Remove match 2"')
    expect(out).toContain('aria-label="Move match 2 up"')
    expect(out).toContain('aria-label="Move match 2 down"')
    expect(out).toContain('hover:text-red-600')
    expect(out).not.toContain('bg-red-')
  })

  it('▲ is disabled on the first match and ▼ on the last', () => {
    const out = render()
    expect(out).toMatch(/aria-label="Move match 1 up" disabled=""/)
    expect(out).not.toMatch(/aria-label="Move match 1 down" disabled=""/)
    expect(out).toMatch(/aria-label="Move match 3 down" disabled=""/)
    expect(out).not.toMatch(/aria-label="Move match 3 up" disabled=""/)
  })

  it('shows a green +N tag only for the player who receives strokes', () => {
    const out = render({ rows: [row(1, { strokesB: 17 })] })
    expect(out.match(/\+17/g)?.length).toBeGreaterThan(0)
    expect(out).not.toContain('+0')
    expect(out).toContain('bg-status-active-bg')
  })

  it('shows the group, and an amber "Different groups" tag when the two players are apart', () => {
    expect(render()).not.toContain('Different groups')
    const out = render({ rows: [row(1, { group: { label: 'Group 2 / Group 3', differ: true } })] })
    expect(out).toContain('Group 2 / Group 3')
    expect(out).toContain('Different groups')
  })

  it('shows the amber banner only when some players have no match', () => {
    expect(render()).not.toContain('have no match')
    const out = render({ withoutMatch: { count: 3, text: 'Bryan Cappelli, Will Vuong (Group 1) · Mat Vigil (Group 4)' } })
    expect(out).toContain('3 players have no match:')
    expect(out).toContain('Mat Vigil (Group 4)')
    expect(render({ withoutMatch: { count: 1, text: 'X (Group 1)' } })).toContain('1 player has no match:')
  })

  it('has the dashed Add match row with two labelled selects and the button', () => {
    const out = render()
    expect(out).toContain('border-dashed')
    expect(out).toContain('Team A player')
    expect(out).toContain('Team B player')
    expect(out).toContain('>Add match<')
    expect(out).toContain('Bryan Cappelli')
  })

  it('shows a "need a winner" tag in the header when matches are waiting', () => {
    expect(render({ needWinnerCount: 2 })).toContain('2 need a winner')
    expect(render({ needWinnerCount: 1 })).toContain('1 needs a winner')
  })
})

describe('tiebreak box', () => {
  const box = { headline: 'Tied after 18 · Spencer Higgins wins on tiebreak', detail: 'Net total (net) 89 vs 91', showSelect: true }

  it('appears only on rows that were given one', () => {
    const out = render({ rows: [row(1), row(2, { box })] })
    expect(out.match(/Tied after 18/g)).toHaveLength(1)
    expect(out).toContain('Net total (net) 89 vs 91')
  })

  it('has a labelled Winner select with Use tiebreaker and both players', () => {
    const out = render({ rows: [row(1, { box })] })
    expect(out).toContain('>Winner</label>')
    expect(out).toContain('Use tiebreaker')
    expect(out).toContain('>A1 Player<')
    expect(out).toContain('>B1 Player<')
  })

  it('a halved match shows the headline with no Winner select', () => {
    const out = render({ rows: [row(1, { box: { headline: 'Tied after 18 · Halved (½ point each)', detail: null, showSelect: false } })] })
    expect(out).toContain('Halved')
    expect(out).not.toContain('>Winner</label>')
  })

  it('shows a reason field only when a winner has been picked', () => {
    expect(render({ rows: [row(1, { box })] })).not.toContain('Reason (optional)')
    expect(render({ rows: [row(1, { box, winnerId: 'pa1' })] })).toContain('Reason (optional)')
  })
})

describe('MatchPairingsCard (locked)', () => {
  const lockedBox = { headline: 'Tied after 18 · Putt-off: pick the winner', detail: null, showSelect: true }
  const out = render({ locked: true, rows: [row(1, { box: lockedBox }), row(2)], teamAName: undefined })

  it('uses the locked subtitle and hides every edit control', () => {
    expect(out).toContain('Final pairings. Strokes went to the higher-handicap player.')
    expect(out).not.toContain('Renumber')
    expect(out).not.toContain('Remove match')
    expect(out).not.toContain('Drag match')
    expect(out).not.toContain('Move match')
    expect(out).not.toContain('Add match')
    expect(out).not.toContain('border-dashed')
  })

  it('keeps the tiebreak Winner select editable', () => {
    expect(out).toContain('>Winner</label>')
    expect(out).toContain('<select id=')
    expect(out).not.toContain('disabled')
  })
})

describe('MatchPairingsCard misc', () => {
  it('empty state, and no off-palette colors or emoji', () => {
    expect(render({ rows: [] })).toContain('No pairings assigned yet.')
    const out = render({ rows: [row(1, { strokesA: 4 })] })
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|amber|yellow|green|blue|purple)-/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
