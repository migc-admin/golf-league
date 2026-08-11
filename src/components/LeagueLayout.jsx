import { Link } from 'react-router-dom'

const GREEN = '#1B4332'

/**
 * Public layout wrapper for league subdomain pages.
 * Props:
 *   org     — { name, slug, logo_url, tier }
 *   leagues — [{ id, name, slug }]
 *   children
 */
export default function LeagueLayout({ org, leagues = [], children }) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header style={{ backgroundColor: GREEN }} className="text-white shadow-md">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-3">
            <img
              src={org?.logo_url || '/logo.png'}
              alt={org?.name || 'League'}
              className="h-10 w-10 rounded-full object-cover bg-white"
              onError={(e) => { e.target.src = '/logo.png' }}
            />
            <span className="text-xl font-bold tracking-tight">
              {org?.name || 'League'}
            </span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-5 text-sm font-medium">
            <Link to="/" className="hover:text-yellow-300 transition-colors">
              Home
            </Link>
            {leagues.map((lg) => (
              <Link
                key={lg.id}
                to={`/${lg.slug}`}
                className="hover:text-yellow-300 transition-colors"
              >
                {lg.name}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white text-center py-4 text-sm text-gray-500">
        Powered by{' '}
        <a
          href="https://scorifygolf.com"
          target="_blank"
          rel="noreferrer"
          className="font-semibold hover:underline"
          style={{ color: GREEN }}
        >
          Scorify Golf
        </a>
      </footer>
    </div>
  )
}
