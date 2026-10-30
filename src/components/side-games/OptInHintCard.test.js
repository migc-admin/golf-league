import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import OptInHintCard from './OptInHintCard'

describe('OptInHintCard', () => {
  const out = renderToStaticMarkup(h(OptInHintCard))
  it('explains how to turn on opt-in, with no buttons or emoji', () => {
    expect(out).toContain('Separate buy-in')
    expect(out).toContain('Payout tab')
    expect(out).toContain('Print &amp; share')
    expect(out).not.toContain('<button')
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
