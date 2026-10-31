import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LeagueMark from '../ui/LeagueMark'
import ExportHeader from '../ui/ExportHeader'
import WagerPageHeader from './WagerPageHeader'
import { initialsOf } from '../../lib/logoData'

const html = el => renderToStaticMarkup(el)

describe('initialsOf', () => {
  it('uses the first letters of the first two words', () => {
    expect(initialsOf("Mulligan's Island Golf Club")).toBe('MI')
    expect(initialsOf('Fairway')).toBe('FA')
    expect(initialsOf('')).toBe('')
  })
})

describe('LeagueMark', () => {
  it('shows the logo contained, with the league name in the alt text', () => {
    const out = html(h(LeagueMark, { name: 'Mulligans', logoUrl: '/l.png', size: 40 }))
    expect(out).toContain('src="/l.png"')
    expect(out).toContain('alt="Mulligans logo"')
    expect(out).toContain('object-contain')
    expect(out).toContain('width="40"')
  })
  it('falls back to a green circle with gold initials, never a broken image', () => {
    const out = html(h(LeagueMark, { name: "Mulligan's Island", logoUrl: null }))
    expect(out).not.toContain('<img')
    expect(out).toContain('rounded-full')
    expect(out).toContain('bg-fairway-700')
    expect(out).toContain('MI')
  })
})

describe('ExportHeader', () => {
  it('has the logo left of the league name, title, pill, meta and right-hand lines, with no solid band', () => {
    const out = html(h(ExportHeader, { leagueName: 'Mulligans', logoUrl: '/l.png', title: 'Wager payout summary', pill: 'Final · Settled', meta: 'Playoffs · Course · Sun', right: ['Generated Oct 25, 2026', 'Payouts include stake'] }))
    expect(out.indexOf('<img')).toBeLessThan(out.indexOf('Mulligans</div>'))
    expect(out).toContain('Wager payout summary')
    expect(out).toContain('Final · Settled')
    expect(out).toContain('Generated Oct 25, 2026')
    expect(out).not.toMatch(/bg-fairway-(700|800)(?! )[^"]*"[^>]*>\s*<div/)
  })
  it('compact version is logo plus event name', () => {
    const out = html(h(ExportHeader, { leagueName: 'Mulligans', logoUrl: null, title: 'Playoffs', compact: true }))
    expect(out).toContain('Playoffs')
    expect(out).not.toContain('<h1')
  })
})

describe('WagerPageHeader', () => {
  it('renders the pill in the right tone and the actions', () => {
    const open = html(h(WagerPageHeader, { leagueName: 'M', title: 'Bet', pill: { tone: 'open', label: 'Betting open' }, actions: h('a', null, 'x') }))
    expect(open).toContain('bg-status-active-bg')
    const closed = html(h(WagerPageHeader, { leagueName: 'M', title: 'Bet', pill: { tone: 'closed', label: 'Betting closed · Settled' } }))
    expect(closed).toContain('bg-surface-high')
  })
})
