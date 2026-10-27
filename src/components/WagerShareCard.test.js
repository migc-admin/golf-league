import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WagerShareCard from './WagerShareCard'

const names = { j: 'John Nothdurft', p: 'Paul Hsieh', d: 'Daniel Lopez' }
const playerName = id => names[id] ?? '—'

// The Playoffs example: John & Paul tie for 1st, only John has PLACE bettors.
const settlement = {
  winPool: 165, placePool: 25, totalPot: 190, matchPoolTotal: 0,
  winTotals: { j: 5, p: 5 }, placeTotals: { j: 10, d: 10 }, allPickedIds: ['j', 'p', 'd'],
  winResults: { net: 72, matched: true, topPlayers: ['j', 'p'], bettors: [
    { name: 'Darrick Sogabe', pid: 'j', bet: 5, payout: 82.5 }, { name: 'Paul Hsieh', pid: 'p', bet: 5, payout: 82.5 } ] },
  placeResults: { net: 72, net2: 72, twoWayTie: true, matched: true,
    g1: { players: ['j'], hasMatch: true, bettors: [{ name: 'Jeff Carey', pid: 'j', bet: 5, payout: 8.75 }, { name: 'Kevin Taylor', pid: 'j', bet: 5, payout: 8.75 }] },
    g2: { players: ['p'], hasMatch: false, bettors: [] } },
  matchCards: [],
}
const props = { event: { name: 'Playoffs - Round 1', status: 'complete', league: { name: "Mulligan's Island" }, course: { name: 'Golf Club' } },
  eventDate: 'Sun, Oct 25, 2026', settlement, playerName, showResults: true, hasScores: true, activeCount: 7 }

describe('WagerShareCard', () => {
  it('shows pools, WIN and PLACE payouts, and the club roll-over line', () => {
    const out = renderToStaticMarkup(h(WagerShareCard, props))
    expect(out).toContain('Playoffs - Round 1')
    expect(out).toContain('$165.00')
    expect(out).toContain('$82.50')
    expect(out).toContain('Tied for 1st')
    expect(out).toContain('$8.75')
    expect(out).toContain('half pool rolls to club')
  })

  it('omits live odds once the event is complete, shows them while in play', () => {
    expect(renderToStaticMarkup(h(WagerShareCard, props))).not.toContain('Live Odds')
    const live = renderToStaticMarkup(h(WagerShareCard, { ...props, event: { ...props.event, status: 'active' } }))
    expect(live).toContain('Live Odds')
    expect(live).toContain('33.00x')
  })

  it('before any scores it shows the pools and odds but no results block', () => {
    const out = renderToStaticMarkup(h(WagerShareCard, { ...props, event: { ...props.event, status: 'upcoming' }, hasScores: false, showResults: false }))
    expect(out).toContain('Pool Summary')
    expect(out).toContain('Live Odds')
    expect(out).not.toContain('Wager Results')
  })
})
