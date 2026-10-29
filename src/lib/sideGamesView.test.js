import { describe, it, expect } from 'vitest'
import { eventFlightLetters, eligiblePlayers, playerLabel, winnerValue, ctpHoles, buildSideGamesPlan, withOverrides } from './sideGamesView'

let n = 0
const ep = (first, last, flight, extra = {}) => ({ id: `e${++n}`, player_id: `p${n}`, flight, is_guest: false, player: { first_name: first, last_name: last }, ...extra })
const par = Array.from({ length: 18 }, (_, i) => ([2, 7, 12, 15].includes(i) ? 3 : 4)) // par-3s at holes 3, 8, 13, 16
const course = { par_per_hole: par }
const ctpCfg = { ctp_16: {}, ctp_3: {}, ctp_13: {}, ctp_8: {}, skins: {} }
const base = { use_flights: true, num_flights: 2, side_game_options: ['long_drive_a', 'long_drive_b', 'ctp'], payout_config: ctpCfg }

const roster = [
  ep('Zed', 'Young', 'A'), ep('Amy', 'Baker', 'A'), ep('Cal', 'Adams', 'B'),
  ep('Gus', 'Guest', 'A', { is_guest: true }), ep('Nia', 'Noflight', null),
]

describe('players', () => {
  it('lists only non-guest players, sorted alphabetically by first name, shown as First Last', () => {
    const list = eligiblePlayers(roster)
    expect(list.map(playerLabel)).toEqual(['Amy Baker', 'Cal Adams', 'Nia Noflight', 'Zed Young'])
    expect(list.some(p => p.is_guest)).toBe(false)
  })
})

describe('flights', () => {
  it('come from the event, not a hard-coded A and B', () => {
    expect(eventFlightLetters({ use_flights: true })).toEqual(['A', 'B'])
    expect(eventFlightLetters({ num_flights: 3 })).toEqual(['A', 'B', 'C'])
    expect(eventFlightLetters({ use_flights: false })).toEqual([])
  })
})

describe('Long Drive (by flight)', () => {
  const plan = buildSideGamesPlan({ event: base, eventPlayers: roster, sideGames: [], course })
  it('has one row per flight; each lists only that flight’s players', () => {
    expect(plan.longDrive.fields.map(f => f.label)).toEqual(['Flight A', 'Flight B'])
    expect(plan.longDrive.fields[0].players.map(playerLabel)).toEqual(['Amy Baker', 'Zed Young'])
    expect(plan.longDrive.fields[1].players.map(playerLabel)).toEqual(['Cal Adams'])
  })
  it('reports the roster and eligible counts so an all-guest event can be explained', () => {
    const plan2 = buildSideGamesPlan({ event: base, eventPlayers: [ep('A', 'B', 'A', { is_guest: true })], sideGames: [], course })
    expect([plan2.rosterCount, plan2.eligibleCount]).toEqual([1, 0])
    expect([plan.rosterCount, plan.eligibleCount]).toEqual([5, 4])
  })
  it('leaves out players with no flight and counts them for the muted note', () => {
    expect(plan.noFlight).toBe(1)
    for (const f of plan.longDrive.fields) expect(f.players.map(playerLabel)).not.toContain('Nia Noflight')
  })
  it('a third flight on the event adds a third row automatically (and it is disabled with nobody in it)', () => {
    const three = buildSideGamesPlan({ event: { ...base, num_flights: 3, side_game_options: ['long_drive_a', 'long_drive_b', 'long_drive_c'] }, eventPlayers: roster, sideGames: [], course })
    expect(three.longDrive.fields.map(f => f.label)).toEqual(['Flight A', 'Flight B', 'Flight C'])
    expect(three.longDrive.fields[2].disabled).toBe(true)
    expect(three.longDrive.fields[2].players).toEqual([])
  })
  it('an empty flight is disabled instead of falling back to everyone', () => {
    const none = buildSideGamesPlan({ event: base, eventPlayers: [ep('A', 'B', 'A')], sideGames: [], course })
    expect(none.longDrive.fields[1].disabled).toBe(true)
    expect(none.longDrive.fields[1].players).toEqual([])
  })
})

describe('Long Drive (entire field)', () => {
  it('shows a single Overall row with every eligible player', () => {
    const plan = buildSideGamesPlan({ event: { ...base, side_game_options: ['long_drive', 'ctp'] }, eventPlayers: roster, sideGames: [], course })
    expect(plan.longDrive.fields).toHaveLength(1)
    expect(plan.longDrive.fields[0]).toMatchObject({ label: 'Overall', flight: 'overall' })
    expect(plan.longDrive.fields[0].players).toHaveLength(4)
  })
})

