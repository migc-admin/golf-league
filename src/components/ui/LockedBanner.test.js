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

  it('only calls the handler it was given (the page makes it a plain navigation)', () => {
    const calls = []
    const el = LockedBanner({ onReopen: () => calls.push('go') })
    el.props.children[1].props.onClick()
    expect(calls).toEqual(['go'])
  })
})
