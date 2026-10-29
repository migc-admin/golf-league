import { describe, it, expect } from 'vitest'
import { createElement as h } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import GettingThereCard from './GettingThereCard'
import { mapEmbedUrl } from '../../lib/eventPageView'

const maps = 'https://www.google.com/maps/search/?api=1&query=x'
const html = props => renderToStaticMarkup(h(GettingThereCard, { courseName: 'Pine Course', address: '1 Fairway Dr, Town', mapsUrl: maps, ...props }))

describe('mapEmbedUrl', () => {
  it('builds the existing embed url, or null without an address', () => {
    expect(mapEmbedUrl('1 Fairway Dr')).toBe('https://www.google.com/maps?q=1%20Fairway%20Dr&output=embed')
    expect(mapEmbedUrl(null)).toBe(null)
  })
})

describe('GettingThereCard', () => {
  it('is the Directions link target with a 16:10 map, names and a full-width button', () => {
    const out = html({})
    expect(out).toContain('id="getting-there"')
    expect(out).toContain('aspect-[16/10]')
    expect(out).toContain('<iframe')
    expect(out).toContain('output=embed')
    expect(out).toContain('Pine Course')
    expect(out).toContain('1 Fairway Dr, Town')
    expect(out).toContain('Get directions')
    expect(out).toContain('w-full')
    expect(out).toContain(`href="${maps.replace(/&/g, '&amp;')}"`)
    expect(out).toContain('target="_blank"')
  })
  it('skips the map without an address but keeps directions', () => {
    const out = html({ address: null })
    expect(out).not.toContain('<iframe')
    expect(out).toContain('Get directions')
  })
})
