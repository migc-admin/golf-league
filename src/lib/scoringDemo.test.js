import { describe, it, expect } from 'vitest'
import { DEMO_GROUP, DEMO_HOLES, demoLeaderboard, demoSkins, strokesOn, formatToPar } from './scoringDemo'

const all = (h1, h2, h3) => Object.fromEntries(DEMO_GROUP.map((p, i) => [p.id, { 1: h1[i], 2: h2[i], 3: h3[i] }]))

describe('scoring demo', () => {
  it('allocates strokes like the real engine', () => {
    const [sam, jen, marcus, tony] = DEMO_GROUP
    const [h1, h2, h3] = DEMO_HOLES
    expect([strokesOn(sam, h1), strokesOn(sam, h3)]).toEqual([0, 1])
    expect([strokesOn(jen, h1), strokesOn(jen, h2)]).toEqual([1, 0])
    expect(strokesOn(marcus, h2)).toBe(1)
    expect(strokesOn(tony, h3)).toBe(2) // CH 22 gets a second stroke on SI 1-4
  })

  it('shows the other group on the board before anything is entered', () => {
    const rows = demoLeaderboard({})
    expect(rows.filter(r => r.thru === 3)).toHaveLength(3)
    expect(rows.slice(-4).every(r => r.netToPar == null)).toBe(true)
  })

  it('ranks by net to par with shared tie positions', () => {
    // Everyone in the group makes par gross on every hole.
    const rows = demoLeaderboard(all([4, 4, 4, 4], [3, 3, 3, 3], [5, 5, 5, 5]))
    const tony = rows.find(r => r.id === 'tony')
    expect(tony.netToPar).toBe(-4) // 1 + 1 + 2 strokes
    expect(rows[0].id).toBe('tony')
    const tiedAtTop = rows.filter(r => r.pos === rows[1].pos)
    for (const r of tiedAtTop) expect(r.tied).toBe(tiedAtTop.length > 1)
  })

  it('decides a skin only when the whole field has scored the hole', () => {
    const partial = { sam: { 1: 4 } }
    expect(demoSkins(partial).holes[0].status).toBe('open')
  })

  it('awards outright winners and carries ties', () => {
    // Hole 1: Marcus net 3 wins outright. Hole 2: ties carry. Hole 3: Tony net 3 takes 2 skins.
    const s = demoSkins(all([5, 5, 4, 6], [3, 3, 3, 4], [6, 6, 7, 5]))
    expect(s.holes[0]).toMatchObject({ status: 'won', winner: 'Marcus Hill', skins: 1 })
    expect(s.holes[1].status).toBe('carry')
    expect(s.holes[2]).toMatchObject({ status: 'won', winner: 'Tony Russo', skins: 2 })
    expect(s.skinsWon).toBe(3)
    expect(s.perSkin).toBe(40)
    expect(s.payouts).toEqual([
      { name: 'Tony Russo', skins: 2, amount: 80 },
      { name: 'Marcus Hill', skins: 1, amount: 40 },
    ])
  })

  it('formats to-par values', () => {
    expect([formatToPar(-2), formatToPar(0), formatToPar(3), formatToPar(null)]).toEqual(['-2', 'E', '+3', '—'])
  })
})
