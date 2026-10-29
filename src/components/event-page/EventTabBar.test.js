import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import EventTabBar from './EventTabBar'
import { eventTabs } from '../../lib/eventPageView'

const html = (props, tabOpts = {}) => renderToStaticMarkup(h(MemoryRouter, null, h(EventTabBar, {
  ...eventTabs({ hasMatchups: false, canRegister: false, ...tabOpts }),
  value: 'overview', onChange() {}, leaderboardUrl: '/lb', registerHref: '/register/a/b', ...props,
})))

describe('EventTabBar', () => {
  it('is a sticky tablist with the active tab marked', () => {
    const out = html({})
    expect(out).toContain('sticky top-0')
    expect(out).toContain('role="tablist"')
    expect(out).toMatch(/aria-selected="true"[^>]*>Overview/)
    expect(out).toContain('border-b-[3px]')
  })
  it('lists Overview, Pairings, Photos, then Leaderboard', () => {
    const out = html({})
    const order = ['Overview', 'Pairings', 'Photos', 'Leaderboard ↗'].map(t => out.indexOf(t))
    expect(order.every(i => i > -1)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(out).not.toContain('Matchups')
  })
  it('adds Matchups only when there are matches', () => {
    expect(html({}, { hasMatchups: true })).toContain('Matchups')
  })
  it('shows Register with the fee only while open', () => {
    expect(html({}, { canRegister: true, fee: '$160' })).toContain('Register · $160')
    expect(html({}, { canRegister: false, fee: '$160' })).not.toContain('Register')
  })
  it('links Leaderboard to the existing url', () => {
    expect(html({})).toContain('href="/lb"')
  })
})
