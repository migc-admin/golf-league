import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import HeroEmailCard from './HeroEmailCard'

const html = el => renderToStaticMarkup(el)
const base = { title: 'Tournament details email', description: 'Format, tee times and local rules' }

describe('HeroEmailCard', () => {
  it('shows title, GMAIL tag, description, and the one button', () => {
    const out = html(h(HeroEmailCard, base))
    expect(out).toContain('Tournament details email')
    expect(out).toContain('>GMAIL<')
    expect(out).toContain('Format, tee times and local rules')
    expect(out).not.toContain('>Preview<')
    expect(out).toContain('>Copy email<')
  })

  it('Copy email is the only button, and it is Primary', () => {
    const out = html(h(HeroEmailCard, base))
    expect(out.match(/bg-fairway-700/g)).toHaveLength(1)
  })

  it('is tinted green using existing tokens and has no emoji', () => {
    const out = html(h(HeroEmailCard, base))
    expect(out).toContain('bg-fairway-50')
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })

  it('wires the button to the handler it was given', () => {
    const calls = []
    const el = HeroEmailCard({ ...base, onCopy: () => calls.push('copy') })
    el.props.children[1].props.children.props.onClick()
    expect(calls).toEqual(['copy'])
  })
})
