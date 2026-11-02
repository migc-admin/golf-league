import { describe, it, expect } from 'vitest'
import { computePayouts, getCategoryLabel } from './payouts.js'
import { computeLeaderboards } from './scoring.js'
import { computeAllSkins } from './skins.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────
const course = {
  par_per_hole: Array(18).fill(4),
  stroke_index: Array.from({ length: 18 }, (_, i) => i + 1),
}

const makeScores = (playerId, gross) =>
  Array.from({ length: 18 }, (_, i) => ({
    player_id: playerId,
    hole_number: i + 1,
    gross_score: gross,
    putts: 2,
  }))

const makePlayer = (id, flight, ch) => ({
  player_id: id,
  flight,
  course_handicap: ch,
  is_guest: false,
  player: { id, first_name: id, last_name: 'Test' },
})

// ─── getCategoryLabel ────────────────────────────────────────────────────────
describe('getCategoryLabel', () => {
  it('labels per-flight net scoring keys', () => {
    expect(getCategoryLabel('18_net_a_1st')).toBe('18-Hole Net — Flight A, 1st')
    expect(getCategoryLabel('18_net_b_2nd')).toBe('18-Hole Net — Flight B, 2nd')
    expect(getCategoryLabel('b9_a_1st')).toBe('Back 9 Net — Flight A, 1st')
    expect(getCategoryLabel('f9_b_2nd')).toBe('Front 9 Net — Flight B, 2nd')
  })

  it('labels CTP keys with hole number', () => {
    expect(getCategoryLabel('ctp_17')).toBe('Closest to Pin — Hole 17 (Full Field)')
    expect(getCategoryLabel('ctp_4')).toBe('Closest to Pin — Hole 4 (Full Field)')
  })

  it('labels per-flight skins', () => {
    expect(getCategoryLabel('skins_a')).toBe('Skins — Flight A')
    expect(getCategoryLabel('skins_b')).toBe('Skins — Flight B')
  })

  it('labels long drive', () => {
    expect(getCategoryLabel('long_drive_a')).toBe('Long Drive — Flight A')
  })
})

// ─── computePayouts — basic solo winner ──────────────────────────────────────
describe('computePayouts — solo winner', () => {
  const p1 = makePlayer('p1', 'A', 18)  // lower net (more strokes given)
  const p2 = makePlayer('p2', 'A', 5)

  const scores = [...makeScores('p1', 5), ...makeScores('p2', 5)]
  // p1: gross 90, net 72 (18 strokes). p2: gross 90, net 85. p1 wins.

  const event = {
    entry_fee: 42,
    payout_config: { '18_net_a_1st': 5, '18_net_a_2nd': 3 },
  }
  const flightCounts = { A: 2 }

  it('awards 1st place to lowest net score', () => {
    const lb = computeLeaderboards([p1, p2], scores, course)
    const skins = computeAllSkins([p1, p2], scores, course)
    const { byPlayer } = computePayouts(event, 2, lb, [], skins, flightCounts)

    const winner = byPlayer.find(p => p.playerId === 'p1')
    expect(winner).toBeDefined()
    expect(winner.total).toBe(10)  // $5 × 2 players
  })

  it('awards 2nd place to second-lowest net score', () => {
    const lb = computeLeaderboards([p1, p2], scores, course)
    const skins = computeAllSkins([p1, p2], scores, course)
    const { byPlayer } = computePayouts(event, 2, lb, [], skins, flightCounts)

    const second = byPlayer.find(p => p.playerId === 'p2')
    expect(second).toBeDefined()
    expect(second.total).toBe(6)  // $3 × 2 players
  })
})

// ─── computePayouts — tie splitting ──────────────────────────────────────────
describe('computePayouts — tie splitting', () => {
  const p1 = makePlayer('p1', 'A', 10)
  const p2 = makePlayer('p2', 'A', 10)
  const p3 = makePlayer('p3', 'A', 5)

  // p1 and p2 tied for 1st (same gross, same CH), p3 in 2nd
  const scores = [
    ...makeScores('p1', 5),
    ...makeScores('p2', 5),
    ...makeScores('p3', 5),
  ]

  const event = {
    entry_fee: 42,
    payout_config: { '18_net_a_1st': 5, '18_net_a_2nd': 3, '18_net_a_3rd': 1 },
  }
  const flightCounts = { A: 3 }

  it('splits 1st+2nd pot equally between two tied players', () => {
    const lb = computeLeaderboards([p1, p2, p3], scores, course)
    const skins = computeAllSkins([p1, p2, p3], scores, course)
    const { byPlayer } = computePayouts(event, 3, lb, [], skins, flightCounts)

    // 1st=$15, 2nd=$9 → combined $24, split 2 ways = $12 each
    const w1 = byPlayer.find(p => p.playerId === 'p1')
    const w2 = byPlayer.find(p => p.playerId === 'p2')
    expect(w1.total).toBe(12)
    expect(w2.total).toBe(12)
  })
})

