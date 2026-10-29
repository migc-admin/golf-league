import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import EventCoverImage from './EventCoverImage'

describe('EventCoverImage', () => {
  it('renders nothing without an image', () => {
    expect(renderToStaticMarkup(h(EventCoverImage, { src: null }))).toBe('')
  })
  it('shows the whole image on a dark green frame with the event name as alt', () => {
    const out = renderToStaticMarkup(h(EventCoverImage, { src: '/p.png', alt: 'Playoffs' }))
    expect(out).toContain('object-contain')
    expect(out).not.toContain('object-cover')
    expect(out).toContain('bg-fairway-800')
    expect(out).toContain('alt="Playoffs"')
    expect(out).toContain('h-[360px]')
    expect(out).toContain('lg:h-[500px]')
  })
})
