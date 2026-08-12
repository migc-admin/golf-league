const EXCLUDED = [
  'localhost',
  '127.0.0.1',
  'scorifygolf.com',
  'www.scorifygolf.com',
  'app.scorifygolf.com',
  'golf-league-omega.vercel.app',
]

export function useSubdomain() {
  const hostname = window.location.hostname

  if (EXCLUDED.includes(hostname)) return null

  // mulligans-island.localhost → 'mulligans-island'
  if (hostname.endsWith('.localhost')) return hostname.replace('.localhost', '')

  // mulligans-island.scorifygolf.com → 'mulligans-island'
  if (hostname.endsWith('.scorifygolf.com')) return hostname.replace('.scorifygolf.com', '')

  return null
}
