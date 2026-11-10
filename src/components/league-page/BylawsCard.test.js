import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import BylawsCard from './BylawsCard'

const text = `ARTICLE I – MEMBERSHIP
Open to all members.

ARTICLE II – HANDICAPS
- Posted within **24 hours**
- See https://www.usga.org/handicapping

ARTICLE III – DUES
<script>alert(1)</script>`

describe('BylawsCard', () => {
  const html = renderToStaticMarkup(h(BylawsCard, { leagueName: 'Mulligans', text, updatedAt: '2026-11-09T20:00:00Z' }))

  it('shows headings, bullets, bold and links', () => {
    expect(html).toContain('League rules &amp; bylaws')
    expect(html).toContain('Last updated Nov 9, 2026')
    expect(html.match(/<h3/g)).toHaveLength(3)
    expect(html).toContain('<strong class="font-semibold">24 hours</strong>')
    expect(html).toContain('href="https://www.usga.org/handicapping"')
  })
  it('lists sections when there are three or more headings', () => {
    expect(html).toContain('Contents')
  })
  it('never renders pasted markup', () => {
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
