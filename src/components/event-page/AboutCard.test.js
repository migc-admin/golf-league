import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import AboutCard from './AboutCard'

// No DOM in the node test environment, so DOMPurify is a pass-through here. The text is already
// HTML-escaped by markdownToHtml; the real sanitizer runs in the browser.
vi.mock('dompurify', () => ({ default: { sanitize: html => html } }))

const html = text => renderToStaticMarkup(h(AboutCard, { text }))

describe('AboutCard', () => {
  it('renders nothing for empty text', () => {
    expect(html('')).toBe('')
    expect(html('   ')).toBe('')
    expect(html(null)).toBe('')
  })
  it('keeps line breaks, bold and italic exactly as typed', () => {
    const out = html('Line one\n\nLine **two** is *bold*\nLine three')
    expect(out).toContain('Line one<br/><br/>Line <strong>two</strong> is <em>bold</em><br/>Line three')
  })
  it('does not trim, reorder or truncate long text', () => {
    const long = Array.from({ length: 200 }, (_, i) => `Item ${i}`).join('\n')
    const out = html(long)
    expect(out).toContain('Item 0<br/>Item 1')
    expect(out).toContain('Item 199')
  })
  it('escapes markup so nothing unsafe gets through', () => {
    const out = html('<script>alert(1)</script> <b>x</b>')
    expect(out).not.toContain('<script')
    expect(out).toContain('&lt;script&gt;')
  })
  it('has the title, readable measure and 16px text', () => {
    const out = html('Hi')
    expect(out).toContain('About this event')
    expect(out).toContain('max-w-[68ch]')
    expect(out).toContain('text-base')
    expect(out).toContain('leading-[1.65]')
  })
})
