import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReadinessCard, { buildReadiness } from './ReadinessCard'

const p = (flight, extra = {}) => ({ player_id: Math.random(), flight, is_guest: false, ...extra })
const byKey = items => Object.fromEntries(items.map(i => [i.key, i]))

describe('buildReadiness', () => {
  it('matches the Overview screenshot: 1 player with no flight, nothing else set', () => {
    const items = buildReadiness({ event: { use_flights: true, description: null, registration_spots: null, cover_image_url: null }, eventPlayers: [p(null)] })
    const k = byKey(items)
    expect(items).toHaveLength(5)
    expect(items.filter(i => i.done)).toHaveLength(1)
    expect(k.players.done).toBe(true)
    expect(k.players.detail).toBe('1 player registered')
    expect(k.flights.done).toBe(false)
    expect(k.flights.warn).toBe(true)
    expect(k.flights.detail).toBe("1 player isn't in a flight")
  })

  it('lists items in the order: spots, description, players, cover photo, flights', () => {
    const items = buildReadiness({ event: { use_flights: true }, eventPlayers: [] })
    expect(items.map(i => i.key)).toEqual(['spots', 'description', 'players', 'cover', 'flights'])
  })

  it('uses plural wording for several unassigned players', () => {
    const { flights } = byKey(buildReadiness({ event: { use_flights: true }, eventPlayers: [p(null), p(null), p('A')] }))
    expect(flights.detail).toBe("2 players aren't in a flight")
  })

  it('flights are done only when every non-guest player has a flight; guests are ignored', () => {
    const ok = byKey(buildReadiness({ event: { use_flights: true }, eventPlayers: [p('A'), p('B'), p(null, { is_guest: true })] }))
    expect(ok.flights.done).toBe(true)
    expect(ok.players.detail).toBe('2 players registered')
  })

  it('with no players, players and flights are both not done (no vacuous pass)', () => {
    const k = byKey(buildReadiness({ event: { use_flights: true }, eventPlayers: [] }))
    expect(k.players.done).toBe(false)
    expect(k.flights.done).toBe(false)
    expect(k.flights.warn).toBe(false)
  })

  it('leaves the flights item out when the event does not use flights', () => {
    const items = buildReadiness({ event: { use_flights: false }, eventPlayers: [p('A')] })
    expect(items.map(i => i.key)).toEqual(['spots', 'description', 'players', 'cover'])
  })

  it('description, spots and cover are done only when really set', () => {
    const empty = byKey(buildReadiness({ event: { description: '   ', registration_spots: 0, cover_image_url: '' }, eventPlayers: [] }))
    expect([empty.description.done, empty.spots.done, empty.cover.done]).toEqual([false, false, false])
    const set = byKey(buildReadiness({ event: { description: 'Hi', registration_spots: 40, cover_image_url: 'x.jpg' }, eventPlayers: [] }))
    expect([set.description.done, set.spots.done, set.cover.done]).toEqual([true, true, true])
  })
})

describe('ReadinessCard', () => {
  const items = buildReadiness({ event: { use_flights: true }, eventPlayers: [p(null)] })

  it('shows title, "X of N done", a progress bar and one action per item', () => {
    const out = renderToStaticMarkup(h(ReadinessCard, { items }))
    expect(out).toContain('Ready to activate?')
    expect(out).toContain('1 of 5 done')
    expect(out).toContain('role="progressbar"')
    expect(out).toContain('width:20%')
    for (const label of ['Set', 'Add', 'Manage', 'Upload', 'Assign']) expect(out).toContain(`>${label}<`)
  })

  it('shows the amber helper only for the flights warning', () => {
    const out = renderToStaticMarkup(h(ReadinessCard, { items }))
    expect(out).toContain('text-status-upcoming-text')
    expect(out.match(/text-status-upcoming-text/g)).toHaveLength(1)
  })

  it('has an id for the sidebar anchor, no primary button, and no emoji', () => {
    const out = renderToStaticMarkup(h(ReadinessCard, { items }))
    expect(out).toContain('id="readiness"')
    expect(out).not.toContain('bg-fairway-700 border-fairway-700 text-white')
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('calls onAction with the item key', () => {
    const calls = []
    const el = ReadinessCard({ items, onAction: k => calls.push(k) })
    const list = el.props.children[1]
    list.props.children[4].props.children[2].props.onClick()
    expect(calls).toEqual(['flights'])
  })
})
