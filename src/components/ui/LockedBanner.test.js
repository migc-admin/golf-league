import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import LockedBanner from './LockedBanner'

const html = el => renderToStaticMarkup(el)

describe('LockedBanner', () => {
  const out = html(h(LockedBanner, { onReopen: () => {} }))

  it('shows the lock icon, the title, the explanation and the button, in your wording', () => {
    expect(out).toContain('<svg')
    expect(out).toContain('Groups and pairings are locked')
    expect(out).toContain('The event is complete. Re-open it to make changes. Tiebreak winners can still be set.')
    expect(out).toContain('>Re-open on Overview<')
  })

  it('uses the existing light forest-green tint and no emoji', () => {
    expect(out).toContain('bg-status-active-bg')
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('stacks on phones and the button is a real 44px button', () => {
    expect(out).toContain('flex-col')
    expect(out).toContain('min-h-[44px]')
    expect(out).toMatch(/<button type="button"/)
  })

  it('takes its own title and text for other pages (Payout setup)', () => {
    const custom = html(h(LockedBanner, { onReopen: () => {}, title: 'Payout setup is locked', text: 'The event is complete, so these amounts produced the results.' }))
    expect(custom).toContain('Payout setup is locked')
    expect(custom).toContain('these amounts produced the results')
    expect(custom).not.toContain('Groups and pairings')
  })

  it('can label its button differently (e.g. "Unlock selections")', () => {
    const o = html(h(LockedBanner, { onReopen: () => {}, buttonLabel: 'Unlock selections' }))
    expect(o).toContain('>Unlock selections<')
    expect(o).not.toContain('Re-open on Overview')
  })

  it('only calls the handler it was given (the page makes it a plain navigation)', () => {
    const calls = []
    const el = LockedBanner({ onReopen: () => calls.push('go') })
    el.props.children[1].props.onClick()
    expect(calls).toEqual(['go'])
  })
})
