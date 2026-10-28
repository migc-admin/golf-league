import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import RosterCard, { formatHi, flightValue, nextFlightValue, needsFlight, filterPlayers } from './RosterCard'

const html = el => renderToStaticMarkup(el)
let n = 0
const ep = (first, last, extra = {}) => ({ id: `ep${++n}`, player: { first_name: first, last_name: last }, handicap_index: 0, flight: null, is_guest: false, ...extra })
const noop = () => {}
const handlers = { onSetFlight: noop, onSetTee: noop, onEditHi: noop, onRemove: noop }
const four = () => [ep('Colin', 'Harrison'), ep('Daniel', 'Lopez'), ep('John', 'Nothdurft'), ep('Jorge', 'Rayo')]

describe('helpers', () => {
  it('formatHi shows one decimal and defaults to 0.0', () => {
    expect(formatHi({ handicap_index: 12.4 })).toBe('12.4')
    expect(formatHi({ handicap_index: 0 })).toBe('0.0')
    expect(formatHi({ handicap_index: null })).toBe('0.0')
    expect(formatHi({})).toBe('0.0')
    expect(formatHi({ handicap_index: '8' })).toBe('8.0')
  })

  it('flightValue mirrors the old dropdown value, and tapping the selected option clears it', () => {
    expect(flightValue({ is_guest: true, flight: null })).toBe('guest')
    expect(flightValue({ is_guest: false, flight: 'B' })).toBe('B')
    expect(flightValue({ is_guest: false, flight: null })).toBe('')
    expect(nextFlightValue('', 'A')).toBe('A')
    expect(nextFlightValue('A', 'B')).toBe('B')
    expect(nextFlightValue('A', 'A')).toBe('')
    expect(nextFlightValue('guest', 'guest')).toBe('')
  })

  it('needsFlight ignores guests', () => {
    expect(needsFlight([ep('a', 'b'), ep('c', 'd', { flight: 'A' }), ep('e', 'f', { is_guest: true })])).toBe(1)
  })

  it('filterPlayers searches by first or last name, either order, case-insensitive', () => {
    const p = four()
    expect(filterPlayers(p, 'lopez')).toHaveLength(1)
    expect(filterPlayers(p, 'JOHN n')).toHaveLength(1)
    expect(filterPlayers(p, 'nothdurft john')).toHaveLength(1)
    expect(filterPlayers(p, '  ')).toHaveLength(4)
    expect(filterPlayers(p, 'zzz')).toHaveLength(0)
  })
})