describe('Closest to Pin', () => {
  const plan = buildSideGamesPlan({ event: base, eventPlayers: roster, sideGames: [], course })
  it('uses the holes designated in Payout Config, in hole order, with the course par', () => {
    expect(ctpHoles(base, course)).toEqual([{ hole: 3, par: 3 }, { hole: 8, par: 3 }, { hole: 13, par: 3 }, { hole: 16, par: 3 }])
    expect(plan.ctp.holes.map(h => h.hole)).toEqual([3, 8, 13, 16])
  })
  it('every hole lists every eligible player, whatever their flight, so one player can win several holes', () => {
    for (const h of plan.ctp.holes) {
      expect(h.fields).toHaveLength(1)
      expect(h.fields[0].players.map(playerLabel)).toEqual(['Amy Baker', 'Cal Adams', 'Nia Noflight', 'Zed Young'])
    }
    const picks = plan.ctp.holes.map(h => h.fields[0])
    expect(new Set(picks.map(f => f.key)).size).toBe(4)
  })
  it('splits each hole by flight when CTP is set up per flight', () => {
    const perFlight = buildSideGamesPlan({ event: { ...base, side_game_options: ['ctp_a', 'ctp_b'] }, eventPlayers: roster, sideGames: [], course })
    expect(perFlight.ctp.holes[0].fields.map(f => f.label)).toEqual(['Flight A', 'Flight B'])
    expect(perFlight.ctp.holes[0].fields[1].players.map(playerLabel)).toEqual(['Cal Adams'])
  })
  it('is absent when the event has no CTP or no holes designated', () => {
    expect(buildSideGamesPlan({ event: { ...base, side_game_options: ['long_drive'] }, eventPlayers: roster, sideGames: [], course }).ctp).toBeNull()
    expect(buildSideGamesPlan({ event: { ...base, payout_config: {} }, eventPlayers: roster, sideGames: [], course }).ctp).toBeNull()
  })
})

describe('saved winners and progress', () => {
  const amy = roster[1]
  const saved = [
    { game_type: 'long_drive', hole_number: null, flight: 'A', winner_player_id: amy.player_id },
    { game_type: 'ctp', hole_number: 8, flight: 'overall', winner_player_id: null }, // explicit "No winner"
  ]
  it('reads saved rows the way the page always has: none, No winner, or the player', () => {
    expect(winnerValue(saved, 'long_drive', null, 'A')).toBe(amy.player_id)
    expect(winnerValue(saved, 'ctp', 8, 'overall')).toBe('NO_WINNER')
    expect(winnerValue(saved, 'ctp', 3, 'overall')).toBe('')
  })
  it('counts both a picked winner and "No winner" as entered, out of flights + holes', () => {
    const plan = buildSideGamesPlan({ event: base, eventPlayers: roster, sideGames: saved, course })
    expect(plan.total).toBe(6) // 2 flights + 4 holes
    expect(plan.entered).toBe(2)
    expect(plan.longDrive.fields[0].value).toBe(amy.player_id)
  })
  it('counts drop as winners are cleared', () => {
    expect(buildSideGamesPlan({ event: base, eventPlayers: roster, sideGames: [], course }).entered).toBe(0)
  })
})

describe('withOverrides (show a choice while it saves)', () => {
  const plan = buildSideGamesPlan({ event: base, eventPlayers: roster, sideGames: [], course })
  it('swaps in the chosen value and recounts what is entered', () => {
    const next = withOverrides(plan, { 'ld-A': roster[1].player_id, 'ctp8-overall': 'NO_WINNER' })
    expect(next.entered).toBe(2)
    expect(next.longDrive.fields[0].value).toBe(roster[1].player_id)
    expect(next.ctp.holes[1].fields[0].value).toBe('NO_WINNER')
    expect(plan.entered).toBe(0) // the original is untouched
  })
  it('an override of "" shows a cleared field', () => {
    const saved = buildSideGamesPlan({ event: base, eventPlayers: roster, sideGames: [{ game_type: 'long_drive', hole_number: null, flight: 'A', winner_player_id: roster[1].player_id }], course })
    expect(withOverrides(saved, { 'ld-A': '' }).entered).toBe(0)
  })
  it('returns the plan itself when there is nothing to override', () => {
    expect(withOverrides(plan, {})).toBe(plan)
  })
})

describe('sort order', () => {
  it('orders by first name, then last name, ignoring case', () => {
    const list = eligiblePlayers([ep('mike', 'Zimmer', 'A'), ep('Mike', 'Adams', 'A'), ep('Aaron', 'Young', 'A'), ep('Zoe', 'Abbott', 'A')])
    expect(list.map(playerLabel)).toEqual(['Aaron Young', 'Mike Adams', 'mike Zimmer', 'Zoe Abbott'])
  })
})
