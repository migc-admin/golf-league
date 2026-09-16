import { Link, useParams, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'
import { getBlogPost, BLOG_POSTS } from '../lib/blogPosts'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function Block({ block }) {
  if (block.type === 'h2') {
    return <h2 className="text-xl font-bold mt-8 mb-3" style={{ color: INK }}>{block.text}</h2>
  }
  if (block.type === 'ul') {
    return (
      <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed" style={{ color: '#374151' }}>
        {block.items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    )
  }
  return <p className="text-sm leading-relaxed mb-4" style={{ color: '#374151' }}>{block.text}</p>
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = getBlogPost(slug)

  if (!post) return <Navigate to="/blog" replace />

  const related = BLOG_POSTS.filter(p => p.slug !== post.slug).slice(0, 2)

  return (
    <>
      <Helmet>
        <title>{post.title} — Scorify Golf Blog</title>
        <meta name="description" content={post.excerpt} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.excerpt} />
        <link rel="canonical" href={`https://www.scorifygolf.com/blog/${post.slug}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": post.title,
          "description": post.excerpt,
          "datePublished": post.date,
          "author": { "@type": "Organization", "name": "Scorify Golf" },
        })}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

        {/* Header */}
        <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #ebe9e4' }}>
          <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Scorify Golf" className="w-8 h-8 object-contain" />
              <span className="font-bold text-base" style={{ letterSpacing: '-0.02em', color: INK }}>Scorify Golf</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link to="/blog" className="text-sm font-medium" style={{ color: '#6b7280' }}>Blog</Link>
              <Link
                to="/login"
                className="text-sm font-bold px-4 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                Get started
              </Link>
            </div>
          </div>
        </header>

        <main className="flex-1">
          <article className="max-w-2xl mx-auto px-6 py-14">
            <Link to="/blog" className="text-sm font-semibold" style={{ color: GREEN }}>← Back to Blog</Link>

            <p className="text-xs font-bold uppercase tracking-widest mt-6 mb-3" style={{ color: GREEN }}>
              {post.category} · {formatDate(post.date)}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mb-8" style={{ letterSpacing: '-0.02em', color: INK }}>
              {post.title}
            </h1>

            {post.content.map((block, i) => <Block key={i} block={block} />)}

            {related.length > 0 && (
              <div className="mt-14 pt-8" style={{ borderTop: '1px solid #ebe9e4' }}>
                <p className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#9ca3af' }}>Keep reading</p>
                <div className="space-y-4">
                  {related.map(p => (
                    <Link key={p.slug} to={`/blog/${p.slug}`} className="block">
                      <p className="text-base font-bold" style={{ color: GREEN }}>{p.title}</p>
                      <p className="text-sm" style={{ color: '#6b7280' }}>{p.excerpt}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        </main>

        <Footer />
      </div>
    </>
  )
}
