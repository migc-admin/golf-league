import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import EventAdminHeader from './EventAdminHeader'

const html = el => renderToStaticMarkup(el)
const props = {
  clubName: "Mulligan's Island Golf Club",
  title: 'Playoffs – Round 2',
  statusBadge: h('span', null, 'Upcoming'),
  meta: 'Native Oaks · Sun, Nov 15, 2026 · 9:10 AM start',
  links: [{ href: '/o/l/e/event', label: 'Event page' }, { href: '/wager/1/board', label: 'Wager board' }],
  actions: h('button', null, 'Clone'),
}

describe('EventAdminHeader', () => {
  it('shows the club name above an H1 that holds only the title', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out.indexOf('Golf Club')).toBeLessThan(out.indexOf('<h1'))
    expect(out).toMatch(/<h1[^>]*>Playoffs – Round 2<\/h1>/)
  })

  it('shows the status pill beside the title and the meta line below', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out.indexOf('<h1')).toBeLessThan(out.indexOf('Upcoming'))
    expect(out).toContain('Native Oaks · Sun, Nov 15, 2026 · 9:10 AM start')
  })

  it('renders links as real new-tab anchors with ↗, followed by the page actions on the right', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out).toContain('<a href="/o/l/e/event"')
    expect(out).toContain('target="_blank"')
    expect(out).toContain('rel="noopener noreferrer"')
    expect(out.match(/↗/g)).toHaveLength(2)
    expect(out.indexOf('Wager board')).toBeLessThan(out.indexOf('Clone'))
  })

  it('has no divider row any more; the actions share the right-hand group', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out).not.toContain('border-t')
    expect(out).toContain('lg:justify-end')
  })

  it('omits the right-hand group when there are no links or actions', () => {
    const out = html(h(EventAdminHeader, { title: 'x' }))
    expect(out).not.toContain('<a ')
    expect(out).not.toContain('lg:justify-end')
  })

  it('stacks on small screens and uses only existing tokens', () => {
    const out = html(h(EventAdminHeader, props))
    expect(out).toContain('flex-col')
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\b(?:bg|text|border)-(?:gray|slate|zinc|amber|yellow|green)-/)
  })
})
