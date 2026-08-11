export function useSubdomain() {
  const hostname = window.location.hostname

  // bare localhost — no subdomain
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null

  // app.scorifygolf.com — the main app, not a league subdomain
  if (hostname === 'app.scorifygolf.com') return null

  // mulligans-island.localhost → 'mulligans-island'
  if (hostname.endsWith('.localhost')) return hostname.replace('.localhost', '')

  // mulligans-island.scorifygolf.com → 'mulligans-island'
  if (hostname.endsWith('.scorifygolf.com')) return hostname.replace('.scorifygolf.com', '')

  return null
}
