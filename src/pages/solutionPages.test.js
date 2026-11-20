import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import * as league from './GolfLeagueSoftware'
import * as tournament from './GolfTournamentSoftware'
import * as trip from './GolfTripApp'
import { PRERENDER_ROUTES } from '../entry-server'
import { SOLUTIONS } from '../lib/solutions'
import { ONE_TIME } from '../lib/plans'

const PAGES = [
  { path: '/golf-league-software', keyword: 'golf league software', mod: league },
  { path: '/golf-tournament-software', keyword: 'golf tournament software', mod: tournament },
  { path: '/golf-trip-app', keyword: 'golf trip app', mod: trip },
]
const sitemap = readFileSync(new URL('../../public/sitemap.xml', import.meta.url), 'utf8')

describe.each(PAGES)('$path', ({ path, keyword, mod }) => {
  it('keeps the search title within 60 characters and the description within 160', () => {
    expect(mod.PAGE_TITLE.length).toBeLessThanOrEqual(60)
    expect(mod.PAGE_DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(mod.PAGE_TITLE.toLowerCase()).toContain(keyword)
  })

  it('is prerendered, in the sitemap, and linked from the homepage router', () => {
    expect(PRERENDER_ROUTES).toContain(path)
    expect(sitemap).toContain(`<loc>https://www.scorifygolf.com${path}</loc>`)
    expect(SOLUTIONS.map(s => s.path)).toContain(path)
  })
})

describe('solutions', () => {
  it('quotes one-time prices from plans.js', () => {
    const text = SOLUTIONS.flatMap(s => s.points).join(' ')
    for (const o of ONE_TIME) expect(text).toContain(o.price.replace('Starting at ', ''))
  })
})
