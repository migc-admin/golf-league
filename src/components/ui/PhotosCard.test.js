import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import PhotosCard from './PhotosCard'

const html = el => renderToStaticMarkup(el)
const props = { cover: h('div', null, 'COVER-UPLOADER'), gallery: h('div', null, 'GALLERY-MANAGER') }

describe('PhotosCard', () => {
  it('merges cover photo and gallery into one "Photos" card, side by side on wide screens', () => {
    const out = html(h(PhotosCard, props))
    expect(out.match(/>Photos</g)).toHaveLength(1)
    expect(out).toContain('Cover photo')
    expect(out).toContain('Event gallery')
    expect(out).toContain('md:grid-cols-2')
    expect(out.indexOf('COVER-UPLOADER')).toBeLessThan(out.indexOf('GALLERY-MANAGER'))
  })

  it('keeps both sidebar/readiness anchors', () => {
    const out = html(h(PhotosCard, props))
    expect(out).toContain('id="event-photos"')
    expect(out).toContain('id="cover-photo"')
  })

  it('shows the gallery note only when given (used while Upcoming)', () => {
    expect(html(h(PhotosCard, props))).not.toContain('Add photos after the round')
    expect(html(h(PhotosCard, { ...props, galleryNote: 'Add photos after the round.' }))).toContain('Add photos after the round.')
  })

  it('uses only existing tokens and no emoji', () => {
    const out = html(h(PhotosCard, props))
    expect(out).not.toMatch(/#[0-9a-fA-F]{3,6}/)
    expect(out).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
