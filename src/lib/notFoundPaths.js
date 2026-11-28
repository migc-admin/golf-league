// Which top-level addresses are real pages on the main site, so the server can
// answer anything else with a real 404 instead of a 200 "page" that is just the
// app shell. Used by /middleware.js (Vercel) and unit tested.
//
// Only single-segment paths (/pricing, /some-nonsense) are judged here. Deeper
// paths like /club/league/event belong to customer pages whose slugs live in the
// database, so they always pass through to the app.
//
// When you add a new one-segment route to src/App.jsx, add it here too.
export const TOP_LEVEL_PAGES = new Set([
  'admin', 'blog', 'faq', 'golf-league-software', 'golf-tournament-software', 'golf-trip-app',
  'help', 'home', 'login', 'onboarding', 'pricing', 'privacy', 'refund-policy',
  'reset-password', 'roadmap', 'terms', 'upgrade',
])

// League subdomains (club.scorifygolf.com) use /:leagueSlug at the top level, so they're never judged.
function isMainSite(hostname) {
  const h = (hostname ?? '').toLowerCase()
  if (h === 'scorifygolf.com' || h === 'www.scorifygolf.com') return true
  if (h.endsWith('.scorifygolf.com')) return false
  return true // preview deployments and localhost behave like the main site
}

/** True when the path is a single segment on the main site that no page answers. */
export function isUnknownTopLevelPath(pathname, hostname) {
  if (!isMainSite(hostname)) return false
  const m = /^\/([^/]+)\/?$/.exec(pathname ?? '')
  if (!m) return false // "/" or a deeper path
  const seg = decodeURIComponent(m[1]).toLowerCase()
  if (seg.includes('.')) return false // files (llms.txt, sitemap.xml, ...) are served or 404'd by the host
  return !TOP_LEVEL_PAGES.has(seg)
}
