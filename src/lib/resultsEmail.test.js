import { describe, it, expect } from 'vitest'
import { buildPostRoundEmail } from './resultsEmail'

const event = { id: 'e2', name: 'Playoffs - Round 2' }
const teamRows = [
  { rank: 1, team: { name: 'Eagles', color: '#1B4332' }, points: 12, players: [{ name: 'Ann Lee', points: 7 }, { name: 'Bo Fox', points: 5 }] },
  { rank: 2, team: { name: 'Hawks', color: null }, points: 8, players: [{ name: 'Cy Ray', points: 8 }] },
]
const teamSeason = {
  eventCount: 2,
  rows: [
    { rank: 1, team: { name: 'Hawks', color: null }, points: 20, events: [{ eventId: 'e1', points: 12 }, { eventId: 'e2', points: 8 }] },
    { rank: 2, team: { name: 'Eagles', color: '#1B4332' }, points: 18.5, events: [{ eventId: 'e1', points: 6.5 }, { eventId: 'e2', points: 12 }] },
  ],
}

describe('buildPostRoundEmail team standings', () => {
  it('shows this event and the season when season standings are given', () => {
    const { html } = buildPostRoundEmail({ event, view: null, teamRows, teamSeason, leagueName: 'MIGC' })
    expect(html).toContain('Team play standings · This event')
    expect(html).toContain('Season team standings · 2 events')
    expect(html).toContain('20 pts')
    expect(html).toContain('18.5 pts')
    expect(html).toContain('+12 pts this event')
    expect(html.indexOf('This event')).toBeLessThan(html.indexOf('Season team standings'))
  })
  it('keeps the single table when there is no season data', () => {
    const { html } = buildPostRoundEmail({ event, view: null, teamRows, leagueName: 'MIGC' })
    expect(html).toContain('Team play standings')
    expect(html).not.toContain('This event')
    expect(html).not.toContain('Season team standings')
  })
})

describe('buildPostRoundEmail buttons', () => {
  it('links to the league season standings page when given', () => {
    const { html } = buildPostRoundEmail({ event, view: null, leagueName: 'MIGC', leaderboardUrl: 'https://x/lb', standingsUrl: 'https://www.scorifygolf.com/migcsd/mulligans-island/standings' })
    expect(html).toContain('Season standings')
    expect(html).toContain('href="https://www.scorifygolf.com/migcsd/mulligans-island/standings"')
  })
  it('leaves the button out without a link', () => {
    const { html } = buildPostRoundEmail({ event, view: null, leagueName: 'MIGC', leaderboardUrl: 'https://x/lb' })
    expect(html).not.toContain('>Season standings<')
  })
})

describe('buildPostRoundEmail wager button', () => {
  it('links to the wager results next to Season standings when given', () => {
    const { html } = buildPostRoundEmail({ event, view: null, leagueName: 'MIGC', leaderboardUrl: 'https://x/lb', standingsUrl: 'https://x/st', wagerUrl: 'https://www.scorifygolf.com/wager/e2/results' })
    expect(html).toContain('href="https://www.scorifygolf.com/wager/e2/results"')
    expect(html.indexOf('>Season standings<')).toBeLessThan(html.indexOf('>Wager results<'))
  })
  it('has no wager button for other clubs', () => {
    const { html } = buildPostRoundEmail({ event, view: null, leagueName: 'X', leaderboardUrl: 'https://x/lb', standingsUrl: 'https://x/st' })
    expect(html).not.toContain('>Wager results<')
  })
})
