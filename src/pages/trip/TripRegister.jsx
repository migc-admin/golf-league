/**
 * Public trip sign-up. URL: /:orgSlug/trip/:tripSlug/register (or /trip/:tripSlug/register on a subdomain).
 *
 *  1. Load the trip, its rounds and its cost items.
 *  2. The person enters their name and contact, then answers:
 *       - Golfing? and, if so, which rounds (each round shows its price)
 *       - Staying in the rental property? (only when the trip's lodging is a rental; lodging share on Yes)
 *       - Bringing a guest? (when the organizer asks) — the guest gets the same questions, same prices
 *       - the organizer's own questions; a Yes/No question can carry a cost, added once on Yes
 *  3. A live total (lib/tripCosts signupQuote) shows what they owe, line by line.
 *  4. On submit → trip_registrations (pending). The organizer confirms it, which adds the traveler(s).
 *  5. The confirmation shows payment buttons for the quoted total.
 *
 * Trip rounds never take their own registrations; this page is the only way in.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../../lib/supabase'
import Button from '../../components/ui/Button'
import { Shell, Field, INPUT, inputTone, HINT, GOLD, VenmoButton, ZelleButton, PayPalButton } from '../Register'
import { signupQuote, signupQuestions, isRental, roundItem, perPerson, money, COST_KINDS } from '../../lib/tripCosts'
import { tripStatus } from '../../lib/tripView'
import { time12 } from '../../lib/tripItinerary'
import { missingMessage } from '../../lib/registerView'
import { useSubdomainOrg } from '../../lib/SubdomainContext'

function dateRange(start, end) {
  if (!start) return ''
  const f = (d, o) => new Date(`${d}T00:00:00`).toLocaleDateString('en-US', o)
  if (!end || end === start) return f(start, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  return `${f(start, { month: 'short', day: 'numeric' })} – ${f(end, { month: 'short', day: 'numeric', year: 'numeric' })}`
}

/** Two big buttons acting as a radio pair. `value` is true / false / null (unanswered). */
function Choice({ id, label, value, onChange, yes = 'Yes', no = 'No', hint = null, invalid = false }) {
  const opt = (v, text) => (
    <button type="button" role="radio" aria-checked={value === v} onClick={() => onChange(v)}
      className={`min-h-[48px] flex-1 rounded-[10px] border px-3 text-[15px] font-semibold transition-colors ${value === v ? 'border-fairway-700 bg-status-active-bg text-fairway-800' : invalid ? 'border-red-600 bg-white text-ink' : 'border-surface-highest bg-white text-ink'}`}>
      {text}
    </button>
  )
  return (
    <div className="space-y-2">
      <p id={`${id}-label`} className="text-sm font-semibold text-ink">{label}</p>
      {hint && <p className="-mt-1 text-xs text-ink-muted">{hint}</p>}
      <div id={id} role="radiogroup" aria-labelledby={`${id}-label`} tabIndex={-1} data-reg-field className="flex gap-2">{opt(true, yes)}{opt(false, no)}</div>
      {invalid && <p id={`${id}-error`} className="text-xs font-semibold text-red-600">Required</p>}
    </div>
  )
}

