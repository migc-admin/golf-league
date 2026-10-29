import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import SectionCard, { LockedSectionCard } from './SectionCard'

const html = el => renderToStaticMarkup(el)

describe('SectionCard', () => {
  it('shows eyebrow, title and children', () => {
    const out = html(h(SectionCard, { eyebrow: 'Step 1 · Before the round', title: 'Pre-round' }, h('p', null, 'body')))
    expect(out).toContain('Step 1 · Before the round')
    expect(out).toContain('>Pre-round<')
    expect(out).toContain('body')
    expect(out).not.toContain('Done')
  })

  it('shows a Done pill only when done, using the existing green tint', () => {
    const out = html(h(SectionCard, { title: 'Pre-round', done: true }))
    expect(out).toContain('>Done<')
    expect(out).toContain('bg-status-active-bg')
  })

  it('shows an optional muted subtitle and a right-hand note', () => {
    const out = html(h(SectionCard, { title: 'Long Drive', subtitle: 'One winner per flight', aside: '0 of 2' }))
    expect(out).toContain('One winner per flight')
    expect(out).toContain('0 of 2')
    expect(html(h(SectionCard, { title: 'x' }))).not.toContain('text-ink-muted">0')
  })

  it('renders the header action when given', () => {
    const out = html(h(SectionCard, { title: 'x', headerAction: h('button', null, 'Download print packet') }))
    expect(out).toContain('Download print packet')
  })

  it('locked card is dashed and muted, lists items and contains no buttons or links', () => {
    const out = html(h(LockedSectionCard, {
      eyebrow: 'Step 3 · After the round', title: 'Results',
      note: 'Unlocks when the event is marked complete',
      items: ['Tournament results', 'Payouts per player'],
    }))
    expect(out).toContain('border-dashed')
    expect(out).toContain('Unlocks when the event is marked complete')
    expect(out).toContain('<li>Tournament results</li>')
    expect(out).not.toMatch(/<button|<a /)
  })

  it('uses only existing color tokens', () => {
    for (const out of [html(h(SectionCard, { title: 'x', done: true })), html(h(LockedSectionCard, { title: 'x' }))]) {
      expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
      expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|slate|zinc|amber|yellow|green)-/)
    }
  })
})
