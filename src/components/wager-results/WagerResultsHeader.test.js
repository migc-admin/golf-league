import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import WagerResultsHeader from './WagerResultsHeader'

const html = el => renderToStaticMarkup(el)
const props = {
  clubName: "Mulligan's Island Golf Club",
  title: 'Playoffs - Round 1 · Wagers',
  meta: 'The Golf Club of California · Sun, Oct 25, 2026',
  statusLabel: 'Final · Settled',
  final: true,
  logoUrl: '/logo.png',
  query: '',
  onQuery: () => {},
}

describe('WagerResultsHeader', () => {
  const out = html(h(WagerResultsHeader, props))

  it('shows a 72px circular logo, the uppercase club eyebrow, the title and the meta line', () => {
    expect(out).toContain('src="/logo.png"')
    expect(out).toContain('h-[72px] w-[72px]')
    expect(out).toContain('rounded-full')
    expect(out).toContain('uppercase')
    expect(out).toContain('tracking-[0.14em]')
    expect(out).toMatch(/<h1[^>]*>Playoffs - Round 1 · Wagers<\/h1>/)
    expect(out).toContain('The Golf Club of California · Sun, Oct 25, 2026')
  })

  it('shows the final pill in the light green tint, and another tint when not final', () => {
    expect(out).toContain('Final · Settled')
    expect(out).toContain('bg-[#E6EFE9]')
    const live = html(h(WagerResultsHeader, { ...props, final: false, statusLabel: 'Live' }))
    expect(live).toContain('Live')
    expect(live).not.toContain('bg-[#E6EFE9]')
  })

  it('has a visible label tied to a 44px search input with the right placeholder', () => {
    expect(out).toMatch(/<label for="([^"]+)"[^>]*>Find a bettor<\/label>/)
    expect(out).toMatch(/<input id="[^"]+" type="search"/)
    expect(out).toContain('placeholder="Search by bettor name"')
    expect(out).toContain('h-11')
  })

  it('shows the current search text and wraps on narrow screens', () => {
    expect(html(h(WagerResultsHeader, { ...props, query: 'sogabe' }))).toContain('value="sogabe"')
    expect(out).toContain('flex-wrap')
    expect(out).toContain('w-full')
  })

  it('can leave the search box out (used by the PNG)', () => {
    const noSearch = html(h(WagerResultsHeader, { ...props, showSearch: false }))
    expect(noSearch).not.toContain('Find a bettor')
    expect(noSearch).not.toContain('type="search"')
    expect(noSearch).toContain('Playoffs - Round 1 · Wagers')
  })

  it('has no emoji', () => {
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
