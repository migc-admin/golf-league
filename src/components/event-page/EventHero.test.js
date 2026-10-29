import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import EventHero from './EventHero'

const base = { clubName: 'Mulligans', title: 'Playoffs – Round 2', dateLabel: 'Saturday, May 2, 2026', timeLabel: '8:00 AM', courseName: 'Pine Course', courseAddress: '1 Fairway Dr' }
const html = props => renderToStaticMarkup(h(EventHero, { ...base, ...props }))

describe('EventHero', () => {
  it('renders the title as the page H1 and the fact rows', () => {
    const out = html({ pill: { kind: 'open', label: 'Registration open' } })
    expect(out).toContain('<h1')
    expect(out).toContain('Playoffs – Round 2')
    expect(out).toContain('Saturday, May 2, 2026')
    expect(out).toContain('Pine Course')
    expect(out).toContain('Registration open')
  })
  it('links Directions to the Getting there section', () => {
    expect(html({})).toContain('href="#getting-there"')
  })
  it('omits Directions without an address and the time row without a date', () => {
    const out = html({ courseAddress: null, dateLabel: null })
    expect(out).not.toContain('Directions')
    expect(out).not.toContain('8:00 AM')
  })
  it('puts text before the media slot so phones show text first', () => {
    const out = html({ media: h('div', { id: 'cover' }), children: h('div', { id: 'card' }) })
    expect(out.indexOf('<h1')).toBeLessThan(out.indexOf('id="card"'))
    expect(out.indexOf('id="card"')).toBeLessThan(out.indexOf('id="cover"'))
  })
  it('uses no gold or emoji', () => {
    expect(html({ pill: { kind: 'open', label: 'x' } })).not.toMatch(/D4AF37|C9A84C|amber|yellow/i)
  })
})
