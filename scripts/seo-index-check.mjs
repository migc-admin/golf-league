// Checks with Google Search Console whether every page in the live sitemap is
// indexed, and flags the ones that need a manual "Request indexing".
//
//   npm run seo:index            (or: node scripts/seo-index-check.mjs)
//   npm run seo:index -- --json  (machine-readable output)
//   npm run seo:index -- --requested /blog/some-post,/golf-league-software
//       (record that you clicked "Request indexing" today; those pages won't be
//        flagged again for REQUEST_WAIT_DAYS)
//
// Local tooling only — never runs in the Vercel build. It needs the claude-seo
// Claude Code plugin and its Search Console credentials in
// ~/.config/claude-seo/google-api.json (service account with access to
// sc-domain:scorifygolf.com). History is kept in docs/seo/index-status.json so
// the report can tell new pages from pages that dropped out of the index.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SITE = 'https://www.scorifygolf.com'
const PROPERTY = 'sc-domain:scorifygolf.com'
const GRACE_DAYS = 7 // give Google a week before asking you to request indexing
const REQUEST_WAIT_DAYS = 14 // after a manual request, wait this long before flagging again
// Pages we don't mind Google skipping.
const LOW_PRIORITY = ['/privacy', '/terms', '/refund-policy', '/roadmap']

const STATE_FILE = fileURLToPath(new URL('../docs/seo/index-status.json', import.meta.url))
const asJson = process.argv.includes('--json')
const today = new Date().toLocaleDateString('en-CA') // local YYYY-MM-DD
const reqArg = process.argv.indexOf('--requested')
const requestedNow = reqArg > -1 ? (process.argv[reqArg + 1] ?? '').split(',').map(s => s.trim()).filter(Boolean) : []
const reqDate = (process.argv.find(a => a.startsWith('--requested-on=')) ?? '').split('=')[1] || today

function findRunner() {
  const base = join(homedir(), '.claude/plugins/cache/agricidaniel-claude-seo/claude-seo')
  const versions = existsSync(base) ? readdirSync(base).filter(v => /^\d/.test(v)) : []
  versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  for (const v of versions.reverse()) {
    const runner = join(base, v, 'scripts/claude-seo')
    if (existsSync(runner)) return runner
  }
  throw new Error(`claude-seo plugin not found under ${base}. Install the claude-seo plugin in Claude Code.`)
}

async function sitemapEntries() {
  const res = await fetch(`${SITE}/sitemap.xml`)
  if (!res.ok) throw new Error(`Could not fetch ${SITE}/sitemap.xml (HTTP ${res.status})`)
  const xml = await res.text()
  return [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(([, block]) => ({
    url: block.match(/<loc>([^<]+)<\/loc>/)[1].trim(),
    lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1].trim() ?? null,
  }))
}

function inspect(runner, urls) {
  const dir = mkdtempSync(join(tmpdir(), 'seo-index-'))
  const file = join(dir, 'urls.txt')
  writeFileSync(file, urls.join('\n') + '\n')
  const out = execFileSync(runner, ['run', 'gsc_inspect.py', '--batch', file, '--site-url', PROPERTY, '--json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 10 * 60 * 1000, maxBuffer: 50 * 1024 * 1024,
  })
  return JSON.parse(out).results ?? []
}

const daysBetween = (from, to) => Math.floor((new Date(to) - new Date(from)) / 86400000)
const pathOf = url => url.replace(SITE, '') || '/'

