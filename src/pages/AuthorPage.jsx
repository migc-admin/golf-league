// Author page (/author/kevin-vargas): who writes the Scorify Golf guides, his
// league experience, and every post he has written. Prerendered — see entry-server.jsx.
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'
import SiteHeader from '../components/ui/SiteHeader'
import { AUTHOR, AUTHOR_URL, SITE, authorPerson, authorPosts } from '../lib/author'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export default function AuthorPage() {
  const posts = authorPosts()
  const description = `${AUTHOR.name}, ${AUTHOR.jobTitle}. Helps run a 40-player monthly golf league and writes Scorify Golf's guides for league directors.`

  return (
    <>
      <Helmet>
        <title>{`${AUTHOR.name} — Founder, Scorify Golf`}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={`${AUTHOR.name} — Scorify Golf`} />
        <meta property="og:description" content={description} />
        <meta property="og:type" content="profile" />
        <link rel="canonical" href={AUTHOR_URL} />
        <script type="application/ld+json">{JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'ProfilePage',
          url: AUTHOR_URL,
          mainEntity: authorPerson(),
          hasPart: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: `${SITE}/blog/${p.slug}`, datePublished: p.date })),
        })}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>
        <SiteHeader />

        <main className="flex-1">
          <section className="py-16 px-6" style={{ background: `linear-gradient(150deg, #0b2318 0%, ${GREEN} 55%, #1f5c3e 100%)` }}>
            <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-6">
              {AUTHOR.photo && (
                <img src={AUTHOR.photo} alt={AUTHOR.name} width="112" height="112" className="h-28 w-28 rounded-full object-cover shrink-0" />
              )}
              <div>
                <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GOLD }}>Author</p>
                <h1 className="text-3xl md:text-5xl font-bold text-white" style={{ fontFamily: "'Manrope', sans-serif" }}>{AUTHOR.name}</h1>
                <p className="mt-2 text-base" style={{ color: 'rgba(255,255,255,0.75)' }}>{AUTHOR.jobTitle}</p>
              </div>
            </div>
          </section>

          <section className="py-14 px-6">
            <div className="max-w-3xl mx-auto">
              <h2 className="text-xl font-bold mb-4" style={{ color: INK }}>About Kevin</h2>
              {AUTHOR.bio.map(p => (
                <p key={p.slice(0, 24)} className="text-base leading-relaxed mb-4" style={{ color: '#374151' }}>{p}</p>
              ))}
              {AUTHOR.sameAs.length > 0 && (
                <p className="text-sm mb-4" style={{ color: '#374151' }}>
                  Find Kevin on{' '}
                  {AUTHOR.sameAs.map((u, i) => (
                    <span key={u}>{i > 0 ? ', ' : ''}<a href={u} target="_blank" rel="noopener noreferrer me" className="font-semibold underline" style={{ color: GREEN }}>{new URL(u).hostname.replace('www.', '')}</a></span>
                  ))}.
                </p>
              )}
              <p className="text-sm" style={{ color: '#374151' }}>
                Questions about running your league? Email{' '}
                <a href="mailto:admin@scorifygolf.com" className="font-semibold" style={{ color: GREEN }}>admin@scorifygolf.com</a>.
              </p>

              <h2 className="text-xl font-bold mt-12 mb-5" style={{ color: INK }}>Guides by Kevin ({posts.length})</h2>
              <div className="space-y-4">
                {posts.map(p => (
                  <Link key={p.slug} to={`/blog/${p.slug}`}
                    className="block bg-white rounded-2xl p-5 transition-shadow hover:shadow-md"
                    style={{ border: '1px solid #ebe9e4' }}>
                    <p className="text-xs font-bold uppercase tracking-widest mb-1.5" style={{ color: GREEN }}>{p.category} · {formatDate(p.date)}</p>
                    <h3 className="text-base font-bold" style={{ color: INK }}>{p.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: '#6b7280' }}>{p.excerpt}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        </main>

        <Footer />
      </div>
    </>
  )
}
