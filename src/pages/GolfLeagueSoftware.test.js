import { describe, it, expect } from 'vitest'
import { PAGE_TITLE, PAGE_DESCRIPTION } from './GolfLeagueSoftware'
import { PRERENDER_ROUTES } from '../entry-server'

describe('golf league software page', () => {
  it('keeps the search title within 60 characters and the description within 160', () => {
    expect(PAGE_TITLE.length).toBeLessThanOrEqual(60)
    expect(PAGE_DESCRIPTION.length).toBeLessThanOrEqual(160)
    expect(PAGE_TITLE.toLowerCase()).toContain('golf league software')
  })

  it('is prerendered for search engines', () => {
    expect(PRERENDER_ROUTES).toContain('/golf-league-software')
  })
})
