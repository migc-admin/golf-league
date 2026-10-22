// Build-time render entry for prerendering the public marketing pages.
//
// scripts/prerender.mjs calls render(url) for each path in PRERENDER_ROUTES and
// saves the resulting HTML, so search engines and other crawlers that don't run
// JavaScript get the finished page. Only the public pages are rendered here —
// not the app shell, cookie banner, or any logged-in screens — so nothing
// browser-only (localStorage, Supabase sessions) runs at build time.
import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom/server'
import { Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthContext } from './hooks/useAuth'
import { BLOG_POSTS } from './lib/blogPosts'
import Home from './pages/Home'
import FAQ from './pages/FAQ'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Roadmap from './pages/Roadmap'
import Help from './pages/Help'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import RefundPolicy from './pages/RefundPolicy'

export const PRERENDER_ROUTES = [
  '/',
  '/faq',
  '/blog',
  ...BLOG_POSTS.map(p => `/blog/${p.slug}`),
  '/roadmap',
  '/help',
  '/privacy',
  '/terms',
  '/refund-policy',
]

// Logged-out visitor, auth still loading — the same state the browser starts in,
// so the prerendered page matches what a first-time visitor sees.
const LOGGED_OUT = {
  user: null, profile: null, loading: true, profileLoading: false,
  isAdmin: false, isScorekeeper: false, signIn: async () => {}, signOut: async () => {},
}

export function render(url) {
  const helmetContext = {}
  const html = renderToString(
    <HelmetProvider context={helmetContext}>
      <AuthContext.Provider value={LOGGED_OUT}>
        <StaticRouter location={url}>
          <Routes>
            <Route path="/"              element={<Home />} />
            <Route path="/faq"           element={<FAQ />} />
            <Route path="/blog"          element={<Blog />} />
            <Route path="/blog/:slug"    element={<BlogPost />} />
            <Route path="/roadmap"       element={<Roadmap />} />
            <Route path="/help"          element={<Help />} />
            <Route path="/privacy"       element={<Privacy />} />
            <Route path="/terms"         element={<Terms />} />
            <Route path="/refund-policy" element={<RefundPolicy />} />
          </Routes>
        </StaticRouter>
      </AuthContext.Provider>
    </HelmetProvider>
  )
  const h = helmetContext.helmet
  const head = h ? [h.title, h.meta, h.link, h.script].map(x => x.toString()).join('\n') : ''
  return { html, head }
}
