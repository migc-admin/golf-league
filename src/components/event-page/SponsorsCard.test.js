import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SponsorsCard from './SponsorsCard'

const html = sponsors => renderToStaticMarkup(h(SponsorsCard, { sponsors }))

describe('SponsorsCard', () => {
  it('is hidden with no sponsors', () => {
    expect(html([])).toBe('')
    expect(html(null)).toBe('')
  })
  it('shows each sponsor once even if listed twice', () => {
    const out = html([
      { name: 'Scorify Golf', logo_url: '/s.png', url: '' },
      { name: 'Scorify Golf', logo_url: '/s.png', url: '' },
      { name: 'Pro Shop', logo_url: null, url: 'https://shop.test' },
    ])
    expect(out.match(/<li/g)).toHaveLength(2)
    expect(out).toContain('Sponsored by')
    expect(out).toContain('alt="Scorify Golf"')
  })
  it('uses 3:2 tiles, contain-fit logos, and name text without a logo', () => {
    const out = html([{ name: 'Pro Shop', logo_url: null }, { name: 'Bank', logo_url: '/b.png' }])
    expect(out).toContain('aspect-[3/2]')
    expect(out).toContain('object-contain')
    expect(out).toContain('>Pro Shop<')
  })
  it('links only sponsors that have a url, opening safely in a new tab', () => {
    const out = html([{ name: 'Pro Shop', url: 'https://shop.test' }, { name: 'Bank' }])
    expect(out.match(/<a /g)).toHaveLength(1)
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('target="_blank"')
  })
})
