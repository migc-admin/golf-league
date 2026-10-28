import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WagerResultsCard from './WagerResultsCard'

const html = el => renderToStaticMarkup(el)
const win = {
  key: 'win', title: 'WIN pool', pool: 165, pill: 'T1 at net 72: John Nothdurft & Paul Hsieh',
  note: 'Whole pool split among bettors on the winner, pro rata to stake; payout includes stake.',
  rows: [
    { name: 'Darrick Sogabe', picked: 'John Nothdurft', stake: 5, payout: 82.5, net: 77.5 },
    { name: 'Paul Hsieh', picked: 'Paul Hsieh', stake: 5, payout: 82.5, net: 77.5 },
  ],
}
const place = {
  key: 'place', title: 'PLACE pool', pool: 25,
  pill: 'T1 at net 72: John Nothdurft & Paul Hsieh · tied for 1st (dead heat, no tiebreak)',
  note: 'Split 50/50 between 1st- and 2nd-place bettors; stake back plus share of profit. No PLACE bets on Paul Hsieh, so all profit goes to the other-place bettors.',
  rows: [
    { name: 'Jeff Carey', picked: 'John Nothdurft', stake: 5, payout: 12.5, net: 7.5 },
    { name: 'Kevin Taylor', picked: 'John Nothdurft', stake: 5, payout: 12.5, net: 7.5 },
  ],
}
const out = html(h(WagerResultsCard, { panels: [win, place] }))

describe('WagerResultsCard', () => {
  it('has the title and the winners-only subtitle (final), or the live one', () => {
    expect(out).toMatch(/<h2[^>]*>Wager Results<\/h2>/)
    expect(out).toContain('Final · Low net score · Winners only · Payout includes stake')
    expect(html(h(WagerResultsCard, { panels: [win], final: false }))).toContain('Live · Updates as scores are entered · Winners only · Payout includes stake')
  })

  it('shows one bordered panel per pool with the pool name, "Pool $X.XX", the gold winner pill and the note', () => {
    expect(out.match(/rounded-xl border/g)).toHaveLength(2)
    expect(out).toContain('WIN pool')
    expect(out).toContain('Pool $165.00')
    expect(out).toContain('Pool $25.00')
    expect(out).toContain('T1 at net 72: John Nothdurft &amp; Paul Hsieh')
    expect(out).toContain('bg-[#FBF3DC]')
    expect(out).toContain('text-[#6E5110]')
    expect(out).toContain('border-[#E3C77A]')
    expect(out).toContain('tied for 1st (dead heat, no tiebreak)')
    expect(out).toContain('all profit goes to the other-place bettors')
  })

  it('shows the columns Bettor | Picked | Stake | Payout | Net', () => {
    for (const col of ['Bettor', 'Picked', 'Stake', 'Payout', 'Net']) expect(out).toContain(`>${col}</th>`)
  })

  it('winning rows show stake, payout in bold green, and a signed net that is payout minus stake', () => {
    expect(out).toContain('Darrick Sogabe')
    expect(out).toMatch(/text-\[#5F5F5A\][^>]*>\$5\.00/)
    expect(out).toMatch(/font-bold tabular-nums text-fairway-700[^>]*>\$82\.50/)
    expect(out).toContain('+$77.50')
    expect(out).toContain('+$7.50')
    expect(out).toContain('$12.50')
  })

  it('scrolls the rows sideways inside a ~560px box instead of widening the page', () => {
    expect(out).toContain('overflow-x-auto')
    expect(out).toContain('min-w-[560px]')
  })

  it('a pool nobody won shows a plain "No winning bets." line and no table', () => {
    const empty = html(h(WagerResultsCard, { panels: [{ ...win, rows: [] }] }))
    expect(empty).toContain('No winning bets.')
    expect(empty).not.toContain('<table')
  })

  it('shows a message when search leaves no panels', () => {
    expect(html(h(WagerResultsCard, { panels: [], emptyMessage: 'No matching bettors.' }))).toContain('No matching bettors.')
  })

  it('never shows losing bets, ticket ids, payment tags or a settlement table', () => {
    expect(out).not.toMatch(/Lost|Venmo|Cash|Ticket|Settlement/i)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('uses the existing forest-green token for payout and net and no pool colors', () => {
    expect(out).not.toMatch(/#2E7D4F|#2B59A0|#6B46C1/)
  })
})
