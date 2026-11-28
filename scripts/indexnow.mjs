// Tells IndexNow-enabled search engines (Bing, Yandex, Seznam, Naver, ...) which
// pages changed, so they re-crawl them now instead of on their own schedule.
//
// Run it by hand AFTER a deploy is live (the key file must already be on the site):
//   npm run seo:indexnow                      every URL in public/sitemap.xml
//   npm run seo:indexnow -- /blog/some-post   just these paths
//
// The key below is public by design: IndexNow verifies it by fetching
// https://www.scorifygolf.com/<key>.txt, which lives in /public.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const HOST = 'www.scorifygolf.com'
const KEY  = 'bd53ff051d47ae7592939d917a7fd512'

const sitemap = readFileSync(fileURLToPath(new URL('../public/sitemap.xml', import.meta.url)), 'utf8')
const all = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1])
const only = process.argv.slice(2).flatMap(a => a.split(',')).filter(Boolean)
const urlList = only.length ? only.map(p => (p.startsWith('http') ? p : `https://${HOST}${p.startsWith('/') ? p : `/${p}`}`)) : all

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: `https://${HOST}/${KEY}.txt`, urlList }),
})
console.log(`IndexNow: ${res.status} ${res.statusText} for ${urlList.length} URL${urlList.length === 1 ? '' : 's'}`)
if (res.status >= 400) process.exitCode = 1