describe('RosterCard', () => {
  it('matches the screenshot: 4 unassigned players, banner, headers and HI 0.0', () => {
    const out = html(h(RosterCard, { players: four(), ...handlers }))
    expect(out).toContain('>Roster<')
    expect(out).toContain('4 players still need a flight')
    expect(out).toContain('Player')
    for (const name of ['Colin Harrison', 'Daniel Lopez', 'John Nothdurft', 'Jorge Rayo']) expect(out).toContain(name)
    expect(out.match(/>0\.0</g)).toHaveLength(4)
    expect(out).not.toContain('text-red-600 text-xs') // no warning styling on HI
  })

  it('banner wording is singular for one player and hidden at zero', () => {
    expect(html(h(RosterCard, { players: [ep('A', 'B')], ...handlers }))).toContain('1 player still needs a flight')
    expect(html(h(RosterCard, { players: [ep('A', 'B', { flight: 'A' })], ...handlers }))).not.toContain('still need')
  })

  it('banner is not shown when the event has no flights', () => {
    expect(html(h(RosterCard, { players: four(), useFlights: false, ...handlers }))).not.toContain('still need')
  })

  it('each row has a labelled A | B | Guest group with aria-pressed on the selected one', () => {
    const out = html(h(RosterCard, { players: [ep('Colin', 'Harrison', { flight: 'B' })], ...handlers }))
    expect(out).toContain('role="group" aria-label="Flight for Colin Harrison"')
    expect(out).toMatch(/aria-pressed="false"[^>]*>A</)
    expect(out).toMatch(/aria-pressed="true"[^>]*>B</)
    expect(out).toMatch(/aria-pressed="false"[^>]*>Guest</)
  })

  it('without flights only the Guest toggle is offered', () => {
    const out = html(h(RosterCard, { players: [ep('Colin', 'Harrison')], useFlights: false, ...handlers }))
    expect(out).toMatch(/aria-pressed="false"[^>]*>Guest</)
    expect(out).not.toMatch(/>A<\/button>/)
  })

  it('Edit HI and Remove are named per player; all tap targets are 44px', () => {
    const out = html(h(RosterCard, { players: [ep('Colin', 'Harrison')], ...handlers }))
    expect(out).toContain('aria-label="Edit handicap for Colin Harrison"')
    expect(out).toContain('aria-label="Remove Colin Harrison"')
    expect(out).toContain('>Edit HI<')
    expect(out).toContain('min-h-[44px]')
    expect(out).not.toMatch(/min-h-\[36px\]/)
  })

  it('shows the per-player tee dropdown only when the course has tees, and keeps its value', () => {
    const tees = [{ name: 'Blue' }, { name: 'White' }]
    const out = html(h(RosterCard, { players: [ep('Colin', 'Harrison', { tee: 'White' })], tees, ...handlers }))
    expect(out).toContain('aria-label="Tee for Colin Harrison"')
    expect(out).toMatch(/<option value="White" selected="">/)
    expect(html(h(RosterCard, { players: [ep('Colin', 'Harrison')], ...handlers }))).not.toContain('Tee for')
  })

  it('has a labelled search box and an empty state', () => {
    expect(html(h(RosterCard, { players: four(), ...handlers }))).toContain('type="search"')
    expect(html(h(RosterCard, { players: [], ...handlers }))).toContain('No players added yet')
  })

  it('stacks on small screens and becomes a table from 1100px, header and rows sharing one column template', () => {
    const tees = [{ name: 'Blue' }]
    const out = html(h(RosterCard, { players: four(), tees, ...handlers }))
    expect(out).toContain('flex-col')
    const tpl = 'min-[1100px]:grid-cols-[minmax(0,1fr)_4rem_9.5rem_8rem_10rem]'
    // header + 4 rows all use the same fixed columns, so headers sit over their controls
    expect(out.split(tpl).length - 1).toBe(5)
    expect(out).not.toMatch(/grid-cols-\[[^\]]*auto/)
  })

  it('has a TEE header over the tee dropdown, and drops that column when the course has no tees', () => {
    const withTees = html(h(RosterCard, { players: four(), tees: [{ name: 'Blue' }], ...handlers }))
    expect(withTees).toContain('<span>Tee</span>')
    const without = html(h(RosterCard, { players: four(), ...handlers }))
    expect(without).not.toContain('<span>Tee</span>')
    expect(without).toContain('min-[1100px]:grid-cols-[minmax(0,1fr)_4rem_9.5rem_10rem]')
    expect(without).not.toContain('_8rem_')
  })

  it('puts the toggle and tee dropdown in their own columns in the table layout (one line per player)', () => {
    const out = html(h(RosterCard, { players: [ep('Colin', 'Harrison')], tees: [{ name: 'Blue' }], ...handlers }))
    expect(out).toContain('min-[1100px]:contents') // toggle and tee become their own grid columns
    expect(out).toContain('!w-32')
  })

  it('shows extra details (Adj, CH, MP, wins) under the name', () => {
    const out = html(h(RosterCard, { players: [ep('A', 'B', { handicap_index: 10, adjusted_handicap_index: 11, course_handicap: 12, tournament_wins_prior: 2 })], ...handlers }))
    expect(out).toContain('Adj 11 · CH 12 · 2 wins')
  })

  it('uses only existing tokens, no emoji (the warning is a line icon)', () => {
    const out = html(h(RosterCard, { players: four(), ...handlers }))
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\bbg-(?:gray|amber|yellow|green|blue|purple)-/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(out).toContain('<svg')
  })
})
