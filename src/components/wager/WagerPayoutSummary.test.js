import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WagerPayoutSummary, { summaryTiles } from './WagerPayoutSummary'
import { buildSummary } from '../../lib/wagerSummaryView'

const model = {
  final: true, betCount: 4, pools: { win: 100, place: 0, match: 30, total: 130 },
  panels: [{ key: 'win', title: 'WIN pool', pool: 100, pill: 'p', note: 'n', winnerText: 'T1 · Sam Lee / Joe Ng', rows: [{ name: 'Ann', stake: 10, payout: 100, net: 90 }] }],
  matches: [{ id: 'a', number: 3, a: 'Sam Lee', b: 'Joe Ng', pool: 30, winnerText: 'Joe Ng', pill: 'w', rows: [{ name: 'Bo', stake: 10, payout: 30, net: 20 }] }],
}
const summary = buildSummary(model)
const sheet = (extra = {}) => renderToStaticMarkup(h(WagerPayoutSummary, {
  leagueName: 'Mulligans', logoUrl: '/l.png', eventName: 'Playoffs', meta: 'Playoffs · Course · Sun', summary, generatedOn: 'Oct 25, 2026', ...extra,
}))

describe('summaryTiles', () => {
  it('makes four tiles, with Paid out green when it ties and amber when it does not', () => {
    const t = summaryTiles(summary)
    expect(t.map(x => x.label)).toEqual(['Total pot', 'Paid out', 'Bets settled', 'Top earner'])
    expect(t[1].tone).toBe('good')
    expect(t[0].helper).toBe('Win $100.00 · Place $0.00 · Match $30.00')
    const bad = buildSummary({ ...model, panels: [{ ...model.panels[0], rows: [{ name: 'Ann', stake: 10, payout: 80, net: 70 }] }] })
    expect(summaryTiles(bad)[1].tone).toBe('warn')
  })
})

describe('WagerPayoutSummary', () => {
  it('has the header, tiles, both cards and the footer', () => {
    const out = sheet()
    for (const text of ['Wager payout summary', 'Final · Settled', 'Generated Oct 25, 2026', 'Payouts include stake', 'Total pot', 'Top earner', 'Payout by bettor', 'Tie-out to the $130.00 pot', 'Powered by Scorify Golf', 'Source: Playoffs wager settlement, Oct 25, 2026']) {
      expect(out).toContain(text)
    }
  })
  it('lists winning bets as chips and net with a plus sign', () => {
    const out = sheet()
    expect(out).toContain('WIN')
    expect(out).toContain('M3')
    expect(out).toContain('+$90.00')
    expect(out).toContain('2 winners')
    expect(out).toContain('The +$110.00 profit equals the stakes from the 2 losing bets.')
  })
  it('shows a ✓ Ties pill for each pool and uses "·" in match names', () => {
    const out = sheet()
    expect(out.match(/✓ Ties/g).length).toBeGreaterThanOrEqual(3)
    expect(out).toContain('Match 3 · Lee vs Ng')
  })
  it('never splits a row and repeats headings', () => {
    const out = sheet()
    expect(out).toContain('break-inside:avoid')
    expect(out).toContain('display:table-header-group')
  })
  it('has no solid colored header band and no emoji', () => {
    const out = sheet()
    expect(out).not.toMatch(/<header[^>]*bg-fairway/)
    expect(out).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u)
  })
  it('shows the logo, or initials when there is none', () => {
    expect(sheet()).toContain('alt="Mulligans logo"')
    const none = sheet({ logoUrl: null })
    expect(none).not.toContain('<img')
    expect(none).toContain('MU')
  })
})
