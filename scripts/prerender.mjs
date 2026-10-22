// Prerenders the public pages into static HTML after `vite build`.
//
// For each route in PRERENDER_ROUTES it renders the page with the SSR bundle
// (.prerender/entry-server.js), merges the page's <head> tags (title,
// description, canonical, structured data) into dist/index.html, and writes it
// to dist/<route>/index.html. Visitors still get the normal interactive app —
// the browser replaces the prerendered markup once the JavaScript loads.
//
// If a single page fails to render, the build still succeeds: that route simply
// stays a regular client-rendered page.
//
// Also saves the untouched app shell as dist/200.html, which vercel.json uses as
// the fallback for every route that is not prerendered (admin, scorecards, etc.).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
const { render, PRERENDER_ROUTES } = await import(pathToFileURL(path.join(root, '.prerender', 'entry-server.js')).href)

fs.writeFileSync(path.join(dist, '200.html'), template)

// Head tags in index.html that a page's own <Helmet> replaces (avoids duplicates).
const REPLACEABLE = [
  ['<title',                           /<title[^>]*>[\s\S]*?<\/title>\s*/g],
  ['name="description"',               /<meta\s+name="description"[^>]*>\s*/g],
  ['property="og:title"',              /<meta\s+property="og:title"[^>]*>\s*/g],
  ['property="og:description"',        /<meta\s+property="og:description"[^>]*>\s*/g],
  ['name="twitter:title"',             /<meta\s+name="twitter:title"[^>]*>\s*/g],
  ['name="twitter:description"',       /<meta\s+name="twitter:description"[^>]*>\s*/g],
]

let ok = 0
const failed = []
for (const route of PRERENDER_ROUTES) {
  try {
    const { html, head } = render(route)
    if (!html || html.length < 500) throw new Error('rendered markup is empty')
    let page = template.replace(/<noscript>[\s\S]*?<\/noscript>\s*/g, '')
    for (const [needle, re] of REPLACEABLE) {
      if (head.includes(needle)) page = page.replace(re, '')
    }
    page = page.replace('</head>', `${head}\n  </head>`)
    if (!page.includes('<div id="root"></div>')) throw new Error('root element not found in template')
    page = page.replace('<div id="root"></div>', `<div id="root">${html}</div>`)
    const out = route === '/' ? path.join(dist, 'index.html') : path.join(dist, route.slice(1), 'index.html')
    fs.mkdirSync(path.dirname(out), { recursive: true })
    fs.writeFileSync(out, page)
    ok++
  } catch (err) {
    failed.push(route)
    console.warn(`prerender: skipped ${route} (${err.message})`)
  }
}
console.log(`prerender: ${ok}/${PRERENDER_ROUTES.length} pages written${failed.length ? `, skipped: ${failed.join(', ')}` : ''}`)
