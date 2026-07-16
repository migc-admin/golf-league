/**
 * Public Event Registration Page
 * URL: /register/:eventId
 *
 * Flow:
 *  1. Load event details (name, date, course, entry fee, venmo_handle)
 *  2. Player fills out form (name, email, handicap index, flight preference, notes)
 *  3. On submit → insert into registrations table with status 'pending'
 *  4. Show Venmo deeplink button pre-filled with amount + player name
 *  5. Remind player that registration is confirmed once admin verifies payment
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'

const GOLD = '#D4AF37'

function isMobile() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

function VenmoButton({ handle, amount, note }) {
  const encoded = encodeURIComponent(note)
  const webUrl  = `https://venmo.com/${handle}?txn=pay&amount=${amount}&note=${encoded}`
  const appUrl  = `venmo://paycharge?txn=pay&recipients=${handle}&amount=${amount}&note=${encoded}`

  function handleClick(e) {
    if (!isMobile()) return // let the <a> href handle desktop naturally

    e.preventDefault()

    // Attempt to open the app; fall back to web after 1.5s if app isn't installed
    const fallbackTimer = setTimeout(() => {
      window.location.href = webUrl
    }, 1500)

    window.location.href = appUrl

    // If the app opened, the page will blur — cancel the fallback
    window.addEventListener('blur', () => clearTimeout(fallbackTimer), { once: true })
  }

  return (
    <>
      <a
        href={webUrl}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleClick}
        className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-opacity hover:opacity-90"
        style={{ background: '#008CFF' }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.5 2C20.6 4.3 21 6.2 21 8.6c0 6.7-5.7 15.4-10.3 15.4-4.4 0-5.2-3.8-7.7-9.3l3.4-1.2c.8 2.1 1.6 4.4 2.9 4.4 1.5 0 3.9-5 3.9-8.3 0-2.4-.8-3.5-2-3.5-1.1 0-2.1.7-2.8 1.7L5.8 5.5C7.4 3 9.5 2 12 2c2.5 0 5.3 1.2 7.5 0z"/>
        </svg>
        Pay ${amount} via Venmo
      </a>
      <p className="text-xs text-gray-400 text-center -mt-1">
        Please confirm the amount is <strong>${amount}</strong> before sending.
      </p>
    </>
  )
}

function PayPalButton({ link, amount, note }) {
  const url = new URL(link)
  // Append amount to paypal.me links if not already present
  if (!url.pathname.match(/\/\d+$/)) url.pathname += `/${amount}`
  return (
    <a href={url.toString()} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-center gap-3 w-full py-3.5 rounded-xl font-bold text-white shadow-lg transition-opacity hover:opacity-90"
      style={{ background: '#003087' }}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-8.558 6.082H9.825l-1.153 7.301h3.309c.458 0 .845-.333.917-.786l.038-.198.726-4.6.047-.254a.928.928 0 0 1 .917-.786h.578c3.741 0 6.671-1.52 7.526-5.914.36-1.845.174-3.386-.608-4.558z"/>
      </svg>
      Pay ${amount} via PayPal
    </a>
  )
}

export default function Register() {
  const { eventId } = useParams()

  const [event,     setEvent]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  // Form fields
  const [firstName,     setFirstName]     = useState('')
  const [lastName,      setLastName]      = useState('')
  const [email,         setEmail]         = useState('')
  const [notes,         setNotes]         = useState('')
  const [interestedGuest, setInterestedGuest] = useState('')

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, event_number, event_date, entry_fee, tournament_fee, status, venmo_handle, paypal_link, course:courses(name), league:leagues(name), use_flights')
      .eq('id', eventId)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setError('Event not found.')
        else setEvent(data)
        setLoading(false)
      })
  }, [eventId])

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const fullNotes = [
      notes.trim(),
      interestedGuest ? `Interested in guest spot: ${interestedGuest}` : '',
    ].filter(Boolean).join(' | ')

    const { error: insErr } = await supabase.from('registrations').insert({
      event_id:   eventId,
      first_name: firstName.trim(),
      last_name:  lastName.trim(),
      email:      email.trim() || null,
      notes:      fullNotes || null,
      status:     'pending',
    })

    setSaving(false)
    if (insErr) {
      setError('Something went wrong. Please try again.')
      return
    }
    setSubmitted(true)
  }

  const eventLabel = event?.name ?? (event ? `Event #${event.event_number}` : '…')
  const eventDate  = event?.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''

  const regTitle = event
    ? `Register for ${eventLabel} — ${event.league?.name ?? ''} | Scorify Golf`
    : 'Event Registration | Scorify Golf'

  return (
    <>
    <Helmet>
      <title>{regTitle}</title>
      <meta name="description" content={event ? `Register for ${eventLabel} on ${eventDate}${event.course?.name ? ` at ${event.course.name}` : ''}. Powered by Scorify Golf.` : 'Golf event registration powered by Scorify Golf.'} />
      <meta name="robots" content="noindex" />
    </Helmet>
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Golf League Logo"
            className="w-20 h-20 rounded-full object-cover mx-auto mb-3 shadow-xl" />
          <h1 className="text-white font-bold text-2xl" style={{ fontFamily: "'Playfair Display', serif" }}>
            Event Registration
          </h1>
          {event && (
            <>
              <p className="text-white/80 font-semibold mt-1">{eventLabel}</p>
              <p className="text-white/50 text-sm">{event.course?.name} · {eventDate}</p>
            </>
          )}
          <div className="mx-auto mt-3" style={{ width: 40, height: 2, background: GOLD }} />
        </div>

        {loading && (
          <div className="text-center text-white/60">Loading…</div>
        )}

        {!loading && error && !submitted && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-red-600 font-medium">{error}</p>
            <Link to="/" className="text-sm text-gray-500 mt-3 block hover:underline">Go home</Link>
          </div>
        )}

        {!loading && event && event.status === 'complete' && !submitted && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-gray-700 font-medium">Registration for this event is closed.</p>
          </div>
        )}

        {/* Registration form */}
        {!loading && event && event.status !== 'complete' && !submitted && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-4">
            <div>
              {event.tournament_fee > 0 && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm mb-2">
                  <div className="flex justify-between font-bold text-gray-900"><span>Event Fee</span><span>${Number(event.tournament_fee).toFixed(2)}</span></div>
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">First Name *</label>
                  <input
                    required
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    placeholder="Kevin"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Last Name *</label>
                  <input
                    required
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    placeholder="Vargas"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  placeholder="optional"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Interested in inviting a guest? <span className="font-normal text-gray-400">(based on availability)</span></label>
                <select
                  value={interestedGuest}
                  onChange={e => setInterestedGuest(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                >
                  <option value="">— Select —</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
                  placeholder="Any special requests or questions…"
                />
              </div>

              {error && <p className="text-red-500 text-xs text-center">{error}</p>}

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl font-bold text-white text-sm transition-opacity disabled:opacity-60"
                style={{ background: '#1B4332' }}
              >
                {saving ? 'Submitting…' : 'Submit Registration'}
              </button>
            </form>
          </div>
        )}

        {/* Success + Venmo */}
        {submitted && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5 text-center">
            <div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3"
                style={{ background: '#d1fae5' }}>
                <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">You're registered!</h2>
              <p className="text-sm text-gray-500 mt-1">
                {(event.venmo_handle || event.paypal_link)
                  ? <>{firstName}, your spot is <span className="font-semibold text-amber-600">pending payment</span>. Complete your payment below to confirm your registration.</>
                  : <>{firstName}, your spot is <span className="font-semibold text-amber-600">pending payment</span>. Follow payment instructions provided by your administrator.</>
                }
              </p>
            </div>

            {(event.venmo_handle || event.paypal_link) && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Complete your payment</p>
                {event.venmo_handle && (
                  <VenmoButton
                    handle={event.venmo_handle}
                    amount={Number(event.tournament_fee || event.entry_fee || 0).toFixed(2)}
                    note={`${eventLabel} – ${firstName} ${lastName}`}
                  />
                )}
                {event.paypal_link && (
                  <PayPalButton
                    link={event.paypal_link}
                    amount={Number(event.tournament_fee || event.entry_fee || 0).toFixed(2)}
                    note={`${eventLabel} – ${firstName} ${lastName}`}
                  />
                )}
                <p className="text-xs text-gray-400">
                  Your registration will be confirmed once payment is received.
                  You'll hear from the organizer shortly.
                </p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    </>
  )
}
