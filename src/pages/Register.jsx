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

import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import LeagueMark from '../components/ui/LeagueMark'
import ScheduleCard from '../components/event-page/ScheduleCard'
import Button from '../components/ui/Button'
import { scheduleEntries, time12 } from '../lib/eventPageView'
import { cityOf, feeText, firstTeeTime, missingMessage } from '../lib/registerView'

const GOLD = '#C9A84C' // same gold the league initials mark uses
const PAY_BTN = 'flex min-h-[52px] w-full items-center justify-center gap-3 rounded-sm px-4 text-[15px] font-bold text-white no-underline transition-opacity hover:opacity-90'
const HINT = 'text-center text-xs text-ink-muted'

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
        className={PAY_BTN}
        style={{ background: '#008CFF' }}
      >
        <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.5 2C20.6 4.3 21 6.2 21 8.6c0 6.7-5.7 15.4-10.3 15.4-4.4 0-5.2-3.8-7.7-9.3l3.4-1.2c.8 2.1 1.6 4.4 2.9 4.4 1.5 0 3.9-5 3.9-8.3 0-2.4-.8-3.5-2-3.5-1.1 0-2.1.7-2.8 1.7L5.8 5.5C7.4 3 9.5 2 12 2c2.5 0 5.3 1.2 7.5 0z"/>
        </svg>
        Pay with Venmo · {feeText(amount)}
      </a>
      <p className={HINT}>
        Please confirm the amount is <strong>{feeText(amount)}</strong> before sending.
      </p>
    </>
  )
}

function ZelleButton({ handle, amount, note }) {
  const isPhone = /^\+?[\d\s\-().]{7,}$/.test(handle)
  // Zelle deeplink only works on mobile in the Zelle or bank app
  const appUrl  = `zelle://payment?amount=${amount}&message=${encodeURIComponent(note)}&recipient=${encodeURIComponent(handle)}`
  const webUrl  = 'https://enroll.zellepay.com/get-started'

  function handleClick(e) {
    if (!isMobile()) return
    e.preventDefault()
    const fallbackTimer = setTimeout(() => { window.location.href = webUrl }, 1500)
    window.location.href = appUrl
    window.addEventListener('blur', () => clearTimeout(fallbackTimer), { once: true })
  }

  return (
    <>
      <a
        href={isMobile() ? appUrl : webUrl}
        target={isMobile() ? '_self' : '_blank'}
        rel="noopener noreferrer"
        onClick={handleClick}
        className={PAY_BTN}
        style={{ background: '#6D1ED4' }}
      >
        <svg viewBox="0 0 48 48" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
          <path d="M24 4C12.95 4 4 12.95 4 24s8.95 20 20 20 20-8.95 20-20S35.05 4 24 4zm8 14H20.83l8.58-6H32v6zm-16 12h11.17l-8.58 6H16v-6zm16-6H16v-4h16v4z"/>
        </svg>
        Pay with Zelle · {feeText(amount)}
      </a>
      <p className={HINT}>
        Send to <strong>{handle}</strong> — confirm amount is <strong>{feeText(amount)}</strong>.
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
      className={PAY_BTN}
      style={{ background: '#003087' }}
    >
      <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white" xmlns="http://www.w3.org/2000/svg">
        <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 0 0-.607-.541c-.013.076-.026.175-.041.254-.59 3.025-2.566 6.082-8.558 6.082H9.825l-1.153 7.301h3.309c.458 0 .845-.333.917-.786l.038-.198.726-4.6.047-.254a.928.928 0 0 1 .917-.786h.578c3.741 0 6.671-1.52 7.526-5.914.36-1.845.174-3.386-.608-4.558z"/>
      </svg>
      Pay with PayPal · {feeText(amount)}
    </a>
  )
}

const INPUT = 'block w-full rounded-[10px] border bg-white px-3.5 text-base text-ink placeholder:text-ink-muted/70 focus:outline-none focus:ring-2 focus:ring-fairway-500'
const inputTone = bad => (bad ? 'border-red-600' : 'border-surface-highest')

