import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { isUnknownTopLevelPath, TOP_LEVEL_PAGES } from './notFoundPaths'

const WWW = 'www.scorifygolf.com'

describe('isUnknownTopLevelPath', () => {
  it('flags made-up single-segment paths on the main site', () => {
    expect(isUnknownTopLevelPath('/some-nonsense', WWW)).toBe(true)
    expect(isUnknownTopLevelPath('/pricingg/', WWW)).toBe(true)
    expect(isUnknownTopLevelPath('/abc', 'scorifygolf.com')).toBe(true)
  })
  it('lets real pages, the home page, deeper paths and files through', () => {
    for (const p of ['/', '/pricing', '/blog', '/faq/', '/Login', '/migc/mulligans-island', '/blog/flights-vs-full-field', '/author/kevin-vargas', '/llms.txt', '/sitemap.xml']) {
      expect(isUnknownTopLevelPath(p, WWW), p).toBe(false)
    }
  })
  it('never judges league subdomains, which use /:leagueSlug', () => {
    expect(isUnknownTopLevelPath('/mulligans-island', 'migc.scorifygolf.com')).toBe(false)
  })
  it('treats preview and local hosts like the main site', () => {
    expect(isUnknownTopLevelPath('/nope', 'golf-league-abc.vercel.app')).toBe(true)
  })
  it('covers every one-segment route in the app', () => {
    const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8')
    const oneSegment = [...app.matchAll(/path="\/([a-z0-9-]+)"/g)].map(m => m[1])
    for (const seg of oneSegment) expect(TOP_LEVEL_PAGES.has(seg), seg).toBe(true)
  })
})
