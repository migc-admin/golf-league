// Vercel Routing Middleware: made-up top-level addresses on the main site
// (scorifygolf.com/some-nonsense) get a real 404 status instead of 200, so search
// engines don't index an endless set of empty pages. Visitors still see the app's
// "page not found" screen, because the response body is the normal app shell.
// The rule for what counts as a real page lives in src/lib/notFoundPaths.js.
import { isUnknownTopLevelPath } from './src/lib/notFoundPaths.js'

export const config = { matcher: '/:slug' }

export default async function middleware(request) {
  const url = new URL(request.url)
  if (!isUnknownTopLevelPath(url.pathname, url.hostname)) {
    // Continue to the normal route (same as @vercel/functions next())
    return new Response(null, { headers: { 'x-middleware-next': '1' } })
  }
  const shell = await fetch(new URL('/200.html', url))
  return new Response(shell.body, {
    status: 404,
    headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'public, max-age=0, must-revalidate' },
  })
}
