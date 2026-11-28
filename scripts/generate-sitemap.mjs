// Generates public/sitemap.xml from the site's static pages plus every post in
// src/lib/blogPosts.js, so a new blog post can never be left out of the sitemap.
// Runs automatically before every build (see "prebuild" in package.json) and can
// be run by hand with: node scripts/generate-sitemap.mjs
//
// To add a static page, add it to HEAD_PAGES or TAIL_PAGES below. Pages that
// should not be indexed (login, admin, etc.) are blocked in public/robots.txt
// and must NOT be listed here.
//
// lastmod is the page's real modification date, never the build date:
//   - blog posts: the post's `updated` field, else its publish date
//   - /blog and the author page: the newest post date
//   - other pages: the last git commit that touched the page's source files
//     (today, if those files have uncommitted edits). Where git isn't available
//     (some build servers), the date already in the committed sitemap is kept.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { BLOG_POSTS } from '../src/lib/blogPosts.js'

const SITE = 'https://www.scorifygolf.com'
const root = fileURLToPath(new URL('..', import.meta.url))
const outPath = fileURLToPath(new URL('../public/sitemap.xml', import.meta.url))

const LANDING = ['src/lib/plans.js', 'src/components/landing/LandingKit.jsx']
const HEAD_PAGES = [
  { path: '/',     changefreq: 'weekly',  priority: '1.0', src: ['src/pages/Home.jsx', 'src/components/ui/HeroLeague.jsx', 'src/components/ui/TestimonialsScroll.jsx', 'src/components/ui/PricingSection.jsx', 'src/components/ui/PlanCards.jsx', 'src/lib/plans.js'] },
  { path: '/golf-league-software', changefreq: 'monthly', priority: '0.9', src: ['src/pages/GolfLeagueSoftware.jsx', ...LANDING] },
  { path: '/golf-tournament-software', changefreq: 'monthly', priority: '0.8', src: ['src/pages/GolfTournamentSoftware.jsx', ...LANDING] },
  { path: '/golf-trip-app', changefreq: 'monthly', priority: '0.8', src: ['src/pages/GolfTripApp.jsx', ...LANDING] },
  { path: '/pricing', changefreq: 'monthly', priority: '0.8', src: ['src/pages/PricingPage.jsx', 'src/components/ui/PricingSection.jsx', 'src/components/ui/PlanCards.jsx', 'src/components/ui/ComparePlans.jsx', 'src/lib/planComparison.js', ...LANDING] },
  { path: '/faq',  changefreq: 'monthly', priority: '0.8', src: ['src/pages/FAQ.jsx'] },
  { path: '/blog', changefreq: 'weekly',  priority: '0.8', posts: true },
  { path: '/author/kevin-vargas', changefreq: 'monthly', priority: '0.5', posts: true, src: ['src/lib/author.js', 'src/pages/AuthorPage.jsx'] },
]
const TAIL_PAGES = [
  { path: '/roadmap',       changefreq: 'weekly',  priority: '0.7', src: ['src/pages/Roadmap.jsx'] },
  { path: '/help',          changefreq: 'monthly', priority: '0.6', src: ['src/pages/Help.jsx'] },
  { path: '/privacy',       changefreq: 'yearly',  priority: '0.3', src: ['src/pages/Privacy.jsx'] },
  { path: '/terms',         changefreq: 'yearly',  priority: '0.3', src: ['src/pages/Terms.jsx'] },
  { path: '/refund-policy', changefreq: 'yearly',  priority: '0.3', src: ['src/pages/RefundPolicy.jsx'] },
]

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const postDate = p => p.updated ?? p.date // optional `updated` field on a post overrides its publish date
const newestPost = BLOG_POSTS.map(postDate).sort().at(-1)

// Dates already in the committed sitemap, used when git can't answer
const previous = {}
if (existsSync(outPath)) {
  for (const m of readFileSync(outPath, 'utf8').matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)) previous[m[1]] = m[2]
}

function git(args) {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() } catch { return null }
}

function sourceDate(files) {
  if (!files?.length) return null
  const dirty = git(['status', '--porcelain', '--', ...files])
  if (dirty === null) return null
  if (dirty) return today()
  return git(['log', '-1', '--format=%cs', '--', ...files]) || null
}

function lastmodFor(page) {
  const dates = [sourceDate(page.src), page.posts ? newestPost : null].filter(Boolean)
  if (dates.length) return dates.sort().at(-1)
  return previous[`${SITE}${page.path}`] ?? null
}

const blogEntries = BLOG_POSTS.map(p => ({
  path: `/blog/${p.slug}`,
  lastmod: postDate(p),
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

const withDates = pages => pages.map(p => ({ ...p, lastmod: lastmodFor(p) }))

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...[...withDates(HEAD_PAGES), ...blogEntries, ...withDates(TAIL_PAGES)].map(urlBlock),
  '</urlset>',
  '',
].join('\n')

writeFileSync(outPath, xml)
console.log(`sitemap.xml: ${HEAD_PAGES.length + blogEntries.length + TAIL_PAGES.length} URLs (${blogEntries.length} blog posts)`)
