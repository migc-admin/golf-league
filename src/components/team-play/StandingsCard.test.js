import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import StandingsCard from './StandingsCard'
import { standingsRows } from '../../lib/teamPlayView'

const html = el => renderToStaticMarkup(el)
const t = (id, name, color) => ({ id, name, color })
const teams = [t('t1', '19th Hole Cartel', '#2244aa'), t('t2', 'Just the Tips', '#22aa44'), t('t3', 'The Money Team', '#aa2222'), t('t4', 'White Rice', '#aa22aa')]
const tr = (team, pts, players) => ({ team, teamPoints: pts, selectedPlayers: players.map(([name, points], i) => ({ player_id: `${team.id}-${i}`, name, points })), memberIds: [] })
const eventResults = { teamResults: [
  tr(teams[2], 14, [['John Nothdurft', 10], ['Mikel Hodges', 4]]),
  tr(teams[1], 13.5, [['Kevin Vargas', 9], ['Tam Tran', 4.5]]),
  tr(teams[0], 11, [['Kevin Taylor', 5], ['Daniel Lopez', 6]]),
  tr(teams[3], 5, [['Will Vuong', 3], ['David Wu', 2]]),
] }
const rows = standingsRows({ eventResults, tglTeams: teams })
const out = html(h(StandingsCard, { rows }))

describe('StandingsCard', () => {
  it('has the title, subtitle and the four column headers', () => {
    expect(out).toContain('>Standings<')
    expect(out).toContain('Team points for this event, highest first.')
    for (const c of ['Rank', 'Team', 'Players', 'Points']) expect(out).toMatch(new RegExp(`<span[^>]*>${c}</span>`))
  })
  it('lists teams by rank with their points, showing halves, and each team named', () => {
    expect(out.indexOf('The Money Team')).toBeLessThan(out.indexOf('Just the Tips'))
    expect(out.indexOf('Just the Tips')).toBeLessThan(out.indexOf('19th Hole Cartel'))
    expect(out.indexOf('19th Hole Cartel')).toBeLessThan(out.indexOf('White Rice'))
    for (const r of ['#1', '#2', '#3', '#4']) expect(out).toContain(r)
    expect(out).toContain('>14<')
    expect(out).toContain('>13.5<')
    expect(out).toContain('>11<')
    expect(out).toContain('>5<')
  })
  it('shows a chip per selected player with bold points', () => {
    expect(out).toMatch(/John Nothdurft<strong[^>]*>10<\/strong>/)
    expect(out).toMatch(/Tam Tran<strong[^>]*>4\.5<\/strong>/)
  })
  it('draws each bar in the app green at its share of the leader, with a text label (not color alone)', () => {
    expect(out).toContain('width:100%')
    expect(out).toContain('width:96%') // 13.5 / 14
    expect(out).toContain('width:36%') // 5 / 14
    expect(out).toContain('aria-label="Just the Tips: 13.5 points, 96 percent of the leader"')
    expect(out).toContain('bg-fairway-700')
  })
  it('does not use the teams’ stored colors anywhere', () => {
    for (const c of ['#2244aa', '#22aa44', '#aa2222', '#aa22aa']) expect(out).not.toContain(c)
    expect(out).not.toContain('rounded-full" style="background')
  })
  it('stacks on phones: chips wrap under the team name; the header row is hidden below 768px', () => {
    expect(out).toContain('col-span-3')
    expect(out).toContain('flex-wrap')
    expect(out).toContain('hidden border-b')
    expect(out).toContain('md:grid-cols-[3.5rem_minmax(0,1.2fr)_minmax(0,2fr)_5rem]')
  })
  it('before scores: roster order, dashes for points and rank, empty bars', () => {
    const none = html(h(StandingsCard, { rows: standingsRows({ eventResults: null, tglTeams: teams }) }))
    expect(none.indexOf('19th Hole Cartel')).toBeLessThan(none.indexOf('Just the Tips'))
    expect(none).toContain('no points yet')
    expect(none).toContain('width:0%')
    expect(none).not.toContain('#1')
  })
  it('renders an optional header control and a message when there are no teams', () => {
    expect(html(h(StandingsCard, { rows, toggle: h('button', null, 'Season') }))).toContain('>Season<')
    expect(html(h(StandingsCard, { rows: [] }))).toContain('No teams yet')
  })
  it('uses tabular numbers, no emoji and no off-palette colors', () => {
    expect(out).toContain('tabular-nums')
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
  })
})
