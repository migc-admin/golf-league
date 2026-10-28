import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MatchWagersCard from './MatchWagersCard'

const html = el => renderToStaticMarkup(el)
const m2 = {
  id: 'm2', number: 2, a: 'John Nothdurft', b: 'Mat Vigil', resultLine: '4&3 · Final', pool: 45, pill: 'Winner: John Nothdurft',
  rows: [
    { name: 'Mat Vigil', stake: 10, payout: 18, net: 8 },
    { name: 'Paguyo', stake: 5, payout: 9, net: 4 },
  ],
}
const halved = { id: 'm5', number: 5, a: 'Tai Ho', b: 'Max Obrien', resultLine: 'All square after 18 · Final', pool: 20, pill: 'Halved · Stakes refunded', halved: true,
  rows: [{ name: 'Jeff Carey', stake: 10, payout: 10, net: 0 }, { name: 'Kevin Taylor', stake: 10, payout: 10, net: 0 }] }
const nobody = { id: 'm3', number: 3, a: 'A', b: 'B', resultLine: '2&1 · Final', pool: 30, pill: 'Winner: A', note: 'No bets on the winner.', rows: [] }
const out = html(h(MatchWagersCard, { matches: [m2, halved, nobody] }))

describe('MatchWagersCard', () => {
  it('has the title and your subtitle', () => {
    expect(out).toMatch(/<h2[^>]*>Match Play Wagers<\/h2>/)
    expect(out).toContain('Pool per match · Winners only · Halved = stakes refunded · Payout includes stake')
  })

  it('lays cards out two per row on wide screens and one on phones, with a 20px gap', () => {
    expect(out).toContain('grid-cols-[repeat(auto-fit,minmax(min(100%,460px),1fr))]')
    expect(out).toContain('gap-5')
    expect(out.match(/<article/g)).toHaveLength(3)
  })

  it('each card has the small uppercase label, bold players, result line and pool', () => {
    expect(out).toContain('Match 2')
    expect(out).toContain('uppercase')
    expect(out).toContain('John Nothdurft vs Mat Vigil')
    expect(out).toContain('4&amp;3 · Final')
    expect(out).toContain('Pool $45.00')
  })

  it('shows the gold winner pill, then Bettor | Stake | Payout | Net rows with signed net', () => {
    expect(out).toContain('Winner: John Nothdurft')
    expect(out).toContain('bg-[#FBF3DC]')
    for (const c of ['Bettor', 'Stake', 'Payout', 'Net']) expect(out).toContain(`>${c}</span>`)
    expect(out).toContain('grid-cols-[1fr_68px_76px_68px]')
    expect(out).toContain('Mat Vigil')
    expect(out).toContain('$18.00')
    expect(out).toContain('+$8.00')
    expect(out).toContain('+$4.00')
  })

  it('a halved match shows the refund pill with payout equal to stake and Net $0.00', () => {
    expect(out).toContain('Halved · Stakes refunded')
    const halvedCard = out.slice(out.indexOf('Match 5'), out.indexOf('Match 3'))
    expect(halvedCard.match(/\$10\.00/g)?.length).toBeGreaterThanOrEqual(4) // stake + payout for two bettors
    expect(halvedCard.match(/\$0\.00/g)).toHaveLength(2)
    expect(halvedCard).not.toContain('+$')
  })

  it('a match nobody won shows the winner and the note, with no table of rows', () => {
    const card = out.slice(out.indexOf('Match 3'))
    expect(card).toContain('Winner: A')
    expect(card).toContain('No bets on the winner.')
    expect(card).not.toContain('>Bettor<')
  })

  it('keeps the rows inside a sideways-scrolling box', () => {
    expect(out).toContain('overflow-x-auto')
    expect(out).toContain('min-w-[320px]')
  })

  it('shows a message when there are no matches (e.g. search hides them all)', () => {
    expect(html(h(MatchWagersCard, { matches: [], emptyMessage: 'No matching bettors.' }))).toContain('No matching bettors.')
  })

  it('never shows losing bets, ticket ids, payment tags or a settlement table, and no pool colors or emoji', () => {
    expect(out).not.toMatch(/Lost|Venmo|Cash|Ticket|Settlement/i)
    expect(out).not.toMatch(/#2E7D4F|#2B59A0|#6B46C1/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