function RoundPicker({ trip, rounds, picked, onToggle, legend }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold text-ink">{legend}</legend>
      {rounds.map(r => {
        const item = roundItem(trip, r.id)
        const price = item ? perPerson(item, trip.planned_headcount) : null
        const d = r.event_date ? new Date(`${r.event_date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : null
        const on = picked.has(r.id)
        return (
          <label key={r.id} className={`flex min-h-[56px] cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5 ${on ? 'border-fairway-700 bg-status-active-bg' : 'border-surface-highest bg-white'}`}>
            <input type="checkbox" checked={on} onChange={() => onToggle(r.id)} className="h-5 w-5 shrink-0 accent-fairway-700" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-semibold text-ink">{r.name || r.course?.name || `Round ${r.event_number}`}</span>
              <span className="block text-xs text-ink-muted">{[d, r.start_time ? time12(r.start_time) : null, r.name ? r.course?.name : null].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="shrink-0 text-[15px] font-bold tabular-nums text-ink">{price == null ? '' : money(price)}</span>
          </label>
        )
      })}
    </fieldset>
  )
}

const toggleIn = setter => id => setter(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

export default function TripRegister({ orgSlug, tripSlug }) {
  const subdomainOrg = useSubdomainOrg()
  const [trip,       setTrip]       = useState(null)
  const [rounds,     setRounds]     = useState([])
  const [goingCount, setGoingCount] = useState(0)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [phone,     setPhone]     = useState('')
  const [golfing,   setGolfing]   = useState(true)
  const [picked,    setPicked]    = useState(() => new Set())
  const [staying,   setStaying]   = useState(null)  // rental only; must be answered

  const [withGuest,    setWithGuest]    = useState(null) // asked only when the organizer turns it on
  const [guestFirst,   setGuestFirst]   = useState('')
  const [guestLast,    setGuestLast]    = useState('')
  const [guestGolfing, setGuestGolfing] = useState(true)
  const [guestPicked,  setGuestPicked]  = useState(() => new Set())
  const [guestStaying, setGuestStaying] = useState(null)

  const [answers,   setAnswers]   = useState({}) // question index -> text, or 'yes' / 'no'
  const [notes,     setNotes]     = useState('')
  const [missing,   setMissing]   = useState(null)
  const [saving,    setSaving]    = useState(false)
  const [submitted, setSubmitted] = useState(null) // the quote they registered with
  const formRef = useRef(null)

  useEffect(() => {
    async function load() {
      const { data: t } = await supabase
        .from('trips')
        .select('id, name, slug, start_date, end_date, location, logo_url, league_id, lodging, registration_open, registration_spots, planned_headcount, cost_items, custom_questions, ask_guest, venmo_handle, paypal_link, zelle_handle')
        .eq('slug', tripSlug)
        .single()
      if (!t) { setError('Trip not found.'); setLoading(false); return }
      setTrip(t)
      const [{ data: ev }, { count }] = await Promise.all([
        supabase.from('events').select('id, name, event_number, event_date, start_time, course:courses(name)').eq('league_id', t.league_id).order('event_date', { ascending: true }),
        supabase.from('trip_travelers').select('id', { count: 'exact', head: true }).eq('trip_id', t.id),
      ])
      const all = new Set((ev ?? []).map(r => r.id)) // most people play every round; untick to skip one
      setRounds(ev ?? [])
      setPicked(all)
      setGuestPicked(new Set(all))
      setGoingCount(count ?? 0)
      setLoading(false)
    }
    load()
  }, [tripSlug])

  const tripHref   = subdomainOrg ? `/trip/${tripSlug}` : `/${orgSlug}/trip/${tripSlug}`
  const questions  = trip ? signupQuestions(trip) : []
  const rental     = isRental(trip)
  const askGuest   = !!trip?.ask_guest
  const hasGuest   = askGuest && withGuest === true
  const full       = trip?.registration_spots != null && goingCount >= trip.registration_spots
  const isClosed   = !!trip && (!trip.registration_open || tripStatus(trip) !== 'upcoming' || full)
  const yesNo      = Object.fromEntries(questions.map((qq, i) => [i, qq.type === 'yes_no' ? (answers[i] === true ? 'yes' : answers[i] === false ? 'no' : null) : answers[i]]))
  const person     = { golfing, roundIds: [...picked], staying: rental ? staying !== false : null }
  const guest      = hasGuest ? { golfing: guestGolfing, roundIds: [...guestPicked], staying: rental ? guestStaying !== false : null } : null
  const q          = trip ? signupQuote(trip, { person, guest, answers: yesNo }) : { people: [], extras: [], total: 0 }
  const hasPayment = !!(trip?.venmo_handle || trip?.paypal_link || trip?.zelle_handle)
  const guestName  = [guestFirst.trim(), guestLast.trim()].filter(Boolean).join(' ') || 'Your guest'
  const guestInLine = guestFirst.trim() || 'your guest' // mid-sentence: "Is Sam staying…" / "Is your guest staying…"

  function validate() {
    const ids = new Set(), names = [], asked = []
    if (!firstName.trim()) { ids.add('trip-first'); names.push('first name') }
    if (!lastName.trim())  { ids.add('trip-last');  names.push('last name') }
    if (!email.trim())     { ids.add('trip-email'); names.push('email') }
    if (rental && staying == null) { ids.add('trip-staying'); asked.push('Staying in the rental property?') }
    if (askGuest && withGuest == null) { ids.add('trip-guest'); asked.push('Bringing a guest?') }
    if (hasGuest) {
      if (!guestFirst.trim()) { ids.add('guest-first'); names.push("guest's first name") }
      if (!guestLast.trim())  { ids.add('guest-last');  names.push("guest's last name") }
      if (rental && guestStaying == null) { ids.add('guest-staying'); asked.push('Is your guest staying in the rental property?') }
    }
    questions.forEach((qq, i) => {
      const a = answers[i]
      const empty = qq.type === 'yes_no' ? a !== true && a !== false : !String(a ?? '').trim()
      if (qq.required && empty) { ids.add(`trip-q-${i}`); asked.push(qq.label.trim()) }
    })
    if (ids.size === 0) return null
    return { ids, message: missingMessage({ names, questions: asked }) }
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
      setMissing(gaps); setError(null)
      const first = [...formRef.current.querySelectorAll('[data-reg-field]')].find(el => gaps.ids.has(el.id))
      first?.focus()
      return
    }
    setMissing(null); setSaving(true); setError(null)
    const { error: insErr } = await supabase.from('trip_registrations').insert({
      trip_id:      trip.id,
      first_name:   firstName.trim(),
      last_name:    lastName.trim(),
      email:        email.trim() || null,
      phone:        phone.trim() || null,
      golfing,
      round_ids:    golfing ? [...picked] : [],
      staying:      rental ? staying : null,
      guest:        hasGuest ? { first_name: guestFirst.trim(), last_name: guestLast.trim(), golfing: guestGolfing, round_ids: guestGolfing ? [...guestPicked] : [], staying: rental ? guestStaying : null } : null,
      answers:      questions.map((qq, i) => {
        const a = answers[i]
        if (qq.type === 'yes_no') return a === true || a === false ? { label: qq.label.trim(), answer: a ? 'Yes' : 'No', ...(a && qq.cost ? { cost: qq.cost } : {}) } : null
        return String(a ?? '').trim() ? { label: qq.label.trim(), answer: String(a).trim() } : null
      }).filter(Boolean),
      notes:        notes.trim() || null,
      quoted_total: q.total,
    })
    setSaving(false)
    if (insErr) { setError(insErr.message?.includes('guest') ? insErr.message : 'Something went wrong. Please try again.'); return }
    setSubmitted(q)
  }

  const gapMsg = missing?.message ?? (trip ? error : null)
  const has    = id => !!missing?.ids.has(id)
  const aria   = id => ({ 'data-reg-field': true, 'aria-invalid': has(id) || undefined, 'aria-describedby': has(id) ? `${id}-error` : undefined })
  const payAmount = Number(submitted?.total ?? 0).toFixed(2)
  const payNote   = `${trip?.name ?? 'Trip'} – ${firstName} ${lastName}`
  const anyLines  = q.people.some(p => p.lines.length > 0) || q.extras.length > 0

  // One person's lines in the cost box: shared items by name, golf rolled into one line.
  function PersonLines({ p, title }) {
    const golf = p.lines.filter(l => l.kind === 'golf')
    return (
      <>
        {title && <li className="pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fairway-700">{title}</li>}
        {p.lines.filter(l => l.kind !== 'golf').map(l => (
          <li key={l.id} className="flex justify-between gap-3 text-sm text-status-active-text"><span>{l.label || COST_KINDS[l.kind]}</span><span className="tabular-nums">{money(l.price)}</span></li>
        ))}
        {golf.length > 0 && (
          <li className="flex justify-between gap-3 text-sm text-status-active-text">
            <span>Golf · {golf.length} round{golf.length === 1 ? '' : 's'}</span>
            <span className="tabular-nums">{money(golf.reduce((s, l) => s + l.price, 0))}</span>
          </li>
        )}
      </>
    )
  }

  return (
    <>
      <Helmet>
        <title>{trip ? `Sign up for ${trip.name} | Scorify Golf` : 'Trip sign-up | Scorify Golf'}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Shell>
        {trip && (
          <header className="border-b border-surface-border bg-white px-4 pb-6 pt-6 text-center">
            <div className="mx-auto flex max-w-[520px] flex-col items-center">
              {trip.logo_url && <img src={trip.logo_url} alt="" className="h-[72px] w-[72px] rounded-sm object-cover" />}
              <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">Golf trip</p>
              <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${isClosed ? 'bg-surface-high text-ink-muted' : 'bg-status-upcoming-bg text-status-upcoming-text'}`}>
                {!isClosed && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
                {isClosed ? (full ? 'Trip is full' : 'Registration closed') : 'Registration open'}
              </span>
              <h1 className="mt-3 text-[clamp(28px,8vw,36px)] font-extrabold leading-[1.1] text-ink" style={{ letterSpacing: '-0.03em' }}>{trip.name}</h1>
              <div className="mt-3 h-1 w-11 rounded-full" style={{ background: GOLD }} aria-hidden="true" />
              <p className="mt-3 text-[15px] font-bold text-ink">{dateRange(trip.start_date, trip.end_date)}</p>
              {trip.location && <p className="text-[15px] text-ink-muted">{trip.location}</p>}
            </div>
          </header>
        )}

        <main className="mx-auto w-full max-w-[520px] space-y-4 px-4 py-4">
          {loading && <p className="py-16 text-center text-ink-muted">Loading…</p>}

          {!loading && !trip && (
            <div className="rounded-sm border border-surface-border bg-white p-6 text-center">
              <p className="font-semibold text-red-600">{error}</p>
              <Link to="/" className="mt-3 inline-flex min-h-[44px] items-center text-sm font-semibold text-fairway-700 underline">Go home</Link>
            </div>
          )}

          {!loading && trip && isClosed && !submitted && (
            <div className="rounded-sm border border-surface-border bg-white p-6 text-center">
              <p className="font-semibold text-ink">{full ? 'This trip is full.' : 'Sign-ups for this trip are closed.'}</p>
              <Link to={tripHref} className="mt-2 inline-flex min-h-[44px] items-center text-sm font-bold text-fairway-700 underline">See the trip →</Link>
            </div>
          )}

          {!loading && trip && !isClosed && !submitted && (
            <section className="rounded-sm border border-surface-border bg-white p-4 sm:p-5">
              <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-6">
                {gapMsg && <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{gapMsg}</div>}

                <div className="grid grid-cols-1 gap-x-3 gap-y-5 min-[340px]:grid-cols-2">
                  <Field id="trip-first" label="First name" error={has('trip-first') && 'Required'}>
                    <input id="trip-first" autoComplete="given-name" value={firstName} onChange={e => { setFirstName(e.target.value); clearGap('trip-first') }}
                      className={`${INPUT} min-h-[48px] ${inputTone(has('trip-first'))}`} {...aria('trip-first')} />
                  </Field>
                  <Field id="trip-last" label="Last name" error={has('trip-last') && 'Required'}>
                    <input id="trip-last" autoComplete="family-name" value={lastName} onChange={e => { setLastName(e.target.value); clearGap('trip-last') }}
                      className={`${INPUT} min-h-[48px] ${inputTone(has('trip-last'))}`} {...aria('trip-last')} />
                  </Field>
                  <Field id="trip-email" label="Email" error={has('trip-email') && 'Required'}>
                    <input id="trip-email" type="email" autoComplete="email" inputMode="email" value={email} onChange={e => { setEmail(e.target.value); clearGap('trip-email') }}
                      className={`${INPUT} min-h-[48px] ${inputTone(has('trip-email'))}`} {...aria('trip-email')} />
                  </Field>
                  <Field id="trip-phone" label="Phone" optional>
                    <input id="trip-phone" type="tel" autoComplete="tel" inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)}
                      className={`${INPUT} min-h-[48px] border-surface-highest`} />
                  </Field>
                </div>

                {rental && (
                  <Choice id="trip-staying" label="Are you staying in the rental property?" value={staying} invalid={has('trip-staying')}
                    hint={lodgingHint(trip)} onChange={v => { setStaying(v); clearGap('trip-staying') }} />
                )}

                <Choice id="trip-golfing" label="Golfing on this trip?" value={golfing} yes="Yes, I'm golfing" no="Not golfing" onChange={setGolfing} />
                {golfing && rounds.length > 0 && (
                  <RoundPicker trip={trip} rounds={rounds} picked={picked} onToggle={toggleIn(setPicked)} legend="Which rounds will you play?" />
                )}

                {askGuest && (
                  <Choice id="trip-guest" label="Are you bringing a guest?" value={withGuest} invalid={has('trip-guest')}
                    hint="Your guest is priced just like you." onChange={v => { setWithGuest(v); clearGap('trip-guest') }} />
                )}

                {hasGuest && (
                  <div className="space-y-5 rounded-[10px] border border-surface-border bg-surface-container p-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">Your guest</p>
                    <div className="grid grid-cols-1 gap-x-3 gap-y-5 min-[340px]:grid-cols-2">
                      <Field id="guest-first" label="Guest first name" error={has('guest-first') && 'Required'}>
                        <input id="guest-first" value={guestFirst} onChange={e => { setGuestFirst(e.target.value); clearGap('guest-first') }}
                          className={`${INPUT} min-h-[48px] ${inputTone(has('guest-first'))}`} {...aria('guest-first')} />
                      </Field>
                      <Field id="guest-last" label="Guest last name" error={has('guest-last') && 'Required'}>
                        <input id="guest-last" value={guestLast} onChange={e => { setGuestLast(e.target.value); clearGap('guest-last') }}
                          className={`${INPUT} min-h-[48px] ${inputTone(has('guest-last'))}`} {...aria('guest-last')} />
                      </Field>
                    </div>
                    {rental && (
                      <Choice id="guest-staying" label={`Is ${guestInLine} staying in the rental property?`} value={guestStaying} invalid={has('guest-staying')}
                        onChange={v => { setGuestStaying(v); clearGap('guest-staying') }} />
                    )}
                    <Choice id="guest-golfing" label={`Is ${guestInLine} golfing?`} value={guestGolfing} yes="Yes, golfing" no="Not golfing" onChange={setGuestGolfing} />
                    {guestGolfing && rounds.length > 0 && (
                      <RoundPicker trip={trip} rounds={rounds} picked={guestPicked} onToggle={toggleIn(setGuestPicked)} legend={`Which rounds will ${guestInLine} play?`} />
                    )}
                  </div>
                )}

                {questions.map((qq, i) => (qq.type === 'yes_no' ? (
                  <Choice key={i} id={`trip-q-${i}`} label={`${qq.label.trim()}${qq.required ? '' : ' (optional)'}`} value={answers[i] ?? null} invalid={has(`trip-q-${i}`)}
                    yes={qq.cost ? `Yes · ${money(qq.cost)}` : 'Yes'} hint={qq.cost ? `Adds ${money(qq.cost)} to your total.` : null}
                    onChange={v => { setAnswers(prev => ({ ...prev, [i]: v })); clearGap(`trip-q-${i}`) }} />
                ) : (
                  <Field key={i} id={`trip-q-${i}`} label={qq.label.trim()} optional={!qq.required} error={has(`trip-q-${i}`) && 'Required'}>
                    <textarea id={`trip-q-${i}`} rows={2} value={answers[i] ?? ''}
                      onChange={e => { setAnswers(prev => ({ ...prev, [i]: e.target.value })); clearGap(`trip-q-${i}`) }}
                      className={`${INPUT} min-h-[72px] resize-none py-3 ${inputTone(has(`trip-q-${i}`))}`} placeholder="Your answer" {...aria(`trip-q-${i}`)} />
                  </Field>
                )))}

                <Field id="trip-notes" label="Notes" optional>
                  <textarea id="trip-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)}
                    className={`${INPUT} min-h-[72px] resize-none py-3 border-surface-highest`} placeholder="Anything the organizer should know" />
                </Field>

                {anyLines && (
                  <div className="rounded-sm border border-fairway-200 bg-status-active-bg px-4 py-3.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">Your trip cost</p>
                    <ul className="mt-2 space-y-1">
                      {q.people.map(p => (
                        <PersonLines key={p.who} p={p} title={q.people.length > 1 ? (p.who === 'guest' ? guestName : 'You') : null} />
                      ))}
                      {q.extras.length > 0 && q.people.length > 1 && <li className="pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-fairway-700">Extras</li>}
                      {q.extras.map(x => (
                        <li key={x.label} className="flex justify-between gap-3 text-sm text-status-active-text"><span>{x.label}</span><span className="tabular-nums">{money(x.price)}</span></li>
                      ))}
                    </ul>
                    <div className="mt-2 flex items-baseline justify-between border-t border-fairway-200 pt-2">
                      <span className="text-base font-extrabold text-fairway-800">Total</span>
                      <span className="text-[26px] font-extrabold tabular-nums leading-none text-fairway-800">{q.total ? `$${q.total.toFixed(2)}` : '$0'}</span>
                    </div>
                  </div>
                )}

                <div>
                  <Button type="submit" size="lg" loading={saving} className="w-full !min-h-[52px] text-base">
                    {saving ? 'Submitting…' : q.total > 0 ? `Sign up · $${q.total.toFixed(2)}` : 'Sign up'}
                  </Button>
                  {q.total > 0 && (
                    <p className={`${HINT} mt-2.5`}>{hasPayment ? "You'll get payment instructions on the next screen." : 'Your organizer will share payment instructions.'}</p>
                  )}
                </div>
              </form>
            </section>
          )}

          {submitted && trip && (
            <section className="space-y-5 rounded-sm border border-surface-border bg-white p-5 text-center">
              <div>
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-fairway-700 text-white" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </div>
                <h2 className="text-2xl font-extrabold text-ink" style={{ letterSpacing: '-0.02em' }}>You're signed up, {firstName.trim()}{hasGuest ? ` (+ ${guestFirst.trim()})` : ''}</h2>
                <p className="mt-1 text-sm text-ink-muted">{trip.name} · {dateRange(trip.start_date, trip.end_date)}</p>
              </div>
              <div className="space-y-3 rounded-sm border border-surface-border bg-status-upcoming-bg px-4 py-4 text-left">
                <p className="text-[15px] font-bold text-status-upcoming-text">
                  {hasPayment && submitted.total > 0 ? `Next: pay your $${payAmount} trip cost` : 'Your spot is pending'}
                </p>
                <p className="text-sm text-status-upcoming-text">The organizer confirms your spot. {hasPayment && submitted.total > 0 ? 'It is confirmed once payment is received.' : 'They will be in touch about payment.'}</p>
                {hasPayment && submitted.total > 0 && (
                  <div className="space-y-3 pt-1">
                    {trip.venmo_handle && <VenmoButton handle={trip.venmo_handle} amount={payAmount} note={payNote} />}
                    {trip.zelle_handle && <ZelleButton handle={trip.zelle_handle} amount={payAmount} note={payNote} />}
                    {trip.paypal_link && <PayPalButton link={trip.paypal_link} amount={payAmount} note={payNote} />}
                  </div>
                )}
              </div>
              <Button as={Link} to={tripHref} variant="secondary" size="lg" className="w-full">Back to the trip</Button>
            </section>
          )}

          {!loading && trip && (
            <footer className="space-y-2 pb-8 pt-2 text-center">
              {!submitted && <Link to={tripHref} className="inline-flex min-h-[44px] items-center text-sm font-bold text-fairway-700 underline">View the full trip →</Link>}
              <p className="text-xs text-ink-muted">Powered by <span className="font-bold text-fairway-700">Scorify Golf</span></p>
            </footer>
          )}
        </main>
      </Shell>
    </>
  )
}

/** "Vivanta house · $300 per person if staying" — the rental's name and the lodging share. */
function lodgingHint(trip) {
  const name = trip?.lodging?.name?.trim()
  const share = (Array.isArray(trip?.cost_items) ? trip.cost_items : [])
    .filter(i => i.kind === 'lodging')
    .reduce((s, i) => s + (perPerson(i, trip.planned_headcount) ?? 0), 0)
  return [name, share > 0 ? `${money(share)} per person if staying` : null].filter(Boolean).join(' · ') || null
}
