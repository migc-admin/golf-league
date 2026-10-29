import { describe, it, expect, vi } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LocalRulesCard from './LocalRulesCard'

// No DOM in node tests; text is already escaped by markdownToHtml.
vi.mock('dompurify', () => ({ default: { sanitize: html => html } }))

const html = text => renderToStaticMarkup(h(LocalRulesCard, { text }))

describe('LocalRulesCard', () => {
  it('is hidden when empty', () => {
    expect(html('')).toBe('')
    expect(html('  ')).toBe('')
    expect(html(undefined)).toBe('')
  })
  it('is a native collapsed details with a rotating chevron', () => {
    const out = html('Free drop in the rough')
    expect(out).toMatch(/^<details/)
    expect(out).not.toContain(' open')
    expect(out).toContain('<summary')
    expect(out).toContain('Local rules')
    expect(out).toContain('group-open:rotate-180')
  })
  it('shows the rules as typed', () => {
    const out = html('1. Lift, clean, place\n2. **No** carts')
    expect(out).toContain('1. Lift, clean, place<br/>2. <strong>No</strong> carts')
  })
})
