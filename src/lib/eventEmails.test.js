import { describe, it, expect } from 'vitest'
import { buildPreRoundEmail, preRoundIncludes, emailCompetitions } from './eventEmails'

const player = (first, last) => ({ first_name: first, last_name: last })
const event = {
  name: 'Playoffs Round 2', event_date: '2026-11-07', start_time: '08:00', tee_time_interval_mins: 10,
  tournament_fee: 160, formats: ['stroke_play'], side_game_options: ['long_drive'],
  course: { name: "Mulligan's Island", address: '1 Fairway Dr, San Diego, CA 92101' },
}
const eps = [
  { player_id: 1, flight: 'A', group_number: 1, course_handicap: 4, player: player('Zed', 'Zimmer') },
  { player_id: 2, flight: 'A', group_number: 1, course_handicap: 6, player: player('Amy', 'Adams') },
  { player_id: 3, flight: 'B', group_number: null, course_handicap: null, player: player('Bob', 'Brown') },
]
const base = { event, eventPlayers: eps, leagueName: 'MIGC', eventUrl: 'https://x.test/e', wagerUrl: 'https://x.test/w' }

describe('buildPreRoundEmail', () => {
  it('has no classes, flex or grid, and uses tables', () => {
    const { html } = buildPreRoundEmail(base)
    expect(html).not.toMatch(/class=|display:flex|display:grid|<style/)
    expect(html).toContain('<table')
  })
  it('omits the logo when there is no public URL and keeps it when there is', () => {
    expect(buildPreRoundEmail({ ...base, logoUrl: 'data:image/png;base64,xx' }).html).not.toContain('<img')
    const withLogo = buildPreRoundEmail({ ...base, logoUrl: 'https://x.test/l.png' }).html
    expect(withLogo).toMatch(/<img[^>]+width="64"[^>]+height="64"/)
  })
  it('shows the organizer note only when it has text', () => {
    expect(buildPreRoundEmail({ ...base, note: '   ' }).html).not.toMatch(/From the organizer/i)
    const html = buildPreRoundEmail({ ...base, note: 'Line one\nLine two' }).html
    expect(html).toMatch(/From the organizer/i)
    expect(html).toContain('Line one<br>Line two')
  })
  it('hides Place a bet without a wager link', () => {
    expect(buildPreRoundEmail({ ...base, wagerUrl: null }).html).not.toContain('Place a bet')
    expect(buildPreRoundEmail(base).html).toContain('Place a bet')
  })
  it('does not repeat the date and drops the (Course Handicap) label', () => {
    const { html } = buildPreRoundEmail(base)
    expect(html.match(/Saturday, November 7, 2026/g)).toHaveLength(1)
    expect(html).not.toContain('Course Handicap')
  })
  it('sorts flight names A to Z and shows handicaps only when present', () => {
    const { html: full } = buildPreRoundEmail(base)
    const html = full.slice(full.indexOf('Players by flight'))
    expect(html.indexOf('Amy Adams')).toBeLessThan(html.indexOf('Zed Zimmer'))
    expect(html).toContain('Flight A')
    expect(html).toContain('Flight B')
    expect(html).toContain('3 registered')
  })
  it('shows the posted-soon box without groups, and a No flight yet card for unassigned players', () => {
    const none = buildPreRoundEmail({ ...base, eventPlayers: [{ ...eps[0], group_number: null, flight: null }] }).html
    expect(none).toContain('Groups and tee times will be posted soon')
    expect(none).toContain('No flight yet')
    expect(buildPreRoundEmail(base).html).not.toContain('No flight yet')
  })
  it('keeps the subject', () => {
    expect(buildPreRoundEmail(base).subject).toBe('MIGC: Playoffs Round 2 — Nov 7')
  })
})

describe('preRoundIncludes / emailCompetitions', () => {
  it('flags missing data', () => {
    const inc = preRoundIncludes({ ...event, formats: [], side_game_options: [] }, [])
    expect(inc.filter(i => i.missing).map(i => i.label)).toEqual(['Competitions & side games', 'Groups & tee times', 'Players by flight'])
  })
  it('gives Closest to Pin a Full field detail when no holes are set', () => {
    const c = emailCompetitions({ ...event, side_game_options: ['ctp'] }).find(r => r.name === 'Closest to Pin')
    if (c) expect(c.detail).toBe('Full field')
  })
})
