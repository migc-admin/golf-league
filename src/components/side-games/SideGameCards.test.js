import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { buildSideGamesPlan } from '../../lib/sideGamesView'
import LongDriveCard from './LongDriveCard'
import ClosestToPinCard from './ClosestToPinCard'

const html = el => renderToStaticMarkup(el)
let n = 0
const ep = (first, last, flight, extra = {}) => ({ id: `e${++n}`, player_id: `p${n}`, flight, is_guest: false, player: { first_name: first, last_name: last }, ...extra })
const par = Array.from({ length: 18 }, (_, i) => ([2, 7, 12, 15].includes(i) ? 3 : 4))
const course = { par_per_hole: par }
const roster = [ep('Amy', 'Baker', 'A'), ep('Cal', 'Adams', 'B'), ep('Nia', 'Noflight', null), ep('Gus', 'Guest', 'A', { is_guest: true })]
const event = { use_flights: true, num_flights: 2, side_game_options: ['long_drive_a', 'long_drive_b', 'ctp'], payout_config: { ctp_3: {}, ctp_8: {}, ctp_13: {}, ctp_16: {} } }
const plan = buildSideGamesPlan({ event, eventPlayers: roster, sideGames: [], course })
const statusOf = () => ({ status: 'idle' })
const noop = () => {}

describe('LongDriveCard', () => {
  const out = html(h(LongDriveCard, { fields: plan.longDrive.fields, noFlight: plan.noFlight, onFixFlights: noop, statusOf, onChange: noop }))

  it('has the title, subtitle and an "N of flights" count in the header', () => {
    expect(out).toMatch(/<h2[^>]*>Long Drive<\/h2>/)
    expect(out).toContain('One winner per flight')
    expect(out).toContain('0 of 2')
  })

  it('shows one labelled dropdown per flight, each with only its own players and no guests', () => {
    expect(out).toContain('>Flight A<')
    expect(out).toContain('>Flight B<')
    const [a, b] = out.split('>Flight B<')
    expect(a).toContain('Amy Baker')
    expect(a).not.toContain('Cal Adams')
    expect(b).toContain('Cal Adams')
    expect(out).not.toContain('Gus Guest')
    expect(out).not.toContain('Nia Noflight')
  })

  it('shows the muted note with a link when players have no flight', () => {
    expect(out).toContain('1 player has no flight assigned.')
    expect(out).toContain('>Assign flights<')
    const none = html(h(LongDriveCard, { fields: plan.longDrive.fields, noFlight: 0, statusOf, onChange: noop }))
    expect(none).not.toContain('no flight assigned')
    expect(html(h(LongDriveCard, { fields: plan.longDrive.fields, noFlight: 3, statusOf, onChange: noop }))).toContain('3 players have no flight assigned.')
  })

  it('is the same white card as the Overview, Players and Groups pages (8px corners, token colors, no green header bar)', () => {
    expect(out).toContain('rounded-sm border border-surface-border bg-white')
    expect(out).toContain('text-lg font-bold text-ink')
    expect(out).not.toContain('bg-fairway-700')
    expect(out).not.toContain('#E3B94E')
    expect(out).not.toContain('rounded-[14px]')
    expect(out).not.toContain('rounded-full')
  })

  it('says why when everyone in the event is a guest', () => {
    const o = html(h(LongDriveCard, { fields: plan.longDrive.fields.map(f => ({ ...f, players: [], disabled: true })), statusOf, onChange: noop, emptyNote: 'Everyone in this event is marked as a guest' }))
    expect(o).toContain('Everyone in this event is marked as a guest')
  })

  it('counts entered winners in the header', () => {
    const fields = plan.longDrive.fields.map((f, i) => (i === 0 ? { ...f, value: 'NO_WINNER' } : f))
    expect(html(h(LongDriveCard, { fields, statusOf, onChange: noop }))).toContain('1 of 2')
  })

  it('an entire-field game shows one Overall row', () => {
    const overall = buildSideGamesPlan({ event: { ...event, side_game_options: ['long_drive'] }, eventPlayers: roster, sideGames: [], course })
    const o = html(h(LongDriveCard, { fields: overall.longDrive.fields, statusOf, onChange: noop }))
    expect(o).toContain('>Overall<')
    expect(o).toContain('One winner for the entire field')
    expect(o).toContain('Amy Baker')
    expect(o).toContain('Cal Adams')
  })

  it('a flight with nobody in it is disabled', () => {
    const lonely = buildSideGamesPlan({ event, eventPlayers: [ep('Amy', 'Baker', 'A')], sideGames: [], course })
    const o = html(h(LongDriveCard, { fields: lonely.longDrive.fields, statusOf, onChange: noop }))
    expect(o).toContain('No players assigned to this flight')
  })
})

describe('ClosestToPinCard', () => {
  const out = html(h(ClosestToPinCard, { holes: plan.ctp.holes, statusOf, onChange: noop }))

  it('has the title, subtitle and "N of holes" count', () => {
    expect(out).toMatch(/<h2[^>]*>Closest to Pin<\/h2>/)
    expect(out).toContain('One winner per par-3 hole')
    expect(out).toContain('0 of 4')
  })

  it('shows Holes 3, 8, 13 and 16 in order, each marked Par 3, in an auto-fit grid', () => {
    const order = ['Hole 3<', 'Hole 8<', 'Hole 13<', 'Hole 16<'].map(t => out.indexOf(t))
    expect(order.every(i => i > 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(out.match(/Par 3/g)).toHaveLength(4)
    expect(out).toContain('grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))]')
  })

  it('every hole lists every eligible player regardless of flight, so one player can win several holes', () => {
    expect(out.match(/Amy Baker/g)).toHaveLength(4)
    expect(out.match(/Cal Adams/g)).toHaveLength(4)
    expect(out.match(/Nia Noflight/g)).toHaveLength(4) // no-flight players still appear here
    expect(out).not.toContain('Gus Guest')
  })

  it('per-flight CTP gives each hole a field per flight', () => {
    const perFlight = buildSideGamesPlan({ event: { ...event, side_game_options: ['ctp_a', 'ctp_b'] }, eventPlayers: roster, sideGames: [], course })
    const o = html(h(ClosestToPinCard, { holes: perFlight.ctp.holes, statusOf, onChange: noop }))
    expect(o).toContain('0 of 8')
    expect(o.match(/>Flight A</g)).toHaveLength(4)
    expect(o).toContain('One winner per par-3 hole, per flight')
  })

  it('has no emoji or pool colors', () => {
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(out).not.toMatch(/#2E7D4F|#2B59A0|#6B46C1/)
  })
})
