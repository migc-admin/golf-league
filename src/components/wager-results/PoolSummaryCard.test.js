import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PoolSummaryCard from './PoolSummaryCard'

const html = el => renderToStaticMarkup(el)
const pools = { win: 165, place: 25, match: 285, total: 475 }
const out = html(h(PoolSummaryCard, { pools, betsLabel: '76 bets settled' }))

describe('PoolSummaryCard', () => {
  it('has the forest-green header with the gold title and the bets subtitle', () => {
    expect(out).toContain('bg-fairway-700')
    expect(out).toMatch(/<h2[^>]*text-\[#E3B94E\][^>]*>Pool Summary<\/h2>/)
    expect(out).toContain('76 bets settled')
    expect(out).toContain('text-[#CFE0D5]')
    expect(out).toContain('rounded-[14px]')
    expect(out).toContain('border-[#E4E1D8]')
  })

  it('shows the four pools with dollars and cents, in your numbers', () => {
    for (const v of ['$165.00', '$25.00', '$285.00', '$475.00']) expect(out).toContain(v)
    for (const l of ['WIN Pool', 'PLACE Pool', 'Match Pool', 'Total Pot']) expect(out).toContain(l)
  })

  it('colors each number: WIN green, PLACE blue, Match purple, Total forest green', () => {
    expect(out).toMatch(/text-\[#2E7D4F\][^>]*>\$165\.00/)
    expect(out).toMatch(/text-\[#2B59A0\][^>]*>\$25\.00/)
    expect(out).toMatch(/text-\[#6B46C1\][^>]*>\$285\.00/)
    expect(out).toMatch(/text-fairway-700[^>]*>\$475\.00/)
  })

  it('uses an auto-fit grid of 180px cells with 28px bold numbers and dividers between cells', () => {
    expect(out).toContain('grid-cols-[repeat(auto-fit,minmax(180px,1fr))]')
    expect(out).toContain('text-[28px] font-bold')
    expect(out.match(/border-l border-t/g)).toHaveLength(4)
  })

  it('still shows a zero match pool as $0.00', () => {
    expect(html(h(PoolSummaryCard, { pools: { ...pools, match: 0 }, betsLabel: 'x' }))).toContain('$0.00')
  })

  it('has no emoji', () => {
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