async function main() {
  const runner = findRunner()
  const entries = await sitemapEntries()
  const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { urls: {} }
  for (const p of requestedNow) {
    const url = SITE + (p.startsWith('/') ? p : `/${p}`)
    if (!entries.some(e => e.url === url)) { console.error(`--requested: ${p} is not in the sitemap, skipped`); continue }
    state.urls[url] = { ...(state.urls[url] ?? {}), requestedAt: reqDate }
  }

  let results = inspect(runner, entries.map(e => e.url))
  const failed = results.filter(r => r.error || !r.index_status)
  if (failed.length) {
    const retried = inspect(runner, failed.map(r => r.url))
    results = results.map(r => retried.find(x => x.url === r.url && !x.error) ?? r)
  }

  const rows = entries.map(({ url, lastmod }) => {
    const r = results.find(x => x.url === url) ?? { error: 'no result' }
    const prev = state.urls[url] ?? {}
    const firstSeen = prev.firstSeen ?? today
    const coverage = r.index_status?.coverage_state ?? null
    const indexed = r.index_status?.verdict === 'PASS'
    const age = daysBetween(lastmod && lastmod < firstSeen ? lastmod : firstSeen, today)
    const lowPriority = LOW_PRIORITY.includes(pathOf(url))
    const requestedAt = indexed ? null : (prev.requestedAt ?? null)
    const recentlyRequested = requestedAt && daysBetween(requestedAt, today) < REQUEST_WAIT_DAYS
    let bucket
    if (r.error && !r.index_status) bucket = 'error'
    else if (indexed) bucket = 'indexed'
    else if (prev.everIndexed) bucket = 'dropped'
    else if (lowPriority) bucket = 'ignored'
    else if (recentlyRequested) bucket = 'requested'
    else if (age >= GRACE_DAYS) bucket = 'action'
    else bucket = 'waiting'
    return {
      url, path: pathOf(url), bucket, coverage, age,
      lastCrawl: r.index_status?.last_crawl_time?.slice(0, 10) ?? null,
      error: r.error ?? null,
      firstSeen, everIndexed: Boolean(prev.everIndexed || indexed),
      indexedSince: indexed ? (prev.indexedSince ?? today) : null,
      requestedAt,
    }
  })

  // Save history (results that errored keep their previous status).
  mkdirSync(fileURLToPath(new URL('../docs/seo/', import.meta.url)), { recursive: true })
  for (const row of rows) {
    if (row.bucket === 'error') { state.urls[row.url] = { ...(state.urls[row.url] ?? {}), firstSeen: row.firstSeen }; continue }
    state.urls[row.url] = {
      firstSeen: row.firstSeen, everIndexed: row.everIndexed, indexedSince: row.indexedSince,
      requestedAt: row.requestedAt, coverage: row.coverage, lastCrawl: row.lastCrawl, checkedAt: today,
    }
  }
  state.lastRun = today
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + '\n')

  const by = b => rows.filter(r => r.bucket === b)
  const summary = {
    date: today, total: rows.length,
    indexed: by('indexed').length, action: by('action'), dropped: by('dropped'),
    waiting: by('waiting'), requested: by('requested'), ignored: by('ignored'), errors: by('error'),
  }
  if (asJson) { console.log(JSON.stringify({ ...summary, rows }, null, 2)); return }

  const line = r => `  - ${r.path} (${r.coverage ?? r.error}${r.lastCrawl ? `, last crawled ${r.lastCrawl}` : ''}${r.bucket === 'waiting' || r.bucket === 'action' ? `, ${r.age} days old` : ''})`
  const out = [`Index check ${today}: ${summary.indexed} of ${summary.total} sitemap pages indexed.`]
  if (summary.dropped.length) out.push('', 'DROPPED OUT OF THE INDEX (look into these first):', ...summary.dropped.map(line))
  if (summary.action.length) out.push('', `REQUEST INDEXING in Search Console (not indexed after ${GRACE_DAYS}+ days):`, ...summary.action.map(line))
  if (summary.requested.length) out.push('', `Indexing requested, waiting on Google (rechecked after ${REQUEST_WAIT_DAYS} days):`, ...summary.requested.map(r => `${line(r)}, requested ${r.requestedAt}`))
  if (summary.waiting.length) out.push('', `Waiting (newer than ${GRACE_DAYS} days, give Google time):`, ...summary.waiting.map(line))
  if (summary.errors.length) out.push('', 'Could not check (try again later):', ...summary.errors.map(line))
  if (summary.ignored.length) out.push('', `Not indexed, low priority (fine to leave): ${summary.ignored.map(r => r.path).join(', ')}`)
  if (!summary.dropped.length && !summary.action.length) out.push('', 'Nothing needs action.')
  console.log(out.join('\n'))
}

main().catch(err => { console.error(`seo-index-check: ${err.message}`); process.exit(1) })
