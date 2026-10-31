import { describe, it, expect } from 'vitest'
import { skinsGridViews } from './skinsGridView'

const pars = [4, 5, 4, 4, 3, 5, 3, 4, 4, 5, 4, 4, 4, 5, 4, 3, 4, 3]
const course = { name: 'Test GC', par_per_hole: pars, stroke_index: pars.map((_, i) => i + 1) }
const mk = (id, last, flight = 'A') => ({ player_id: id, flight, course_handicap: 0, tee: 'White', player: { first_name: 'P', last_name: last } })
const eps = [mk('a', 'Alpha'), mk('b', 'Bravo'), mk('c', 'Charlie')]
// Alpha beats the field on every hole.
const scores = eps.flatMap(ep => pars.map((p, i) => ({ player_id: ep.player_id, hole_number: i + 1, gross_score: ep.player_id === 'a' ? p - 1 : p + 1, putts: 2 })))
const event = { name: 'Round 1', event_date: '2026-10-25', status: 'complete', side_game_options: ['skins_a'], payout_config: { skins_a: 20 } }

describe('skinsGridViews', () => {
  it('splits the pot across skins won and totals 18', () => {
    const [v] = skinsGridViews({ event, eventPlayers: eps, allScores: scores, course })
    expect(v.title).toBe('Skins results · Flight A')
    expect(v.pool).toBe(60)
    expect(v.totalSkins).toBe(18)
    expect(v.rows.reduce((n, r) => n + r.skins, 0)).toBe(18)
    expect(v.rows[0].name).toBe('P Alpha')
    expect(v.rows[0].won).toBe(60)
    expect(v.top).toEqual({ name: 'Alpha', count: 18 })
    expect(v.parTotal).toBe(72)
    expect(v.rows.some(r => r.check)).toBe(false)
  })
  it('flags impossible hole scores without changing them', () => {
    const bad = scores.map(s => (s.player_id === 'c' && s.hole_number === 3 ? { ...s, gross_score: 65 } : s))
    const [v] = skinsGridViews({ event, eventPlayers: eps, allScores: bad, course })
    const row = v.rows.find(r => r.id === 'c')
    expect(row.check).toBe(true)
    expect(row.nets[3]).toBe(65)
    expect(v.rows.filter(r => r.check).length).toBe(1)
  })
  it('returns nothing without skins', () => {
    expect(skinsGridViews({ event: { ...event, side_game_options: [] }, eventPlayers: eps, allScores: scores, course })).toEqual([])
  })
})
