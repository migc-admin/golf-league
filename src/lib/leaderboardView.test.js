import { describe, it, expect } from 'vitest'
import { matchChip, tidyStatus, skinsHoleRows, payoutTag, finishLabel, toParText } from './leaderboardView'

describe('matchChip', () => {
  it('fills with the winner and tints the leader', () => {
    expect(matchChip({ holesPlayed: 18, winner: 'A', matchStatus: '2 UP', upBy: 2 })).toEqual({ text: '2 up', tone: 'winA' })
    expect(matchChip({ holesPlayed: 16, winner: 'B', matchStatus: '3&2', upBy: -3 })).toEqual({ text: '3&2', tone: 'winB' })
    expect(matchChip({ holesPlayed: 9, winner: null, matchStatus: '1 UP (B)', upBy: -1 })).toEqual({ text: '1 up', tone: 'leadB' })
    expect(matchChip({ holesPlayed: 9, winner: null, matchStatus: 'All Square', upBy: 0 })).toEqual({ text: 'All square', tone: 'even' })
  })
  it('names unstarted, halved, tiebreak and undecided matches', () => {
    expect(matchChip({ holesPlayed: 0 }).text).toBe('Not started')
    expect(matchChip({ holesPlayed: 18, winner: 'halve', upBy: 0 }).text).toBe('Halved')
    expect(matchChip({ holesPlayed: 18, winner: 'A', tiebreak: { label: 'back 9' }, matchStatus: 'Tiebreak: back 9' })).toEqual({ text: 'Tiebreak', tone: 'winA' })
    expect(matchChip({ holesPlayed: 18, winner: null, needsWinner: true }).text).toBe('Tied')
  })
  it('tidies dormie labels', () => {
    expect(tidyStatus('Dormie 2 (A)')).toBe('Dormie 2')
  })
})

describe('skinsHoleRows', () => {
  const tie = (hole, carryoverIn) => ({ hole, tied: true, winner: null, carryoverIn, skinsWon: 0 })
  const win = (hole, winner, carryoverIn, extra = {}) => ({ hole, tied: false, winner, carryoverIn, skinsWon: carryoverIn + 1 + (extra.wraparound ?? 0), ...extra })
  it('collapses consecutive ties and explains carried and wrapped skins', () => {
    const holes = [
      tie(1, 0), tie(2, 1), tie(3, 2), win(4, 'p1', 3, { wraparound: 5 }),
      ...[5, 6, 7, 8, 9, 10, 11, 12, 13].map(h => win(h, 'p2', 0)),
      ...[14, 15, 16, 17, 18].map((h, i) => tie(h, i)),
    ]
    const rows = skinsHoleRows(holes)
    expect(rows[0]).toEqual({ type: 'tied', from: 1, to: 3, carried: 3 })
    expect(rows[1]).toMatchObject({ type: 'win', hole: 4, winner: 'p1', parts: ['1', '3 carried', '5 wrapped from 14–18'] })
    expect(rows[2].parts).toEqual([])
    expect(rows.at(-1)).toEqual({ type: 'tied', from: 14, to: 18, carried: 5 })
  })
  it('skips holes still being scored and keeps non-adjacent ties apart', () => {
    const rows = skinsHoleRows([tie(1, 0), { hole: 2, incomplete: true }, tie(3, 1)])
    expect(rows).toEqual([{ type: 'tied', from: 1, to: 1, carried: 1 }, { type: 'tied', from: 3, to: 3, carried: 2 }])
  })
})

describe('payoutTag', () => {
  it('shortens payout labels into tags', () => {
    expect(payoutTag('18-Hole Net — Flight A, 1st')).toBe('1st net')
    expect(payoutTag('18-Hole Net — 2nd')).toBe('2nd net')
    expect(payoutTag('Front 9 Net — Flight B, 1st')).toBe('1st F9 net')
    expect(payoutTag('Closest to Pin — Hole 8 (Full Field)')).toBe('CTP #8')
    expect(payoutTag('Super CTP — Hole 7, Flight A')).toBe('Super CTP #7')
    expect(payoutTag('Skins — Flight A')).toBe('Skins')
    expect(payoutTag('Skins — Flight A (3 skins)')).toBe('Skins')
    expect(payoutTag('Low Putts (Full Field)')).toBe('Low putts')
    expect(payoutTag('Long Drive — Flight B')).toBe('Long drive')
    expect(payoutTag('Nassau (Net) — Front 9')).toBe('Nassau F9 net')
  })
  it('marks split prizes and passes unknown labels through', () => {
    expect(payoutTag('Back 9 Net — Flight A, 2nd (Tied — split 2 ways)')).toBe('2nd B9 net (tie)')
    expect(payoutTag('Something new')).toBe('Something new')
  })
})

describe('finishLabel', () => {
  const flights = { a: 'A', b: 'A', c: 'B', d: 'A' }
  const flightOf = id => flights[id]
  it('adds T only when a same-flight player has the same points', () => {
    const pts = { a: 5.5, b: 5.5, c: 5.5, d: 9 }
    expect(finishLabel('a', 7, pts, flightOf)).toBe('T7')
    expect(finishLabel('c', 3, pts, flightOf)).toBe('3')
    expect(finishLabel('d', 1, pts, flightOf)).toBe('1')
    expect(finishLabel('d', null, pts, flightOf)).toBe('—')
  })
})

describe('toParText', () => {
  it('formats to-par values', () => {
    expect([toParText(3), toParText(0), toParText(-2), toParText(null)]).toEqual(['+3', 'E', '-2', '—'])
  })
})
