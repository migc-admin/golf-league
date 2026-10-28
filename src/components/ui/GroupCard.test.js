import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { DndContext } from '@dnd-kit/core'
import GroupCard from './GroupCard'

let n = 0
const ep = (first, last, flight, extra = {}) => ({ id: `e${++n}`, player_id: `p${n}`, player: { first_name: first, last_name: last }, flight, ...extra })
const noop = () => {}
const render = props => renderToStaticMarkup(h(DndContext, null, h(GroupCard, { id: 'group-0', title: 'Group 1', subtitle: '4 players', teeTime: '9:50 AM', onMove: noop, onReturnToPool: noop, ...props })))
const four = () => [ep('Tam', 'Tran', 'A'), ep('Colin', 'Harrison', 'B'), ep('Bryan', 'Cappelli', 'A'), ep('Will', 'Vuong', 'B')]
const options = [{ key: 'ungrouped', label: 'Unassigned' }, { key: 'group-0', label: 'Group 1 · 9:50 AM (full)' }, { key: 'group-1', label: 'Group 2 · 10:00 AM (4 open)' }]

describe('GroupCard (editable)', () => {
  it('shows the name, player count and tee time in the header', () => {
    const out = render({ members: four() })
    expect(out).toContain('Group 1')
    expect(out).toContain('4 players')
    expect(out).toContain('9:50 AM')
  })

  it('tags scorers, and shows flight A in forest green and B in neutral grey', () => {
    const members = four()
    const out = render({ members, scorerIdSet: new Set([members[0].id]), moveOptions: options })
    expect(out.match(/>Scorer</g)).toHaveLength(1)
    expect(out).toMatch(/bg-status-active-bg[^>]*>A</)
    expect(out).toMatch(/bg-surface-high text-ink-muted[^>]*>B</)
  })

  it('every row has a 44px height, a drag handle, and a grey-to-red remove icon button named for the player', () => {
    const out = render({ members: [ep('Tam', 'Tran', 'A')] })
    expect(out).toContain('min-h-[44px]')
    expect(out).toContain('aria-label="Drag Tam Tran"')
    expect(out).toContain('aria-label="Remove Tam Tran from group"')
    expect(out).toContain('hover:text-red-600')
    expect(out).not.toContain('bg-red-')
  })

  it('shows a dashed open-spot target when the group has fewer than 4 players, none when full', () => {
    expect(render({ members: [ep('A', 'B', 'A')] })).toContain('Open spot · drop a player here')
    expect(render({ members: four() })).not.toContain('Open spot')
  })

  it('on phones each row gets a labelled Group menu with the current group selected; the handle is desktop-only', () => {
    const out = render({ members: [ep('Tam', 'Tran', 'A')], moveOptions: options })
    expect(out).toContain('md:hidden')
    expect(out).toMatch(/<span>Group<\/span><select[^>]*value="group-0"|<option value="group-0" selected="">/)
    expect(out).toContain('Group 2 · 10:00 AM (4 open)')
    expect(out).toContain('hidden cursor-grab')
  })

  it('shows No show / Undo only when the page asks for it, and the No show tag replaces the flight tag', () => {
    const a = ep('Tam', 'Tran', 'A'), b = ep('Colin', 'Harrison', 'B')
    const noShow = { show: true, isNoShow: e => e.id === b.id, loadingId: null, onMark: noop, onClear: noop }
    const out = render({ members: [a, b], noShow })
    expect(out).toContain('>No show<')
    expect(out).toContain('>Undo<')
    expect(render({ members: [a] })).not.toContain('No show')
  })

  it('the pool card can drop the open spot', () => {
    expect(render({ members: [], showOpenSpot: false })).not.toContain('Open spot')
  })

  it('uses only existing color tokens and no emoji', () => {
    const out = render({ members: four(), moveOptions: options })
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|amber|yellow|green|blue|purple)-/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})

describe('GroupCard (locked)', () => {
  it('hides handles, remove buttons, the Group menu, the open spot and No show controls', () => {
    const out = render({ members: [ep('Tam', 'Tran', 'A')], locked: true, moveOptions: options })
    expect(out).not.toContain('aria-label="Drag')
    expect(out).not.toContain('Remove')
    expect(out).not.toContain('<select')
    expect(out).not.toContain('Open spot')
    expect(out).toContain('Tam Tran')
  })

  it('still shows who is in the group and the tee time', () => {
    const out = render({ members: four(), locked: true })
    expect(out).toContain('Colin Harrison')
    expect(out).toContain('9:50 AM')
  })
})