// ─── computePayouts — CTP from side_games ────────────────────────────────────
describe('computePayouts — CTP', () => {
  const event = {
    entry_fee: 42,
    payout_config: { 'ctp_17': 1.25 },
  }
  const sideGames = [{ game_type: 'ctp', hole_number: 17, winner_player_id: 'p1' }]

  it('assigns CTP payout to side_games winner', () => {
    const lb = computeLeaderboards([], [], course)
    const { byPlayer } = computePayouts(event, 31, lb, sideGames, {}, {})

    const winner = byPlayer.find(p => p.playerId === 'p1')
    expect(winner).toBeDefined()
    // 31 players × $1.25 = $38.75
    expect(winner.total).toBe(38.75)
    expect(winner.items[0].category).toContain('Hole 17')
  })

  it('pays nothing for CTP with no winner recorded', () => {
    const lb = computeLeaderboards([], [], course)
    const { byPlayer } = computePayouts(event, 31, lb, [], {}, {})
    expect(byPlayer).toHaveLength(0)
  })
})

// ─── computePayouts — no scores, no payouts ──────────────────────────────────
describe('computePayouts — empty scores', () => {
  it('returns no byPlayer entries when no scores entered', () => {
    const event = {
      entry_fee: 42,
      payout_config: { '18_net_a_1st': 5, 'b9_a_1st': 2 },
    }
    const players = [makePlayer('p1', 'A', 10), makePlayer('p2', 'A', 8)]
    const lb = computeLeaderboards(players, [], course)  // no scores
    const skins = computeAllSkins(players, [], course)
    const { byPlayer } = computePayouts(event, 2, lb, [], skins, { A: 2 })
    expect(byPlayer).toHaveLength(0)
  })
})

// ─── computePayouts — fixed pot ──────────────────────────────────────────────
describe('computePayouts — fixed pot', () => {
  it('uses payout_fixed_total when payout_basis is fixed', () => {
    const p1 = makePlayer('p1', 'A', 18)
    const p2 = makePlayer('p2', 'A', 5)
    const scores = [...makeScores('p1', 5), ...makeScores('p2', 5)]
    const event = {
      entry_fee: 42,
      payout_basis: 'fixed',
      payout_fixed_total: 500,
      payout_config: { '18_net_a_1st': 5 },
    }
    const lb = computeLeaderboards([p1, p2], scores, course)
    const { totalPot } = computePayouts(event, 2, lb, [], {}, { A: 2 })
    expect(totalPot).toBe(500)
  })
})


describe('computePayouts — imported skins', () => {
  it('pays imported skins as recorded, with no payout config needed', () => {
    const event = { payout_config: {}, entry_fee: 0, imported_skins: [
      { player_id: 'p1', skins_won: 2, amount: 40 }, { player_id: 'p2', skins_won: 1, amount: 0 },
    ] }
    const r = computePayouts(event, 2, {}, [], {}, {})
    expect(r.byPlayer.find(p => p.playerId === 'p1').total).toBe(40)
    expect(r.byPlayer.find(p => p.playerId === 'p1').items[0].category).toBe('Skins (Full Field) (2 skins)')
    expect(r.byCategory.find(c => c.playerId === 'p1')).toMatchObject({ key: 'skins_p1', isSkin: true, amount: 40 })
  })
  it('files imported skins under the player flight', () => {
    const event = { payout_config: {}, entry_fee: 0, imported_skins: [
      { player_id: 'p1', skins_won: 1, amount: 10 }, { player_id: 'p2', skins_won: 2, amount: 20 }, { player_id: 'p3', skins_won: 1, amount: 5 },
    ] }
    const eps = [makePlayer('p1', 'A', 0), makePlayer('p2', 'B', 0), makePlayer('p3', null, 0)]
    const r = computePayouts(event, 3, {}, [], {}, {}, { eventPlayers: eps })
    const cat = id => r.byCategory.find(c => c.playerId === id)
    expect(cat('p1')).toMatchObject({ key: 'skins_a_p1', label: 'Skins — Flight A (1 skin)' })
    expect(cat('p2').label).toBe('Skins — Flight B (2 skins)')
    expect(cat('p3')).toMatchObject({ key: 'skins_p3', label: 'Skins (Full Field) (1 skin)' })
  })
  it('lists imported skins winners with the most skins first', () => {
    const event = { payout_config: {}, entry_fee: 0, imported_skins: [
      { player_id: 'p1', skins_won: 1, amount: 10 }, { player_id: 'p2', skins_won: 3, amount: 30 }, { player_id: 'p3', skins_won: 1, amount: 15 },
    ] }
    const r = computePayouts(event, 3, {}, [], {}, {})
    expect(r.byCategory.map(c => c.playerId)).toEqual(['p2', 'p3', 'p1'])
  })
  it('skips skins worked out from hole scores when winners were imported', () => {
    const eps = [makePlayer('p1', 'A', 0), makePlayer('p2', 'A', 0)]
    const scores = [...makeScores('p1', 3), ...makeScores('p2', 5)]
    const lb = computeLeaderboards(eps, scores, course)
    const skins = computeAllSkins(eps, scores, course)
    const event = { payout_config: { skins: 20 }, entry_fee: 0, imported_skins: [{ player_id: 'p2', skins_won: 1, amount: 15 }] }
    const r = computePayouts(event, 2, lb, [], skins, { A: 2 })
    expect(r.byPlayer.map(p => p.playerId)).toEqual(['p2'])
    expect(r.byPlayer[0].total).toBe(15)
  })
})
