/**
 * Public Side-Game Opt-In Page — reached via a QR code printed for the event.
 * URL: /:orgSlug/:leagueSlug/:eventSlug/opt-in  (or /:leagueSlug/:eventSlug/opt-in on a subdomain)
 *
 * Flow (single screen, one-time submit):
 *  1. Player picks their name from the event roster
 *  2. Player picks which "Separate buy-in" game(s) they're joining (any side game
 *     flagged that way on the event — not just the legacy Super Skins/Super CTP/Blind Partners)
 *  3. Total updates live (already-joined games are excluded from the total)
 *  4. Player taps "Pay Cash" or "Pay with Venmo" — this writes them into
 *     event.side_game_entries via the opt_in_side_games RPC (honor-system, same
 *     trust model as the existing Register.jsx flow — no payment reconciliation)
 *
 * Opt-in closes 10 minutes after the last scheduled tee time (see computeOptInCutoff).
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { useSubdomainOrg } from '../lib/SubdomainContext'
import { OPT_IN_GAME_LABELS, isBuyInEnabled, optInAmount } from '../lib/sideGames'
import LeagueMark from '../components/ui/LeagueMark'
import Button from '../components/ui/Button'

const GOLD = '#C9A84C' // same gold the league initials mark uses
const PAY_BTN = 'flex min-h-[52px] w-full items-center justify-center gap-3 rounded-sm px-4 text-[15px] font-bold text-white no-underline transition-opacity hover:opacity-90'
const HINT = 'text-center text-xs text-ink-muted'
const FIELD = 'block w-full min-h-[48px] rounded-[10px] border border-surface-highest bg-white px-3.5 text-base text-ink focus:border-fairway-700 focus:outline-none focus:ring-2 focus:ring-fairway-500'

function isMobile() {
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}

// Opt-in closes 10 minutes after the last scheduled tee time (or the single
// shotgun start time). Returns null if there's no scheduled start time to
// compute a cutoff from — in that case opt-in stays open indefinitely.
function computeOptInCutoff(event, eventPlayers) {
  if (!event?.event_date || !event?.start_time) return null
  const [h, m] = event.start_time.split(':').map(Number)
  let lastTeeMins = h * 60 + m
  if (!event.shotgun_start) {
    const groupNums = eventPlayers.map(ep => ep.group_number).filter(n => n != null)
    if (groupNums.length > 0) {
      const maxGroup = Math.max(...groupNums)
      const interval = event.tee_time_interval_mins ?? 10
      lastTeeMins += (maxGroup - 1) * interval
    }
  }
  const cutoff = new Date(`${event.event_date}T00:00:00`)
  cutoff.setMinutes(cutoff.getMinutes() + lastTeeMins + 10)
  return cutoff
}

function VenmoButton({ handle, amount, note }) {
  const encoded = encodeURIComponent(note)
  const webUrl  = `https://venmo.com/${handle}?txn=pay&amount=${amount}&note=${encoded}`
  const appUrl  = `venmo://paycharge?txn=pay&recipients=${handle}&amount=${amount}&note=${encoded}`

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
        Pay with Venmo · ${amount}
      </a>
      <p className={HINT}>
        Please confirm the amount is <strong>${amount}</strong> before sending.
      </p>
    </>
  )
}

function Shell({ children }) {
  return <div className="min-h-screen bg-surface-dim font-sans text-ink">{children}</div>
}

export default function OptIn() {
  const subdomainOrg = useSubdomainOrg()
  const { orgSlug: paramOrgSlug, leagueSlug, eventSlug } = useParams()
  const orgSlug = subdomainOrg ?? paramOrgSlug

  const [event,        setEvent]        = useState(null)
  const [eventPlayers, setEventPlayers] = useState([])
  const [loading,      setLoading]      = useState(true)

  const [selectedGames, setSelectedGames] = useState(new Set())
  const [playerId,      setPlayerId]      = useState('')
  const [submitting,    setSubmitting]    = useState(false)
  const [error,         setError]         = useState(null)
  const [result,        setResult]        = useState(null) // { method, joinedKeys, alreadyKeys, total }

  useEffect(() => {
    async function load() {
      const { data: league } = await supabase.from('leagues').select('id').eq('slug', leagueSlug).single()
      if (!league) { setLoading(false); return }
      const { data: ev } = await supabase
        .from('events')
        .select('id, name, slug, event_number, event_date, status, venmo_handle, side_game_options, side_game_buy_ins, payout_config, side_game_entries, super_ctp_hole, start_time, shotgun_start, tee_time_interval_mins, course:courses(name), league:leagues(name, slug, logo_url)')
        .eq('league_id', league.id)
        .eq('slug', eventSlug)
        .single()
      if (!ev) { setLoading(false); return }
      setEvent(ev)

      const { data: eps } = await supabase
        .from('event_players')
        .select('player_id, group_number, flight, player:players(first_name, last_name)')
        .eq('event_id', ev.id)
      setEventPlayers((eps ?? []).slice().sort((a, b) => {
        const an = `${a.player?.first_name ?? ''} ${a.player?.last_name ?? ''}`
        const bn = `${b.player?.first_name ?? ''} ${b.player?.last_name ?? ''}`
        return an.localeCompare(bn)
      }))
      setLoading(false)
    }
    load()
  }, [leagueSlug, eventSlug])

  if (loading) return <Shell><p className="py-24 text-center text-ink-muted">Loading…</p></Shell>
  if (!event) return <Shell><p className="py-24 text-center text-ink-muted">Event not found.</p></Shell>

  const selectedPlayer  = eventPlayers.find(ep => ep.player_id === playerId)
  const selectedFlight  = selectedPlayer?.flight ?? null
  const playerName = selectedPlayer ? `${selectedPlayer.player?.first_name ?? ''} ${selectedPlayer.player?.last_name ?? ''}`.trim() : ''

  // Games flagged "Separate buy-in" on this event, filtered to ones with a configured $ amount.
  // Uses the selected player's flight (once known) to resolve flight-scoped rates correctly.
  const baseKeys = [...new Set((event.side_game_options ?? []).map(k => k.replace(/_[ab]$/, '')))]
  const availableGames = baseKeys.filter(k => isBuyInEnabled(event, k) && optInAmount(event, k, selectedFlight) != null)

  const cutoff   = computeOptInCutoff(event, eventPlayers)
  const isClosed = cutoff ? new Date() > cutoff : false

  const entries = event.side_game_entries ?? {}

  const selectedList  = [...selectedGames]
  const alreadyKeys   = playerId ? selectedList.filter(k => (entries[k] ?? []).includes(playerId)) : []
  const newKeys       = selectedList.filter(k => !alreadyKeys.includes(k))
  const total         = newKeys.reduce((sum, k) => sum + (optInAmount(event, k, selectedFlight) ?? 0), 0)
  const canSubmit     = playerId && newKeys.length > 0 && !submitting

  function toggleGame(key) {
    setSelectedGames(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  async function submit(method) {
    if (!canSubmit) return
    setSubmitting(true)
    setError(null)
    const { data, error: rpcErr } = await supabase.rpc('opt_in_side_games', {
      p_event_id:  event.id,
      p_player_id: playerId,
      p_game_keys: newKeys,
    })
    setSubmitting(false)
    if (rpcErr) {
      setError('Something went wrong. Please try again or see an event admin.')
      return
    }
    setResult({ method, joinedKeys: data.joined ?? newKeys, alreadyKeys, total })
  }

  const eventLabel = event.name ?? `Event #${event.event_number}`
  const eventDate  = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''
  const eventHref  = subdomainOrg ? null : `/${orgSlug}/${leagueSlug}/${eventSlug}/event`
  const closedNow  = !result && isClosed

  return (
    <>
    <Helmet>
      <title>Side Game Opt-In — {eventLabel} | Scorify Golf</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <Shell>
      {/* Header band (same as the registration page) */}
      <header className="border-b border-surface-border bg-white px-4 pb-6 pt-6 text-center">
        <div className="mx-auto flex max-w-[480px] flex-col items-center">
          <LeagueMark name={event.league?.name} logoUrl={event.league?.logo_url} size={72} />
          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-700">{event.league?.name}</p>
          <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${closedNow ? 'bg-surface-high text-ink-muted' : 'bg-status-upcoming-bg text-status-upcoming-text'}`}>
            {!closedNow && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />}
            {closedNow ? 'Opt-in closed' : 'Opt-in open'}
          </span>
          <h1 className="mt-3 text-[clamp(28px,8vw,36px)] font-extrabold leading-[1.1] text-ink" style={{ letterSpacing: '-0.03em' }}>Side game opt-in</h1>
          <div className="mt-3 h-1 w-11 rounded-full" style={{ background: GOLD }} aria-hidden="true" />
          <p className="mt-3 text-[15px] font-bold text-ink">{eventLabel}</p>
          {eventDate && <p className="text-[15px] text-ink-muted">{eventDate}</p>}
          {event.course?.name && <p className="text-[15px] text-ink-muted">{event.course.name}</p>}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[480px] space-y-4 px-4 py-4">
        {closedNow && (
          <div className="rounded-sm border border-surface-border bg-white p-6 text-center">
            <p className="font-bold text-ink">Opt-in is closed</p>
            <p className="mt-1 text-sm text-ink-muted">This event's opt-in window has ended. See an event admin if you still need to pay.</p>
          </div>
        )}

        {!result && !isClosed && availableGames.length === 0 && (
          <div className="rounded-sm border border-surface-border bg-white p-6 text-center">
            <p className="text-ink-muted">No opt-in side games are set up for this event yet.</p>
          </div>
        )}

        {/* Opt-in form */}
        {!result && !isClosed && availableGames.length > 0 && (
          <section className="space-y-5 rounded-sm border border-surface-border bg-white p-4 sm:p-5">
            <div>
              <label htmlFor="optin-name" className="mb-1.5 block text-sm font-bold text-ink">Your name</label>
              <select id="optin-name" value={playerId} onChange={e => setPlayerId(e.target.value)} className={FIELD}>
                <option value="">Select your name</option>
                {eventPlayers.map(ep => (
                  <option key={ep.player_id} value={ep.player_id}>
                    {ep.player?.first_name} {ep.player?.last_name}
                  </option>
                ))}
              </select>
            </div>

            <fieldset>
              <legend className="mb-1.5 text-sm font-bold text-ink">Select the games you're joining</legend>
              <div className="space-y-2">
                {availableGames.map(key => {
                  const on = selectedGames.has(key)
                  return (
                    <label
                      key={key}
                      className={`flex min-h-[52px] cursor-pointer items-center justify-between gap-3 rounded-sm border px-4 py-2 transition-colors ${
                        on ? 'border-fairway-700 bg-status-active-bg' : 'border-surface-highest bg-white hover:bg-surface-dim'
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <input type="checkbox" checked={on} onChange={() => toggleGame(key)} className="h-5 w-5 shrink-0 accent-fairway-700" />
                        <span className="text-[15px] font-bold text-ink">{OPT_IN_GAME_LABELS[key]}</span>
                      </span>
                      <span className="text-[15px] font-bold tabular-nums text-ink">${Number(optInAmount(event, key, selectedFlight)).toFixed(2)}</span>
                    </label>
                  )
                })}
              </div>
            </fieldset>

            {playerId && alreadyKeys.length > 0 && (
              <p className="rounded-sm bg-status-upcoming-bg px-3 py-2 text-sm font-semibold text-status-upcoming-text">
                Already signed up for {alreadyKeys.map(k => OPT_IN_GAME_LABELS[k]).join(', ')}. No need to pay again for {alreadyKeys.length > 1 ? 'those' : 'that'}.
              </p>
            )}

            {playerId && selectedList.length > 0 && newKeys.length === 0 && (
              <p className="text-center text-sm font-semibold text-ink-muted">You're already signed up. No payment needed.</p>
            )}

            {error && <div role="alert" className="rounded-sm border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</div>}

            {newKeys.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-sm border border-fairway-200 bg-status-active-bg px-4 py-3.5">
                  <span className="text-lg font-extrabold text-fairway-800">Total</span>
                  <span className="text-[28px] font-extrabold tabular-nums leading-none text-fairway-800">${total.toFixed(2)}</span>
                </div>
                <Button size="lg" className="w-full !min-h-[52px] text-base" disabled={!canSubmit} onClick={() => submit('cash')}>
                  {submitting ? 'Submitting…' : `Pay cash · $${total.toFixed(2)}`}
                </Button>
                <p className={HINT}>Cash must be paid to league admin before event begins.</p>
                {event.venmo_handle && (
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => submit('venmo')}
                    className={`${PAY_BTN} disabled:opacity-60`}
                    style={{ background: '#008CFF' }}
                  >
                    {submitting ? 'Submitting…' : `Pay with Venmo · $${total.toFixed(2)}`}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {/* Confirmation */}
        {result && (
          <section className="space-y-5 rounded-sm border border-surface-border bg-white p-5 text-center">
            <div>
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-fairway-700 text-white" aria-hidden="true">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              </div>
              <h2 className="text-2xl font-extrabold text-ink" style={{ letterSpacing: '-0.02em' }}>You're in</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {playerName}, you're signed up for{' '}
                <span className="font-bold text-ink">{result.joinedKeys.map(k => OPT_IN_GAME_LABELS[k]).join(', ')}</span>.
              </p>
            </div>

            {result.method === 'cash' && (
              <div className="space-y-1 rounded-sm border border-surface-border bg-status-upcoming-bg px-4 py-4 text-left">
                <p className="text-[15px] font-bold text-status-upcoming-text">Next: pay ${result.total.toFixed(2)} cash</p>
                <p className="text-sm text-status-upcoming-text">Tell the League Admin you're paying <strong>${result.total.toFixed(2)}</strong> cash.</p>
                <p className="text-sm font-semibold text-status-upcoming-text">Cash must be paid to league admin before event begins.</p>
              </div>
            )}

            {result.method === 'venmo' && event.venmo_handle && (
              <div className="space-y-3 rounded-sm border border-surface-border bg-status-upcoming-bg px-4 py-4 text-left">
                <p className="text-[15px] font-bold text-status-upcoming-text">Next: complete your payment</p>
                <VenmoButton
                  handle={event.venmo_handle}
                  amount={result.total.toFixed(2)}
                  note={`${eventLabel} side games – ${playerName} – ${result.joinedKeys.map(k => OPT_IN_GAME_LABELS[k]).join(', ')}`}
                />
              </div>
            )}

            {eventHref && <Button as={Link} to={eventHref} variant="secondary" size="lg" className="w-full">Back to event page</Button>}
          </section>
        )}

        <footer className="pb-8 pt-2 text-center">
          <p className="text-xs text-ink-muted">Powered by <span className="font-bold text-fairway-700">Scorify Golf</span></p>
        </footer>
      </main>
    </Shell>
    </>
  )
}
