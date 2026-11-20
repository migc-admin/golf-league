import { Link, useParams, Navigate } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'
import { getBlogPost, getRelatedPosts } from '../lib/blogPosts'
import { parseInlineLinks } from '../lib/inlineLinks'
import ComparisonTable from '../components/blog/ComparisonTable'
import LeaderboardPreview from '../components/blog/LeaderboardPreview'
import PrintAssetGallery from '../components/blog/PrintAssetGallery'
import LiveScoringGallery from '../components/blog/LiveScoringGallery'
import SiteHeader from '../components/ui/SiteHeader'

const GREEN = '#1B4332'
const INK   = '#1d1d1f'

function formatDate(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

// Renders a content string, turning [text](/path) into links.
function RichText({ text }) {
  return parseInlineLinks(text).map((seg, i) => {
    if (!seg.href) return seg.text
    if (seg.href.startsWith('/')) {
      return <Link key={i} to={seg.href} className="font-semibold underline underline-offset-2" style={{ color: GREEN }}>{seg.text}</Link>
    }
    return <a key={i} href={seg.href} target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2" style={{ color: GREEN }}>{seg.text}</a>
  })
}

function Block({ block }) {
  if (block.type === 'h2') {
    return <h2 className="text-xl font-bold mt-8 mb-3" style={{ color: INK }}>{block.text}</h2>
  }
  if (block.type === 'h3') {
    return <h3 className="text-base font-bold mt-6 mb-2" style={{ color: INK }}>{block.text}</h3>
  }
  if (block.type === 'pLink') {
    return (
      <p className="text-sm leading-relaxed mb-4" style={{ color: '#374151' }}>
        <RichText text={block.text} />{' '}
        <Link to={block.href} className="font-semibold" style={{ color: GREEN }}>{block.linkText}</Link>
        {block.after ?? ''}
      </p>
    )
  }
  if (block.type === 'ul') {
    return (
      <ul className="list-disc pl-5 space-y-1 text-sm leading-relaxed" style={{ color: '#374151' }}>
        {block.items.map((item, i) => <li key={i}><RichText text={item} /></li>)}
      </ul>
    )
  }
  if (block.type === 'table') {
    return <ComparisonTable headers={block.headers} rows={block.rows} />
  }
  if (block.type === 'leaderboard') {
    return <LeaderboardPreview title={block.title} rows={block.rows} />
  }
  if (block.type === 'printAssets') {
    return <PrintAssetGallery />
  }
  if (block.type === 'liveScoring') {
    return <LiveScoringGallery />
  }
  if (block.type === 'image') {
    return (
      <figure className="my-6">
        <img
          src={block.src}
          alt={block.alt}
          className="w-full rounded-xl shadow-sm"
          style={{ border: '1px solid #ebe9e4' }}
          loading="lazy"
        />
      </figure>
    )
  }
  return <p className="text-sm leading-relaxed mb-4" style={{ color: '#374151' }}><RichText text={block.text} /></p>
}

export default function BlogPost() {
  const { slug } = useParams()
  const post = getBlogPost(slug)

  if (!post) return <Navigate to="/blog" replace />

  const related = getRelatedPosts(post, 3)
  const description = post.metaDescription ?? post.excerpt

  return (
    <>
      <Helmet>
        <title>{post.seoTitle ?? `${post.title} — Scorify Golf Blog`}</title>
        <meta name="description" content={description} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={description} />
        <link rel="canonical" href={`https://www.scorifygolf.com/blog/${post.slug}`} />
        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "headline": post.title,
          "description": description,
          "datePublished": post.date,
          "author": {
            "@type": "Person",
            "name": "Kevin Vargas",
            "jobTitle": "Founder, Scorify Golf",
            "description": "Built Scorify Golf to run his own golf league's live scoring and season standings, then opened it up to other independent league directors.",
          },
          "publisher": { "@type": "Organization", "name": "Scorify Golf" },
        })}</script>
      </Helmet>

      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

        <SiteHeader />

        <main className="flex-1">
          <article className="max-w-3xl mx-auto px-6 py-14">
            <Link to="/blog" className="text-sm font-semibold" style={{ color: GREEN }}>← Back to Blog</Link>

            <p className="text-xs font-bold uppercase tracking-widest mt-6 mb-3" style={{ color: GREEN }}>
              {post.category} · {formatDate(post.date)}
            </p>
            <h1 className="text-3xl md:text-4xl font-bold mb-6" style={{ letterSpacing: '-0.02em', color: INK }}>
              {post.title}
            </h1>
            <p className="text-sm mb-8" style={{ color: '#6b7280' }}>
              By <span className="font-semibold" style={{ color: INK }}>Kevin Vargas</span>, Founder of Scorify Golf
            </p>

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
