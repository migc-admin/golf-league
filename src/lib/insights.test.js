import { describe, it, expect } from 'vitest'
import { seasonInsights, median, ctpWinsByFlight } from './insights'

const r = (player, playerId, eventId, course, flight, gross, net, putts = null) => ({ player, playerId, eventId, course, event: `Event ${eventId}`, flight, gross, net, putts })
const rows = [
  r('Ann', 'a', 'e1', 'Cross Creek', 'A', 90, 80, 30),
  r('Ann', 'a', 'e2', 'Vineyard', 'A', 80, 72, 26),
  r('Bo', 'b', 'e1', 'Cross Creek', 'B', 120, 84, null),
  r('Cy', 'c', 'e2', 'Vineyard', 'B', 100, 78, 28),
]
const card = (cards, key) => cards.find(c => c.key === key)

describe('median', () => {
  it('handles odd, even and empty lists', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
    expect(median([])).toBeNull()
  })
})

describe('seasonInsights', () => {
  const c = seasonInsights(rows, { ctpByFlight: { A: 3, B: 1 } })
  it('records: high and low gross, lowest putts', () => {
    expect(card(c, 'high-gross').title).toBe('Bo — 120')
    expect(card(c, 'high-gross').sub).toBe('Cross Creek')
    expect(card(c, 'low-gross').title).toBe('Ann — 80')
    expect(card(c, 'low-putts').title).toBe('Ann — 26')
  })
  it('names the tie when players share a record', () => {
    const t = seasonInsights([r('Ann', 'a', 'e1', 'X', 'A', 80, 70), r('Bo', 'b', 'e1', 'X', 'A', 80, 71)])
    expect(card(t, 'low-gross').title).toBe('2 Tied — 80')
    expect(card(t, 'low-gross').sub).toBe('Ann, Bo')
  })
  it('most tournaments attended and lowest average (two rounds minimum)', () => {
    expect(card(c, 'most-attended').title).toBe('Ann')
    expect(card(c, 'most-attended').sub).toBe('2 tournaments')
    expect(card(c, 'low-avg-player').title).toBe('Ann')
    expect(card(c, 'low-avg-player').sub).toBe('85 avg gross')
  })
  it('course averages and median net by flight', () => {
    expect(card(c, 'high-avg-course').title).toBe('Cross Creek')
    expect(card(c, 'high-avg-course').sub).toBe('Avg 105 gross')
    expect(card(c, 'low-avg-course').title).toBe('Vineyard')
    expect(card(c, 'median-net').title).toBe('A: 76 | B: 81')
  })
  it('ignores a mistyped score over 200 everywhere', () => {
    const c2 = seasonInsights([...rows, r('Dan', 'd', 'e1', 'Cross Creek', 'A', 589, 540)])
    expect(card(c2, 'high-gross').title).toBe('Bo — 120')
    expect(card(c2, 'high-avg-course').sub).toBe('Avg 105 gross')
  })
  it('CTP card only when wins were recorded; empty rows give no cards', () => {
    expect(card(c, 'ctp-flight').title).toBe('Flight A: 3 | Flight B: 1')
    expect(card(seasonInsights(rows), 'ctp-flight')).toBeUndefined()
    expect(seasonInsights([])).toEqual([])
  })
})

describe('ctpWinsByFlight', () => {
  it('counts recorded CTP winners by flight, skipping guests, super CTP and unwon holes', () => {
    const events = [{ id: 'e1' }]
    const epsByEvent = { e1: [
      { player_id: 'a', flight: 'A' }, { player_id: 'b', flight: 'B' },
      { player_id: 'g', flight: 'A', is_guest: true },
    ] }
    const sgs = [
      { game_type: 'ctp', winner_player_id: 'a' }, { game_type: 'ctp', winner_player_id: 'a' },
      { game_type: 'ctp', winner_player_id: 'b' }, { game_type: 'ctp', winner_player_id: 'g' },
      { game_type: 'ctp', winner_player_id: null }, { game_type: 'super_ctp', winner_player_id: 'a' },
    ]
    expect(ctpWinsByFlight({ events, epsByEvent, sideGamesByEvent: { e1: sgs } })).toEqual({ A: 2, B: 1 })
  })
})
