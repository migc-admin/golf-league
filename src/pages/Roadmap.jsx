import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import Footer from '../components/ui/Footer'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'

const PLANNED = [
  'Leaderboard embed for club or society websites',
  'Sponsor logos on print assets, cart signs, and leaderboard carousel',
  'Stripe-powered online payment and registration fees',
  'Text message scoring reminders and event notifications',
  'Multi-day / multi-round trip scoring across courses',
  'Public event website with live leaderboard for spectators',
  'Score export to USGA-compatible handicap systems',
  'Stableford and Ryder Cup format improvements',
]

export default function Roadmap() {
  const [name,    setName]    = useState('')
  const [idea,    setIdea]    = useState('')
  const [sent,    setSent]    = useState(false)
  const [sending, setSending] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!idea.trim()) return
    setSending(true)
    // Send via mailto for now — can be replaced with a Supabase insert or form endpoint
    window.location.href = `mailto:admin@scorifygolf.com?subject=Roadmap%20Idea&body=${encodeURIComponent(`From: ${name || 'Anonymous'}\n\n${idea}`)}`
    setSending(false)
    setSent(true)
  }

  return (
    <>
      <Helmet>
        <title>Roadmap — Scorify Golf | What's coming next</title>
        <meta name="description" content="See what's planned for Scorify Golf and submit your own feature ideas. We build with league directors, not just for them." />
      </Helmet>
      <div className="min-h-screen flex flex-col" style={{ background: '#fbfaf8', color: INK }}>

        {/* Nav */}
        <header className="sticky top-0 z-50 bg-white" style={{ borderBottom: '1px solid #ebe9e4' }}>
          <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
            <Link to="/home" className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Scorify Golf" className="w-8 h-8 object-contain" />
              <span className="font-bold text-base" style={{ letterSpacing: '-0.02em', color: INK }}>Scorify Golf</span>
            </Link>
            <Link to="/login"
              className="text-sm font-bold px-4 py-1.5 rounded-full text-white transition-opacity hover:opacity-90"
              style={{ background: GREEN }}>
              Get started
            </Link>
          </div>
        </header>

        <main className="flex-1 max-w-3xl mx-auto px-6 py-16 w-full">

          {/* Hero */}
          <div className="text-center mb-16">
            <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: GREEN }}>Roadmap</p>
            <h1 className="text-4xl md:text-5xl font-bold mb-4" style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
              What's coming to Scorify
            </h1>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#6b7280' }}>
              We build Scorify with feedback from real league directors. Here's what's planned — and where you can shape what comes next.
            </p>
          </div>

          {/* Planned features */}
          <section className="mb-16">
            <h2 className="text-lg font-bold mb-5" style={{ color: INK }}>On the roadmap</h2>
            <div className="space-y-3">
              {PLANNED.map(item => (
                <div key={item} className="flex items-start gap-3 rounded-xl p-4 bg-white" style={{ border: '1px solid #ebe9e4' }}>
                  <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full border-2 flex items-center justify-center" style={{ borderColor: GREEN }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: GOLD }} />
                  </span>
                  <span className="text-sm" style={{ color: '#374151' }}>{item}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Idea submission */}
          <section className="rounded-2xl p-8" style={{ background: '#ffffff', border: '1px solid #ebe9e4' }}>
            <h2 className="text-xl font-bold mb-1" style={{ color: INK }}>Submit an idea</h2>
            <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
              What would make Scorify work better for your league? We read every submission and prioritize based on what matters most to organizers.
            </p>
            {sent ? (
              <div className="rounded-xl p-5 text-center" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <p className="font-semibold text-green-800">Thanks — we got your idea!</p>
                <p className="text-sm text-green-700 mt-1">We'll follow up if we have questions.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your name (optional)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="First name or handle"
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                    style={{ '--tw-ring-color': GREEN }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your idea <span className="text-red-500">*</span></label>
                  <textarea
                    value={idea}
                    onChange={e => setIdea(e.target.value)}
                    required
                    rows={5}
                    placeholder="Describe the feature or improvement you'd like to see..."
                    className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={sending || !idea.trim()}
                  className="w-full py-3 rounded-full font-bold text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  style={{ background: GREEN }}>
                  {sending ? 'Sending…' : 'Submit idea'}
                </button>
                <p className="text-xs text-center" style={{ color: '#9ca3af' }}>
                  Or email us directly at{' '}
                  <a href="mailto:admin@scorifygolf.com" style={{ color: GREEN }}>admin@scorifygolf.com</a>
                </p>
              </form>
            )}
          </section>

        </main>

        <Footer />
      </div>
    </>
  )
}
