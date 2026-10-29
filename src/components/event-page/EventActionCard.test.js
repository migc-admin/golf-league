import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import EventActionCard from './EventActionCard'
import { countdownLabel } from '../../lib/eventPageView'

const future = new Date(Date.now() + 3 * 86400000 + 5 * 3600000)
const html = props => renderToStaticMarkup(h(MemoryRouter, null, h(EventActionCard, { leaderboardUrl: '/lb', regUrl: '/register/a/b', ...props })))

describe('EventActionCard', () => {
  it('open: countdown timer, fee and Register now', () => {
    const out = html({ kind: 'open', targetDate: future, fee: '$160' })
    expect(out).toContain('role="timer"')
    expect(out).toMatch(/aria-label="\d+ days?, \d+ hours?, \d+ minutes? until first tee"/)
    expect(out).toContain('First tee in')
    expect(out).toContain('$160')
    expect(out).toContain('Entry fee per player')
    expect(out).toContain('href="/register/a/b"')
    expect(out).toContain('Register now')
    expect(out).toContain('id="hero-register"')
  })
  it('open without a fee omits the fee block', () => {
    expect(html({ kind: 'open', targetDate: future, fee: null })).not.toContain('Entry fee per player')
  })
  it('closed: no Register anywhere, says Registration closed', () => {
    const out = html({ kind: 'closed', targetDate: future, fee: '$160' })
    expect(out).toContain('Registration closed')
    expect(out).not.toContain('Register now')
    expect(out).not.toContain('/register/')
  })
  it('closed after tee-off: no timer', () => {
    expect(html({ kind: 'closed', targetDate: new Date(Date.now() - 1000) })).not.toContain('role="timer"')
  })
  it('complete: leaderboard + photos, no Register or timer', () => {
    const out = html({ kind: 'complete', targetDate: future, fee: '$160' })
    expect(out).toContain('See final leaderboard')
    expect(out).toContain('href="/lb"')
    expect(out).toContain('Event photos')
    expect(out).not.toMatch(/Register|role="timer"/)
  })
  it('uses no gold', () => {
    expect(html({ kind: 'open', targetDate: future, fee: '$1' })).not.toMatch(/D4AF37|C9A84C|amber|yellow/i)
  })
})

describe('countdownLabel', () => {
  it('pluralises', () => {
    expect(countdownLabel({ days: 1, hours: 0, minutes: 2 })).toBe('1 day, 0 hours, 2 minutes until first tee')
    expect(countdownLabel(null)).toBe('')
  })
})
