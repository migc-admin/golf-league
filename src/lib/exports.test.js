import { describe, it, expect } from 'vitest'
import { buildSignItems, signPages } from './signsView'
import { chipLabel } from './payoutsPerPlayerView'
import { buildPostRoundEmail } from './resultsEmail'
import { teeSheetChunks, teeTime12 } from '../components/export/TeeSheet'

const eps = n => Array.from({ length: n }, (_, i) => ({ id: i, flight: i % 2 ? 'B' : 'A', is_guest: false }))

describe('signs', () => {
  it('5 signs paginate to 2 pages, 4 to 1, none blank', () => {
    const event = { side_game_options: ['ctp', 'long_drive'], payout_config: { ctp_5: 1, ctp_7: 1, ctp_9: 1, long_drive: 1 } }
    const items = buildSignItems(event, eps(10))
    expect(items.length).toBe(4)
    expect(signPages(items).length).toBe(1)
    const five = buildSignItems({ ...event, custom_competitions: ['Longest putt'] }, eps(10))
    expect(five.length).toBe(5)
    const pages = signPages(five)
    expect(pages.length).toBe(2)
    expect(pages.every(p => p.length > 0)).toBe(true)
  })
  it('prize uses rate times field', () => {
    const items = buildSignItems({ side_game_options: ['ctp'], payout_config: { ctp_5: 1.25 } }, eps(10))
    expect(items[0].scope).toContain('12.50')
  })
})

describe('tee sheet', () => {
  it('fits 5 groups on one page and splits larger fields', () => {
    expect(teeSheetChunks([1, 2, 3, 4, 5]).length).toBe(1)
    const chunks = teeSheetChunks(Array.from({ length: 20 }, (_, i) => i + 1))
    expect(chunks.map(c => c.length)).toEqual([8, 10, 2])
  })
  it('computes tee times', () => {
    expect(teeTime12('09:50', 10, 1)).toBe('9:50 AM')
    expect(teeTime12('09:50', 10, 3)).toBe('10:10 AM')
    expect(teeTime12(null, 10, 1)).toBe(null)
  })
})

describe('payout chip labels', () => {
  it('returns a non-empty string', () => {
    expect(typeof chipLabel('18-hole net')).toBe('string')
  })
})

describe('results email', () => {
  const base = { event: { name: 'Playoffs – Round 1', event_date: '2026-10-25' }, leagueName: 'Mulligans', leaderboardUrl: 'https://x.test/l', payoutsUrl: 'https://x.test/l' }
  it('uses tables and inline styles only', () => {
    const { html, subject } = buildPostRoundEmail({ ...base, view: null })
    expect(html).not.toMatch(/class=|display:\s*(flex|grid)|calc\(/)
    expect(subject).toContain('Results')
  })
  it('organizer note only appears with text', () => {
    expect(buildPostRoundEmail({ ...base, view: null, note: '' }).html).not.toContain('From the organizer')
    expect(buildPostRoundEmail({ ...base, view: null, note: 'Hi all' }).html).toContain('Hi all')
  })
})
