import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import EventAdminHeader from './EventAdminHeader'

const html = el => renderToStaticMarkup(el)
const props = {
  clubName: "Mulligan's Island GC",
  title: 'Playoffs – Round 1',
  statusBadge: h('span', null, 'Complete'),
  meta: 'Course · Oct 12 · Entry fee $40',
  links: [{ href: '/o/l/e/event', label: 'Event page' }, { href: '/wager/1/board', label: 'Wager board' }],
  quietActions: h('button', null, 'Clone event'),
}

describe('EventAdminHeader', () => {
  it('shows club name above an H1 containing only the round name', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out.indexOf("Mulligan&#x27;s Island GC")).toBeLessThan(out.indexOf('<h1'))
    expect(out).toMatch(/<h1[^>]*>Playoffs – Round 1<\/h1>/)
  })

  it('shows status pill and meta line', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out).toContain('Complete')
    expect(out).toContain('Course · Oct 12 · Entry fee $40')
  })

  it('renders links as real new-tab anchors with the ↗ character', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out).toContain('<a href="/o/l/e/event"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out).toContain('Wager board')
    expect(out.match(/↗/g)).toHaveLength(2)
  })

  it('puts quiet actions below a 1px divider, and omits both when absent', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out.indexOf('border-t')).toBeLessThan(out.indexOf('Clone event'))
    const bare = html(h(EventAdminHeader, { title: 'x' }))
    expect(bare).not.toContain('border-t')
    expect(bare).not.toContain('<a ')
  })

  it('stacks on mobile and uses only existing tokens', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out).toContain('flex-col')
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|slate|zinc|amber|yellow|green)-/)
  })
})
