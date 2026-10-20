// Generates public/sitemap.xml from the site's static pages plus every post in
// src/lib/blogPosts.js, so a new blog post can never be left out of the sitemap.
// Runs automatically before every build (see "prebuild" in package.json) and can
// be run by hand with: node scripts/generate-sitemap.mjs
//
// To add a static page, add it to HEAD_PAGES or TAIL_PAGES below. Pages that
// should not be indexed (login, admin, etc.) are blocked in public/robots.txt
// and must NOT be listed here.
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BLOG_POSTS } from '../src/lib/blogPosts.js'

const SITE = 'https://www.scorifygolf.com'

const HEAD_PAGES = [
  { path: '/',     changefreq: 'weekly',  priority: '1.0' },
  { path: '/faq',  changefreq: 'monthly', priority: '0.8' },
  { path: '/blog', changefreq: 'weekly',  priority: '0.8' },
]
const TAIL_PAGES = [
  { path: '/roadmap',       changefreq: 'weekly',  priority: '0.7' },
  { path: '/help',          changefreq: 'monthly', priority: '0.6' },
  { path: '/privacy',       changefreq: 'yearly',  priority: '0.3' },
  { path: '/terms',         changefreq: 'yearly',  priority: '0.3' },
  { path: '/refund-policy', changefreq: 'yearly',  priority: '0.3' },
]

const blogEntries = BLOG_POSTS.map(p => ({
  path: `/blog/${p.slug}`,
  lastmod: p.updated ?? p.date, // optional `updated` field on a post overrides its publish date
  changefreq: 'monthly',
  priority: '0.6',
}))

const urlBlock = ({ path, lastmod, changefreq, priority }) =>
  [
    '  <url>',
    `    <loc>${SITE}${path === '/' ? '/' : path}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].filter(Boolean).join('\n')

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...[...HEAD_PAGES, ...blogEntries, ...TAIL_PAGES].map(urlBlock),
  '</urlset>',
  '',
].join('\n')

const outPath = fileURLToPath(new URL('../public/sitemap.xml', import.meta.url))
writeFileSync(outPath, xml)
console.log(`sitemap.xml: ${HEAD_PAGES.length + blogEntries.length + TAIL_PAGES.length} URLs (${blogEntries.length} blog posts)`)
