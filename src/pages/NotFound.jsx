import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'

// Shown for any URL that doesn't match a route. A single-page app can't return
// a real HTTP 404, so the noindex tag is what keeps search engines from indexing
// these URLs (and treating every made-up path as a duplicate of the homepage).
export default function NotFound() {
  return (
    <>
      <Helmet>
        <title>Page not found — Scorify Golf</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: '#fbfaf8', color: INK }}>
        <img src="/logo.png" alt="Scorify Golf" className="w-14 h-14 object-contain mb-6" />
        <h1 className="text-3xl font-bold mb-2" style={{ letterSpacing: '-0.02em' }}>Page not found</h1>
        <p className="mb-8" style={{ color: '#6b7280' }}>
          The page you're looking for doesn't exist or may have moved.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link to="/" className="text-sm font-bold px-5 py-2 rounded-full text-white hover:opacity-90" style={{ background: GREEN }}>
            Go to the homepage
          </Link>
          <Link to="/blog" className="text-sm font-semibold px-5 py-2 rounded-full" style={{ color: GREEN, border: `1px solid ${GREEN}` }}>
            Read the blog
          </Link>
        </div>
      </div>
    </>
  )
}
