import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'
import { BLOG_POSTS } from '../lib/blogPosts'
import SiteHeader from '../components/ui/SiteHeader'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

const SORTED_POSTS = [...BLOG_POSTS].sort((a, b) => new Date(b.date) - new Date(a.date))

export default function Blog() {
  return (
    <>
      <Helmet>
        <title>Blog — Scorify Golf | Golf League Best Practices</title>
        <meta name="description" content="Tips and best practices for running golf leagues, tournaments, side games, scoring, and handicaps." />
        <meta property="og:title" content="Blog — Scorify Golf" />
        <meta property="og:description" content="Tips and best practices for running golf leagues, tournaments, side games, scoring, and handicaps." />
        <link rel="canonical" href="https://www.scorifygolf.com/blog" />
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

        <SiteHeader />

        <main className="flex-1">

          {/* Hero */}
          <section className="py-16 text-center px-6" style={{ background: `linear-gradient(150deg, #0b2318 0%, ${GREEN} 55%, #1f5c3e 100%)` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>Blog</p>
            <h1 className="text-3xl md:text-5xl font-bold text-white mb-4" style={{ fontFamily: "'Manrope', sans-serif" }}>
              Golf League Best Practices
            </h1>
            <p className="text-base max-w-xl mx-auto" style={{ color: 'rgba(255,255,255,0.65)' }}>
              Tips on running tournaments, events, scoring, and side games — from the team building Scorify.
            </p>
            <div className="mx-auto mt-5" style={{ width: 48, height: 2, background: GOLD }} />
          </section>

          {/* Post list */}
          <section className="py-16 px-6">
            <div className="max-w-3xl mx-auto space-y-6">
              {SORTED_POSTS.map(post => (
                <Link
                  key={post.slug}
                  to={`/blog/${post.slug}`}
                  className="block bg-white rounded-2xl p-6 shadow-sm transition-shadow hover:shadow-md"
                  style={{ border: '1px solid #ebe9e4' }}
                >
                  <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GREEN }}>
                    {post.category} · {formatDate(post.date)}
                  </p>
                  <h2 className="text-xl font-bold mb-2" style={{ color: INK }}>{post.title}</h2>
                  <p className="text-sm leading-relaxed" style={{ color: '#6b7280' }}>{post.excerpt}</p>
                  <p className="text-sm font-bold mt-3" style={{ color: GREEN }}>Read more →</p>
                </Link>
              ))}
            </div>
          </section>

        </main>

        <Footer />
      </div>
    </>
  )
}