/** One labelled field. `error` shows the red "Required" line and wires aria-invalid / aria-describedby. */
function Field({ id, label, optional, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-ink">
        {label}{optional && <span className="font-normal text-ink-muted"> (optional)</span>}
      </label>
      {children}
      {error && <p id={`${id}-error`} className="mt-1.5 text-sm font-semibold text-red-600">{error}</p>}
    </div>
  )
}

function Shell({ children }) {
  return <div className="min-h-screen bg-surface-dim font-sans text-ink">{children}</div>
}

export default function Register() {
  const { leagueSlug, eventSlug } = useParams()

  const [event,     setEvent]     = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState(null)

  // Form fields
  const [firstName,      setFirstName]      = useState('')
  const [lastName,       setLastName]       = useState('')
  const [notes,          setNotes]          = useState('')
  const [customAnswers,  setCustomAnswers]  = useState(['', ''])
  const [missing,        setMissing]        = useState(null) // { ids: Set, message } after a submit with gaps
  const formRef = useRef(null)

  useEffect(() => {
    supabase
      .from('events')
      .select('id, name, slug, event_number, event_date, entry_fee, tournament_fee, status, venmo_handle, paypal_link, zelle_handle, custom_questions, schedule_items, course:courses(name, address), league:leagues(name, slug, logo_url, org:organizations(logo_url, slug)), use_flights')
      .eq('slug', eventSlug)
      .eq('league.slug', leagueSlug)
      .single()
      .then(({ data, error }) => {
        if (error || !data) setError('Event not found.')
        else setEvent(data)
        setLoading(false)
      })
  }, [leagueSlug, eventSlug])

  const questions = (event?.custom_questions ?? []).map((q, i) => ({ ...q, i, id: `reg-q-${i}` })).filter(q => q.label?.trim())

  // Same required rules as before (first name, last name, required questions), shown inline instead of
  // the browser's tooltip. Whitespace-only counts as empty.
  function validate() {
    const ids = new Set()
    const names = []
    if (!firstName.trim()) { ids.add('reg-first'); names.push('first name') }
    if (!lastName.trim())  { ids.add('reg-last');  names.push('last name') }
    const qMissing = questions.filter(q => q.required && !customAnswers[q.i]?.trim())
    qMissing.forEach(q => ids.add(q.id))
    if (ids.size === 0) return null
    return { ids, message: missingMessage({ names, questions: qMissing.map(q => q.label.trim()) }) }
  }

  function clearGap(id) {
    setMissing(m => {
      if (!m?.ids.has(id)) return m
      const ids = new Set(m.ids); ids.delete(id)
      return ids.size ? { ...m, ids } : null
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const gaps = validate()
    if (gaps) {
      setMissing(gaps)
      setError(null)
      // Focus the first missing field, in page order.
      const first = [...formRef.current.querySelectorAll('[data-reg-field]')].find(el => gaps.ids.has(el.id))
      first?.focus()
      return
    }
    setMissing(null)
    setSaving(true)
    setError(null)

    const qNotes = (event.custom_questions ?? [])
      .map((q, i) => customAnswers[i]?.trim() ? `${q.label}: ${customAnswers[i].trim()}` : null)
      .filter(Boolean)
      .join(' | ')

    const fullNotes = [notes.trim(), qNotes].filter(Boolean).join(' | ')

    const { error: insErr } = await supabase.from('registrations').insert({
      event_id:   event.id,
      first_name: firstName.trim(),
      last_name:  lastName.trim(),
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

  const isClosed   = event?.status === 'complete'
  const fee        = Number(event?.tournament_fee) > 0 ? Number(event.tournament_fee) : 0
  const payAmount  = Number(event?.tournament_fee || event?.entry_fee || 0).toFixed(2)
  const hasPayment = !!(event?.venmo_handle || event?.paypal_link || event?.zelle_handle)
  const orgSlug    = event?.league?.org?.slug
  const eventHref  = orgSlug ? `/${orgSlug}/${leagueSlug}/${eventSlug}/event` : null
  const city       = cityOf(event?.course?.address)
  const schedule   = event ? scheduleEntries(event, null) : null
  const payNote    = `${eventLabel} – ${firstName} ${lastName}`
  const gapMsg     = missing?.message ?? error
  const has        = id => !!missing?.ids.has(id)
  const aria       = id => ({ 'data-reg-field': true, 'aria-invalid': has(id) || undefined, 'aria-describedby': has(id) ? `${id}-error` : undefined })

  return (
    <>
    <Helmet>
      <title>{regTitle}</title>
      <meta name="description" content={event ? `Register for ${eventLabel} on ${eventDate}${event.course?.name ? ` at ${event.course.name}` : ''}. Powered by Scorify Golf.` : 'Golf event registration powered by Scorify Golf.'} />
      <meta name="robots" content="noindex" />
    </Helmet>
    <Shell>
      {/* Header band */}
      {event && (
        <header className="border-b border-surface-border bg-white px-4 pb-6 pt-6 text-center">
          <div className="mx-auto flex max-w-[480px] flex-col items-center">
            <LeagueMark name={event.league?.name} logoUrl={event.league?.logo_url} size={72} />
            <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{event.league?.name}</p>
            <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isClosed ? 'bg-surface-high text-ink-muted' : 'bg-status-upcoming-bg text-status-upcoming-text'}`}>
              {!isClosed && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
              {isClosed ? 'Registration closed' : 'Registration open'}
            </span>
            <h1 className="mt-3 text-[clamp(28px,8vw,36px)] font-extrabold leading-[1.1] text-ink" style={{ letterSpacing: '-0.03em' }}>{eventLabel}</h1>
            <div className="mt-3 h-1 w-11 rounded-full" style={{ background: GOLD }} aria-hidden="true" />
            {eventDate && <p className="mt-3 text-[15px] font-bold text-ink">{eventDate}</p>}
            {event.course?.name && <p className="text-[15px] text-ink-muted">{event.course.name}{city ? ` · ${city}` : ''}</p>}
          </div>
        </header>
      )}

      <main className="mx-auto w-full max-w-[480px] space-y-4 px-4 py-4">
        {loading && <p className="py-16 text-center text-ink-muted">Loading…</p>}

        {!loading && error && !event && (
          <div className="rounded-sm border border-surface-border bg-white p-6 text-center">
            <p className="font-semibold text-red-600">{error}</p>
            <Link to="/" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-fairway-700 underline">Go home</Link>
          </div>
        )}

        {!loading && event && isClosed && !submitted && (
          <div className="rounded-sm border border-surface-border bg-white p-6 text-center">
            <p className="font-semibold text-ink">Registration for this event is closed.</p>
          </div>
        )}

        {/* Schedule (same timeline card as the public event page; hidden with no entries) */}
        {!loading && event && !submitted && <ScheduleCard entries={schedule} />}

        {/* Registration form */}
        {!loading && event && !isClosed && !submitted && (
          <section className="rounded-sm border border-surface-border bg-white p-4 sm:p-5">
            {fee > 0 && (
              <div className="mb-5 flex items-center justify-between gap-3 rounded-sm border border-fairway-200 bg-status-active-bg px-4 py-3.5">
                <div>
                  <p className="text-lg font-extrabold leading-tight text-fairway-800">Register</p>
                  <p className="text-sm text-status-active-text">Entry fee per player</p>
                </div>
                <p className="text-[28px] font-extrabold tabular-nums leading-none text-fairway-800">${fee.toFixed(2)}</p>
              </div>
            )}

            <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-5">
              {gapMsg && (
                <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {gapMsg}
                </div>
              )}

              <div className="grid grid-cols-1 gap-x-3 gap-y-5 min-[340px]:grid-cols-2">
                <Field id="reg-first" label="First name" error={has('reg-first') && 'Required'}>
                  <input
                    id="reg-first" name="given-name" autoComplete="given-name" value={firstName}
                    onChange={e => { setFirstName(e.target.value); clearGap('reg-first') }}
                    className={`${INPUT} min-h-[48px] ${inputTone(has('reg-first'))}`} {...aria('reg-first')}
                  />
                </Field>
                <Field id="reg-last" label="Last name" error={has('reg-last') && 'Required'}>
                  <input
                    id="reg-last" name="family-name" autoComplete="family-name" value={lastName}
                    onChange={e => { setLastName(e.target.value); clearGap('reg-last') }}
                    className={`${INPUT} min-h-[48px] ${inputTone(has('reg-last'))}`} {...aria('reg-last')}
                  />
                </Field>
              </div>

              {/* Questions the organizer set up for this event (e.g. bringing a guest) */}
              {questions.map(q => (
                <Field key={q.id} id={q.id} label={q.label.trim()} optional={!q.required} error={has(q.id) && 'Required'}>
                  <textarea
                    id={q.id} rows={3} value={customAnswers[q.i] ?? ''}
                    onChange={e => { setCustomAnswers(prev => { const next = [...prev]; next[q.i] = e.target.value; return next }); clearGap(q.id) }}
                    className={`${INPUT} min-h-[96px] resize-none py-3 ${inputTone(has(q.id))}`} placeholder="Your answer" {...aria(q.id)}
                  />
                </Field>
              ))}

              <Field id="reg-notes" label="Notes" optional>
                <textarea
                  id="reg-notes" rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                  className={`${INPUT} min-h-[96px] resize-none py-3 border-surface-highest`} placeholder="Special requests or questions"
                />
              </Field>

              <div>
                <Button type="submit" size="lg" loading={saving} className="w-full !min-h-[52px] text-base">
                  {saving ? 'Submitting…' : fee > 0 ? `Register · ${feeText(fee)}` : 'Register'}
                </Button>
                {fee > 0 && (
                  <p className={`${HINT} mt-2.5`}>
                    {hasPayment ? "You'll get payment instructions on the next screen." : 'Your organizer will share payment instructions.'}
                  </p>
                )}
              </div>
            </form>
          </section>
        )}

        {/* Confirmation */}
        {submitted && event && (
          <section className="space-y-5 rounded-sm border border-surface-border bg-white p-5 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-fairway-700 text-white" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              </div>
              <h2 className="text-2xl font-extrabold text-ink" style={{ letterSpacing: '-0.02em' }}>You're registered, {firstName.trim()}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {[event.course?.name, eventDate, firstTeeTime(event.schedule_items, time12) && `First tee ${firstTeeTime(event.schedule_items, time12)}`].filter(Boolean).join(' · ')}
              </p>
            </div>

            <div className="space-y-3 rounded-sm border border-surface-border bg-status-upcoming-bg px-4 py-4 text-left">
              <p className="text-[15px] font-bold text-status-upcoming-text">
                {hasPayment && Number(payAmount) > 0 ? `Next: pay your ${feeText(payAmount)} entry fee` : 'Your spot is pending payment'}
              </p>
              <p className="text-sm text-status-upcoming-text">
                {hasPayment
                  ? 'Your spot is pending payment. It is confirmed once payment is received.'
                  : 'Follow payment instructions provided by your administrator.'}
              </p>
              {hasPayment && (
                <div className="space-y-3 pt-1">
                  {event.venmo_handle && <VenmoButton handle={event.venmo_handle} amount={payAmount} note={payNote} />}
                  {event.zelle_handle && <ZelleButton handle={event.zelle_handle} amount={payAmount} note={payNote} />}
                  {event.paypal_link && <PayPalButton link={event.paypal_link} amount={payAmount} note={payNote} />}
                  <p className={HINT}>You'll hear from the organizer shortly.</p>
                </div>
              )}
            </div>

            {eventHref && <Button as={Link} to={eventHref} variant="secondary" size="lg" className="w-full">Back to event page</Button>}
          </section>
        )}

        {/* Footer */}
        {!loading && event && (
          <footer className="space-y-2 pb-8 pt-2 text-center">
            {eventHref && !submitted && (
              <Link to={eventHref} className="inline-flex min-h-[44px] items-center text-sm font-bold text-fairway-700 underline">View full event details →</Link>
            )}
            <p className="text-xs text-ink-muted">Powered by <span className="font-bold text-fairway-700">Scorify Golf</span></p>
          </footer>
        )}
      </main>
    </Shell>
    </>
  )
}
