/**
 * Public Side-Game Opt-In Page — reached via a QR code printed for the event.
 * URL: /:orgSlug/:leagueSlug/:eventSlug/opt-in  (or /:leagueSlug/:eventSlug/opt-in on a subdomain)
 *
 * Flow (single screen, one-time submit):
 *  1. Player picks their name from the event roster
 *  2. Player picks which opt-in game(s) they're joining (Super Skins / Super CTP / Blind Partners)
 *  3. Total updates live (already-joined games are excluded from the total)
 *  4. Player taps "Pay Cash" or "Pay with Venmo" — this writes them into
 *     event.side_game_entries via the opt_in_side_games RPC (honor-system, same
 *     trust model as the existing Register.jsx flow — no payment reconciliation)
 *
 * Opt-in closes 10 minutes after the last scheduled tee time (see computeOptInCutoff).
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { useSubdomainOrg } from '../lib/SubdomainContext'
import { OPT_IN_GAME_KEYS, OPT_IN_GAME_LABELS, optInAmount } from '../lib/sideGames'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'

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
        .select('id, name, slug, event_number, event_date, status, venmo_handle, side_game_options, payout_config, side_game_entries, super_ctp_hole, start_time, shotgun_start, tee_time_interval_mins, course:courses(name), league:leagues(name, slug, logo_url)')
        .eq('league_id', league.id)
        .eq('slug', eventSlug)
        .single()
      if (!ev) { setLoading(false); return }
      setEvent(ev)

      const { data: eps } = await supabase
        .from('event_players')
        .select('player_id, group_number, player:players(first_name, last_name)')
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
        <p className="text-white/60">Loading…</p>
      </div>
    )
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
        <p className="text-white/60">Event not found.</p>
      </div>
    )
  }

  // Enabled opt-in games: derived from side_game_options, filtered to ones with a configured $ amount
  const baseKeys = [...new Set((event.side_game_options ?? []).map(k => k.replace(/_[ab]$/, '')))]
  const availableGames = baseKeys.filter(k => OPT_IN_GAME_KEYS.has(k) && optInAmount(event, k) != null)

  const cutoff   = computeOptInCutoff(event, eventPlayers)
  const isClosed = cutoff ? new Date() > cutoff : false

  const entries = event.side_game_entries ?? {}
  const selectedPlayer = eventPlayers.find(ep => ep.player_id === playerId)
  const playerName = selectedPlayer ? `${selectedPlayer.player?.first_name ?? ''} ${selectedPlayer.player?.last_name ?? ''}`.trim() : ''

  const selectedList  = [...selectedGames]
  const alreadyKeys   = playerId ? selectedList.filter(k => (entries[k] ?? []).includes(playerId)) : []
  const newKeys       = selectedList.filter(k => !alreadyKeys.includes(k))
  const total         = newKeys.reduce((sum, k) => sum + (optInAmount(event, k) ?? 0), 0)
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

  return (
    <>
    <Helmet>
      <title>Side Game Opt-In — {eventLabel} | Scorify Golf</title>
      <meta name="robots" content="noindex" />
    </Helmet>
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)' }}>
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-8">
          <img src={event.league?.logo_url ?? '/logo.png'} alt="Golf League Logo"
            className="w-20 h-20 rounded-full object-cover mx-auto mb-3 shadow-xl" />
          <h1 className="text-white font-bold text-2xl" style={{ fontFamily: "'Manrope', sans-serif" }}>
            Side Game Opt-In
          </h1>
          <p className="text-white/80 font-semibold mt-1">{eventLabel}</p>
          <p className="text-white/50 text-sm">{event.course?.name}{event.course?.name && eventDate ? ' · ' : ''}{eventDate}</p>
          <div className="mx-auto mt-3" style={{ width: 40, height: 2, background: GOLD }} />
        </div>

        {!result && isClosed && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-gray-700 font-semibold mb-1">Opt-in is closed</p>
            <p className="text-sm text-gray-400">This event's opt-in window has ended. See an event admin if you still need to pay.</p>
          </div>
        )}

        {!result && !isClosed && availableGames.length === 0 && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
            <p className="text-gray-500">No opt-in side games are set up for this event yet.</p>
          </div>
        )}

        {/* Opt-in form */}
        {!result && !isClosed && availableGames.length > 0 && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Your Name</label>
              <select
                value={playerId}
                onChange={e => setPlayerId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="">— Select your name —</option>
                {eventPlayers.map(ep => (
                  <option key={ep.player_id} value={ep.player_id}>
                    {ep.player?.first_name} {ep.player?.last_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-600 mb-2">Select the games you're joining</p>
              <div className="space-y-2">
                {availableGames.map(key => (
                  <label key={key} className="flex items-center justify-between gap-2 border border-gray-200 rounded-lg px-3 py-2.5 cursor-pointer">
                    <span className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedGames.has(key)}
                        onChange={() => toggleGame(key)}
                        className="accent-fairway-600 w-4 h-4"
                      />
                      <span className="text-sm font-medium text-gray-800">{OPT_IN_GAME_LABELS[key]}</span>
                    </span>
                    <span className="text-sm text-gray-500">${Number(optInAmount(event, key)).toFixed(2)}</span>
                  </label>
                ))}
              </div>
            </div>

            {playerId && alreadyKeys.length > 0 && (
              <p className="text-xs text-amber-600">
                Already signed up for {alreadyKeys.map(k => OPT_IN_GAME_LABELS[k]).join(', ')} — no need to pay again for {alreadyKeys.length > 1 ? 'those' : 'that'}.
              </p>
            )}

            {playerId && selectedList.length > 0 && newKeys.length === 0 && (
              <p className="text-sm text-center text-gray-500 font-medium">You're already signed up — no payment needed.</p>
            )}

            {error && <p className="text-red-500 text-xs text-center">{error}</p>}

            {newKeys.length > 0 && (
              <div className="space-y-2">
                <div className="bg-gray-50 rounded-xl px-4 py-3 text-sm flex justify-between font-bold text-gray-900">
                  <span>Total</span><span>${total.toFixed(2)}</span>
                </div>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => submit('cash')}
                  className="w-full py-3 rounded-xl font-bold text-white text-sm transition-opacity disabled:opacity-60"
                  style={{ background: GREEN }}
                >
                  {submitting ? 'Submitting…' : `Pay Cash — $${total.toFixed(2)}`}
                </button>
                <p className="text-xs text-gray-400 text-center -mt-1">
                  Cash must be paid to league admin before event begins.
                </p>
                {event.venmo_handle && (
                  <button
                    type="button"
                    disabled={!canSubmit}
                    onClick={() => submit('venmo')}
                    className="w-full py-3 rounded-xl font-bold text-white text-sm transition-opacity disabled:opacity-60"
                    style={{ background: '#008CFF' }}
                  >
                    {submitting ? 'Submitting…' : `Pay with Venmo — $${total.toFixed(2)}`}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Confirmation */}
        {result && (
          <div className="bg-white rounded-2xl shadow-2xl p-6 space-y-5 text-center">
            <div>
              <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: '#d1fae5' }}>
                <svg className="w-6 h-6 text-green-700" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-bold text-gray-900">You're in!</h2>
              <p className="text-sm text-gray-500 mt-1">
                {playerName}, you're signed up for{' '}
                <span className="font-semibold text-gray-900">
                  {result.joinedKeys.map(k => OPT_IN_GAME_LABELS[k]).join(', ')}
                </span>.
              </p>
            </div>

            {result.method === 'cash' && (
              <div className="space-y-1">
                <p className="text-sm text-gray-600">Tell the starter you're paying <strong>${result.total.toFixed(2)}</strong> cash.</p>
                <p className="text-xs text-amber-600 font-medium">Cash must be paid to league admin before event begins.</p>
              </div>
            )}

            {result.method === 'venmo' && event.venmo_handle && (
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Complete your payment</p>
                <VenmoButton
                  handle={event.venmo_handle}
                  amount={result.total.toFixed(2)}
                  note={`${eventLabel} side games – ${playerName} – ${result.joinedKeys.map(k => OPT_IN_GAME_LABELS[k]).join(', ')}`}
                />
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    </>
  )
}
