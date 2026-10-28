import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LiveOddsCard from './LiveOddsCard'

const rows = [
  { name: 'John Nothdurft', winAmt: 5, winOdds: '33.00x', placeAmt: 10, placeOdds: '2.50x' },
  { name: 'Mike Paguyo', winAmt: 40, winOdds: '4.13x', placeAmt: 0, placeOdds: '—' },
]
const out = renderToStaticMarkup(h(LiveOddsCard, { rows }))

describe('LiveOddsCard', () => {
  it('uses the shared card shell with the Live Odds title', () => {
    expect(out).toMatch(/<h2[^>]*>Live Odds<\/h2>/)
    expect(out).toContain('bg-fairway-700')
  })
  it('shows each player with amounts and odds, and dashes where nobody bet', () => {
    expect(out).toContain('John Nothdurft')
    expect(out).toContain('$5.00')
    expect(out).toContain('33.00x')
    expect(out).toContain('2.50x')
    expect(out).toContain('$40.00')
    expect(out).toMatch(/Mike Paguyo[\s\S]*?—[\s\S]*?—/)
  })
  it('has no pool colors or emoji', () => {
    expect(out).not.toMatch(/#2E7D4F|#2B59A0|#6B46C1/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
