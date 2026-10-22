import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { BLOG_POSTS, getRelatedPosts } from './blogPosts'

describe('blog post SEO fields', () => {
  it('has unique slugs', () => {
    expect(new Set(BLOG_POSTS.map(p => p.slug)).size).toBe(BLOG_POSTS.length)
  })

  it('keeps search titles within 60 characters and descriptions within 160', () => {
    for (const p of BLOG_POSTS) {
      expect(p.seoTitle, `${p.slug} seoTitle`).toBeTruthy()
      expect(p.seoTitle.length, `${p.slug} seoTitle length`).toBeLessThanOrEqual(60)
      expect(p.metaDescription, `${p.slug} metaDescription`).toBeTruthy()
      expect(p.metaDescription.length, `${p.slug} metaDescription length`).toBeLessThanOrEqual(160)
    }
  })
})

describe('getRelatedPosts', () => {
  it('returns three other posts, never the post itself', () => {
    for (const p of BLOG_POSTS) {
      const related = getRelatedPosts(p)
      expect(related).toHaveLength(3)
      expect(related.map(r => r.slug)).not.toContain(p.slug)
      expect(new Set(related.map(r => r.slug)).size).toBe(3)
    }
  })

  it('points every post at the handbook except the handbook itself', () => {
    const handbook = 'running-a-golf-league-commissioners-handbook'
    for (const p of BLOG_POSTS.filter(x => x.slug !== handbook)) {
      expect(getRelatedPosts(p).map(r => r.slug)).toContain(handbook)
    }
  })
})

describe('llms.txt', () => {
  it('lists every blog post', () => {
    const txt = readFileSync(new URL('../../public/llms.txt', import.meta.url), 'utf8')
    for (const p of BLOG_POSTS) expect(txt).toContain(`https://www.scorifygolf.com/blog/${p.slug}`)
  })
})
