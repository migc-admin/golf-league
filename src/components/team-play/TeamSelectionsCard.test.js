import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import TeamSelectionsCard from './TeamSelectionsCard'
import { teamSelection, lockState } from '../../lib/teamPlayView'

const html = el => renderToStaticMarkup(el)
const noop = () => {}
const teams = [{ id: 't1', name: 'The Money Team', color: '#aa2222' }, { id: 't2', name: 'Just the Tips', color: '#22aa44' }]
const mem = (team_id, id, first) => ({ team_id, player_id: id, player: { first_name: first, last_name: 'X' } })
const members = [mem('t1', 'a', 'John'), mem('t1', 'b', 'Mikel'), mem('t1', 'c', 'Carlos'), mem('t1', 'd', 'Ab'), mem('t1', 'e', 'Mark'), mem('t2', 'f', 'Kevin')]
const sels = [{ id: 's1', team_id: 't1', player_id: 'a' }, { id: 's2', team_id: 't1', player_id: 'b' }, { id: 's3', team_id: 't2', player_id: 'f' }]
const build = (lock, selections = sels, registered = ['a', 'b', 'c', 'f']) => teams.map((team, i) => ({
  team, rank: i + 1, points: i === 0 ? 14 : 13.5,
  sel: teamSelection({ team, members: members.filter(m => m.team_id === team.id), selections, allSelections: selections, teams, registeredIds: new Set(registered), pointsByPlayer: { a: 10, b: 4, f: 9 }, lock }),
}))
const locked = html(h(TeamSelectionsCard, { cards: build(lockState({ status: 'complete' }, false)), locked: true, onToggle: noop }))
const editable = html(h(TeamSelectionsCard, { cards: build(lockState({ status: 'upcoming' }, false), sels.slice(0, 1)), locked: false, onToggle: noop, onRoster: noop, onDeleteTeam: noop, onRemoveOther: noop }))

describe('TeamSelectionsCard — locked view', () => {
  it('has the title and the locked subtitle', () => {
    expect(locked).toContain('>Team selections<')
    expect(locked).toContain('Who played for each team. Rosters collapsed to save space.')
  })
  it('each team card shows its name, rank and points, and the "Playing this event" label', () => {
    expect(locked).toContain('The Money Team')
    expect(locked).toContain('1st · 14 pts')
    expect(locked).toContain('2nd · 13.5 pts')
    expect(locked).toContain('Playing this event · 2 of 2')
  })
  it('shows only the selected players, checked and disabled, with their points', () => {
    expect(locked).toContain('John X')
    expect(locked).toContain('10 pts')
    const boxes = locked.match(/<input[^>]*type="checkbox"[^>]*>/g)
    expect(boxes).toHaveLength(3) // only the 3 selected players
    expect(boxes.every(b => b.includes('checked=""') && b.includes('disabled=""'))).toBe(true)
    expect(locked).not.toContain('Carlos X')
  })
  it('hides the rest of the roster behind a button that says how many are hidden', () => {
    expect(locked).toContain('Show rest of roster (3)')
    expect(locked).toContain('aria-expanded="false"')
    expect(locked).not.toContain('Rest of roster</p>')
  })
  it('has no edit controls: no Roster, delete, Lock or New team', () => {
    for (const t of ['>Roster<', 'Delete ', 'Lock selections', 'New team']) expect(locked).not.toContain(t)
  })
})

describe('TeamSelectionsCard — editable view', () => {
  it('has the editable subtitle and lists the rest of the roster as checkbox rows', () => {
    expect(editable).toContain('Pick 2 players per team from those registered for this event.')
    expect(editable).toContain('Rest of roster')
    expect(editable).toContain('aria-label="Select Carlos X for The Money Team"')
  })
  it('registered players are listed first and tagged IN EVENT; the others say Not registered and are disabled', () => {
    expect(editable).toContain('In event')
    expect(editable).toContain('Not registered')
    expect(editable.indexOf('Carlos X')).toBeLessThan(editable.indexOf('Ab X'))
    expect(editable).toMatch(/aria-label="Select Ab X for The Money Team"[^>]*disabled=""|disabled=""[^>]*aria-label="Select Ab X for The Money Team"/)
  })
  it('rows are at least 44px tall', () => {
    expect(editable).toContain('min-h-[44px]')
  })
  it('shows Roster and a labelled delete button per team', () => {
    expect(editable).toContain('>Roster<')
    expect(editable).toContain('aria-label="Delete The Money Team"')
  })
  it('a team with all its players disables the unchecked boxes', () => {
    const full = html(h(TeamSelectionsCard, { cards: build(lockState({ status: 'upcoming' }, false)), locked: false, onToggle: noop }))
    expect(full).toMatch(/aria-label="Select Carlos X for The Money Team"[^>]*disabled=""|disabled=""[^>]*aria-label="Select Carlos X for The Money Team"/)
  })
  it('someone picked by another team shows "On {team}" and a Remove button', () => {
    const cards = build(lockState({ status: 'upcoming' }, false), [...sels.slice(0, 1), { id: 'x', team_id: 't2', player_id: 'c' }], ['a', 'b', 'c', 'f'])
    const o = html(h(TeamSelectionsCard, { cards, locked: false, onToggle: noop, onRemoveOther: noop }))
    expect(o).toContain('On Just the Tips')
    expect(o).toContain('>Remove<')
  })
  it('renders the page-supplied header button (Lock selections) only when editable', () => {
    const btn = h('button', null, 'Lock selections')
    expect(html(h(TeamSelectionsCard, { cards: build(lockState({ status: 'upcoming' }, false)), locked: false, headerAction: btn, onToggle: noop }))).toContain('Lock selections')
    expect(html(h(TeamSelectionsCard, { cards: build(lockState({ status: 'complete' }, false)), locked: true, headerAction: btn, onToggle: noop }))).not.toContain('Lock selections')
  })
})

describe('TeamSelectionsCard — general', () => {
  it('uses an auto-fill grid that stacks on phones', () => {
    expect(locked).toContain('grid-cols-[repeat(auto-fill,minmax(min(100%,20rem),1fr))]')
  })
  it('uses no team colors and no emoji', () => {
    for (const c of ['#aa2222', '#22aa44']) { expect(locked).not.toContain(c); expect(editable).not.toContain(c) }
    expect(locked).not.toMatch(/\p{Extended_Pictographic}/u)
  })
  it('before scores it shows the roster size instead of points', () => {
    const cards = build(lockState({ status: 'upcoming' }, false)).map(c => ({ ...c, points: null, rank: null }))
    expect(html(h(TeamSelectionsCard, { cards, locked: false, onToggle: noop }))).toContain('5 players')
  })
})
