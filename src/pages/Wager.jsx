/**
 * Wager.jsx — Public parimutuel wager page
 * Route: /wager/:eventId
 * Anyone with the link can place a bet on players in the field.
 * MIGC-only (Mulligan's Island Golf Club).
 *
 * Presentation only: state, odds and the submit handler are unchanged; the page renders a pick
 * as a card (type switch, player / match, $5 stepper) and totals the picks live.
 */

import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { matchCH } from '../lib/engines/matchPoints'
import { MIN_BET, isValidAmount, totalOf } from '../lib/betAmount'
import WagerPageHeader from '../components/wager/WagerPageHeader'
import StatTiles from '../components/ui/StatTiles'
import Button from '../components/ui/Button'
import { Card } from '../components/wager/AdminBoard'
import WagerTicket from '../components/wager/WagerTicket'
import TicketActions from '../components/wager/TicketActions'
import { groupTickets, latestTicketFor, buildTicketView } from '../lib/wagerTicket'
import { useEmbeddedLogo } from '../lib/useEmbeddedLogo'
import { PickCard, PickTypeToggle, AmountStepper, selectClass, labelClass } from '../components/wager/BetFormParts'

const MIGC_ORG  = import.meta.env.VITE_MIGC_ORG_ID

function fmt(n) { return `$${Number(n).toFixed(2)}` }

function isTeeTimePast(event) {
  if (!event.event_date || !event.start_time) return false
  const teeTime = new Date(`${event.event_date}T${event.start_time.slice(0, 8)}`)
  return Date.now() >= teeTime.getTime() - 10 * 60 * 1000
}

function getBettingClosedReason(event) {
  if (event.status === 'complete') return 'This event has been completed.'
  if (isTeeTimePast(event)) return 'Betting closed 10 minutes before tee time.'
  if (event.wagers_closed) return 'Betting has been closed by the admin.'
  return null
}

export default function Wager() {
  const { eventId } = useParams()

  const [event,        setEvent]        = useState(null)
  const [players,      setPlayers]      = useState([])   // event_players with player obj
  const [wagers,       setWagers]       = useState([])   // live board data
  const [pairings,     setPairings]     = useState([])   // match play pairings (empty = no match betting)
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  // Form state
  const [bettorName,   setBettorName]   = useState('')
  const [picks,        setPicks]        = useState([emptyPick()])
  const [submitted,    setSubmitted]    = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [venmoUrl,     setVenmoUrl]     = useState(null)
  const [payMethod,    setPayMethod]    = useState('venmo') // 'venmo' | 'cash'
  const ticketRef = useRef(null)
  const { logo: ticketLogo, ready: ticketLogoReady } = useEmbeddedLogo(event?.league?.logo_url)

  function emptyPick() {
    // kind: 'field' = WIN/PLACE on a player · 'match' = pick a winner in a match play pairing
    return { id: Math.random(), kind: 'field', playerId: '', position: 'win', matchId: '', matchPick: '', amount: String(MIN_BET) }
  }

  useEffect(() => {
    async function load() {
      // Load event + verify MIGC org
      const { data: ev } = await supabase
        .from('events')
        .select('*, course:courses(name), league:leagues(name, logo_url, org_id)')
        .eq('id', eventId).single()

      if (!ev || ev.league?.org_id !== MIGC_ORG) {
        setError('This wager page is not available.')
        setLoading(false)
        return
      }
      setEvent(ev)

      // Load field
      const { data: eps } = await supabase
        .from('event_players')
        .select('player_id, course_handicap, match_play_course_handicap, player:players(first_name, last_name)')
        .eq('event_id', eventId)
        .order('flight').order('adjusted_handicap_index')
      setPlayers((eps ?? []).filter(ep => ep.player && typeof ep.player === 'object'))

      // Match play pairings — when present, bettors can also wager on each match
      const { data: mp } = await supabase
        .from('match_pairings')
        .select('*')
        .eq('event_id', eventId)
        .order('match_number')
      setPairings(mp ?? [])

      // Load live wagers for board (exclude soft-deleted)
      const { data: ws } = await supabase
        .from('wagers')
        .select('*')
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .order('created_at')
      setWagers(ws ?? [])

      setLoading(false)
    }
    load()

    // Poll every 15 seconds so deletes and new bets appear without a manual refresh
    async function refreshWagers() {
      const { data: ws } = await supabase
        .from('wagers')
        .select('*')
        .eq('event_id', eventId)
        .is('deleted_at', null)
        .order('created_at')
      setWagers(ws ?? [])
    }
    const interval = setInterval(refreshWagers, 15000)
    return () => clearInterval(interval)
  }, [eventId])

  // ── Odds computation ─────────────────────────────────────────────
  const winPool   = wagers.filter(w => w.pick_1st).reduce((s, w) => s + parseFloat(w.amount), 0)
  const placePool = wagers.filter(w => w.pick_2nd).reduce((s, w) => s + parseFloat(w.amount), 0)
  const totalPot  = winPool + placePool

  const winTotals   = {}
  const placeTotals = {}
  for (const w of wagers) {
    if (w.pick_1st) winTotals[w.pick_1st]   = (winTotals[w.pick_1st]   ?? 0) + parseFloat(w.amount)
    if (w.pick_2nd) placeTotals[w.pick_2nd] = (placeTotals[w.pick_2nd] ?? 0) + parseFloat(w.amount)
  }

  const allPickedIds = [...new Set([...Object.keys(winTotals), ...Object.keys(placeTotals)])]
    .sort((a, b) => ((winTotals[b] ?? 0) + (placeTotals[b] ?? 0)) - ((winTotals[a] ?? 0) + (placeTotals[a] ?? 0)))

  function playerName(pid) {
    const ep = players.find(p => p.player_id === pid)
    if (!ep) return '—'
    return `${ep.player.first_name} ${ep.player.last_name}`
  }

  // Match pools — each match is its own two-way pool (Player A vs Player B)
  const matchStats = pairings.map(m => {
    const bets = wagers.filter(w => w.match_pairing_id === m.id)
    const sideAmt = { [m.player_a_id]: 0, [m.player_b_id]: 0 }
    for (const w of bets) sideAmt[w.pick_match] = (sideAmt[w.pick_match] ?? 0) + parseFloat(w.amount)
    const pool = (sideAmt[m.player_a_id] ?? 0) + (sideAmt[m.player_b_id] ?? 0)
    return { match: m, pool, sideAmt }
  })
  const matchPoolTotal = matchStats.reduce((s, m) => s + m.pool, 0)
  // Strokes each player receives in a match: the difference in match play handicaps,
  // given to the higher-handicap player (the lower handicap plays scratch).
  function matchStrokes(m) {
    const chA = matchCH(players.find(p => p.player_id === m.player_a_id)) ?? 0
    const chB = matchCH(players.find(p => p.player_id === m.player_b_id)) ?? 0
    const diff = Math.abs(chA - chB)
    return { [m.player_a_id]: chA > chB ? diff : 0, [m.player_b_id]: chB > chA ? diff : 0 }
  }
  const strokeLabel = n => (n > 0 ? ` (${n})` : '')
  const matchLabel = m => {
    const st = matchStrokes(m)
    return `Match ${m.match_number}: ${playerName(m.player_a_id)}${strokeLabel(st[m.player_a_id])} vs ${playerName(m.player_b_id)}${strokeLabel(st[m.player_b_id])}`
  }

  // ── Pick helpers ─────────────────────────────────────────────────
  function updatePick(id, field, value) {
    setPicks(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }
  function addPick()    { setPicks(prev => [...prev, emptyPick()]) }
  function removePick(id) { setPicks(prev => prev.filter(p => p.id !== id)) }

  // ── Submit ───────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault()
    if (!bettorName.trim()) { alert('Please enter your name.'); return }
    for (const p of picks) {
      if (p.kind === 'match') {
        if (!p.matchId || !p.matchPick) { alert('Please select a match and a winner for each match pick.'); return }
      } else if (!p.playerId) { alert('Please select a player for each pick.'); return }
      if (!isValidAmount(p.amount)) { alert(`Bets are ${fmt(MIN_BET)} minimum, in ${fmt(MIN_BET)} steps.`); return }
    }
    setSubmitting(true)

    const totalAmt = picks.reduce((s, p) => s + parseFloat(p.amount), 0)
    const memo = `${event.name} – ${bettorName.trim()} | ` +
      picks.map(p => p.kind === 'match'
        ? `${playerName(p.matchPick)} MATCH ${fmt(p.amount)}`
        : `${playerName(p.playerId)} ${p.position.toUpperCase()} ${fmt(p.amount)}`).join(', ')

    const rows = picks.map(p => p.kind === 'match'
      ? {
          event_id:          eventId,
          bettor_name:       bettorName.trim(),
          match_pairing_id:  p.matchId,
          pick_match:        p.matchPick,
          amount:            parseFloat(p.amount),
        }
      : {
          event_id:    eventId,
          bettor_name: bettorName.trim(),
          pick_1st:    p.position === 'win'   ? p.playerId : null,
          pick_2nd:    p.position === 'place' ? p.playerId : null,
          amount:      parseFloat(p.amount),
        })

    // Record how the bettor chose to pay. If the payment_method column hasn't been
    // added to the database yet, fall back to saving the bet without it rather
    // than failing the bet.
    let { error: insErr } = await supabase.from('wagers').insert(rows.map(r => ({ ...r, payment_method: payMethod })))
    if (insErr && /payment_method/i.test(insErr.message ?? '')) {
      ({ error: insErr } = await supabase.from('wagers').insert(rows))
    }
    if (insErr) { alert('Error saving bet: ' + insErr.message); setSubmitting(false); return }

    // Reload board (exclude soft-deleted)
    const { data: ws } = await supabase.from('wagers').select('*').eq('event_id', eventId).is('deleted_at', null).order('created_at')
    setWagers(ws ?? [])

    if (payMethod === 'venmo') {
      const handle = event.venmo_handle ?? 'MulligansIsland'
      setVenmoUrl(`https://venmo.com/?txn=pay&recipients=${handle}&amount=${totalAmt.toFixed(2)}&note=${encodeURIComponent(memo)}`)
    }

    setSubmitted(true)
    setSubmitting(false)
  }

  // ── Render ────────────────────────────────────────────────────
  const Notice = ({ children, tone = 'text-ink-muted' }) => (
    <div className={`flex min-h-screen items-center justify-center bg-surface-dim px-4 text-center font-sans ${tone}`}>{children}</div>
  )
  if (loading) return <Notice>Loading…</Notice>
  if (error)   return <Notice tone="text-red-600">{error}</Notice>

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  const closedReason = getBettingClosedReason(event)
  const total = totalOf(picks)
  const eventName = event.name ?? `Event #${event.event_number}`
  const meta = [eventName, event.course?.name, eventDate].filter(Boolean).join(' · ')

  function setKind(id, kind) {
    setPicks(prev => prev.map(p => {
      if (p.id !== id) return p
      return kind === 'match' ? { ...p, kind: 'match' } : { ...p, kind: 'field', position: kind }
    }))
  }
  const typeOf = p => (p.kind === 'match' ? 'match' : p.position)

  const poolTiles = [
    { label: 'Win pool', value: fmt(winPool) },
    { label: 'Place pool', value: fmt(placePool) },
    ...(pairings.length > 0 ? [{ label: 'Match pools', value: fmt(matchPoolTotal) }] : []),
  ]

  return (
    <div className="min-h-screen bg-surface-dim font-sans text-ink">
      <div className="mx-auto max-w-[560px] space-y-5 px-4 py-6">
        <WagerPageHeader
          leagueName={event.league?.name}
          logoUrl={event.league?.logo_url}
          title="Wager board"
          pill={{ tone: closedReason ? 'closed' : 'open', label: closedReason ? 'Betting closed' : 'Betting open' }}
          meta={meta}
        />

        <StatTiles tiles={poolTiles} className={pairings.length > 0 ? '!grid-cols-3' : '!grid-cols-2'} />

        {closedReason && (
          <div className="rounded-sm border border-surface-border bg-white px-5 py-8 text-center">
            <h2 className="text-lg font-bold text-ink">Betting is closed</h2>
            <p className="mt-1 text-sm text-ink-muted">{closedReason}</p>
            <Button as={Link} to={`/wager/${eventId}/results`} className="mt-4" variant="secondary">View odds & results →</Button>
          </div>
        )}

        {!closedReason && !submitted && (
          <form onSubmit={handleSubmit} className="rounded-sm border border-surface-border bg-white p-4 sm:p-5">
            <h2 className="text-lg font-bold text-ink">Place your bets</h2>

            <div className="mt-4 flex flex-col gap-4">
              <div>
                <label htmlFor="bettor-name" className={labelClass}>Your name</label>
                <input
                  id="bettor-name" list="bettor-names" type="text" value={bettorName}
                  onChange={e => setBettorName(e.target.value)} placeholder="First Last" required autoComplete="name"
                  className={selectClass}
                />
                <datalist id="bettor-names">
                  {players.map(ep => `${ep.player.first_name} ${ep.player.last_name}`).sort((a, b) => a.localeCompare(b)).map(n => <option key={n} value={n} />)}
                </datalist>
              </div>

              {picks.map((pick, idx) => (
                <PickCard key={pick.id} index={idx} canRemove={picks.length > 1} onRemove={() => removePick(pick.id)}>
                  <PickTypeToggle value={typeOf(pick)} onChange={k => setKind(pick.id, k)} withMatch={pairings.length > 0} />

                  {pick.kind === 'match' ? (
                    <>
                      <div>
                        <label htmlFor={`match-${pick.id}`} className={labelClass}>Match</label>
                        <select
                          id={`match-${pick.id}`} className={selectClass} value={pick.matchId}
                          onChange={e => setPicks(prev => prev.map(p => p.id === pick.id ? { ...p, matchId: e.target.value, matchPick: '' } : p))}
                        >
                          <option value="">Select match</option>
                          {pairings.map(m => <option key={m.id} value={m.id}>{matchLabel(m)}</option>)}
                        </select>
                      </div>
                      {pick.matchId && (() => {
                        const m = pairings.find(x => x.id === pick.matchId)
                        if (!m) return null
                        const strokes = matchStrokes(m)
                        return (
                          <div>
                            <span className={labelClass}>Who wins?</span>
                            <div className="grid grid-cols-2 gap-2">
                              {[m.player_a_id, m.player_b_id].map(pid => {
                                const on = pick.matchPick === pid
                                return (
                                  <button
                                    key={pid} type="button" aria-pressed={on} onClick={() => updatePick(pick.id, 'matchPick', pid)}
                                    className={`min-h-[52px] rounded-sm border px-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 ${on ? 'border-fairway-700 bg-fairway-700 text-white' : 'border-surface-highest bg-white text-ink hover:bg-surface-dim'}`}
                                  >
                                    {playerName(pid)}{strokeLabel(strokes[pid])}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })()}
                    </>
                  ) : (
                    <div>
                      <label htmlFor={`player-${pick.id}`} className={labelClass}>Player</label>
                      <select id={`player-${pick.id}`} className={selectClass} value={pick.playerId} onChange={e => updatePick(pick.id, 'playerId', e.target.value)} required>
                        <option value="">Select player</option>
                        {[...players]
                          .sort((a, b) => `${a.player.first_name} ${a.player.last_name}`.localeCompare(`${b.player.first_name} ${b.player.last_name}`))
                          .map(ep => (
                            <option key={ep.player_id} value={ep.player_id}>
                              {ep.player.first_name} {ep.player.last_name}{ep.course_handicap != null ? ` (CH ${ep.course_handicap})` : ''}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <AmountStepper id={`amount-${pick.id}`} value={pick.amount} onChange={v => updatePick(pick.id, 'amount', v)} />
                </PickCard>
              ))}

              <button
                type="button" onClick={addPick}
                className="flex min-h-[48px] w-full items-center justify-center rounded-sm border border-dashed border-fairway-700 text-sm font-semibold text-fairway-700 hover:bg-fairway-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
              >
                + Add another pick
              </button>

              <div>
                <span className={labelClass}>How will you pay?</span>
                <div role="group" aria-label="How will you pay?" className="grid grid-cols-2 overflow-hidden rounded-sm border border-surface-highest">
                  {[['venmo', 'Venmo'], ['cash', 'Cash']].map(([val, text], i) => (
                    <button
                      key={val} type="button" aria-pressed={payMethod === val} onClick={() => setPayMethod(val)}
                      className={`min-h-[48px] text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 ${i > 0 ? 'border-l border-surface-highest' : ''} ${payMethod === val ? 'bg-fairway-700 text-white' : 'bg-white text-ink hover:bg-surface-dim'}`}
                    >
                      {text}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-ink-muted">
                  {payMethod === 'venmo' ? 'You’ll get a Venmo payment link right after you place your bets.' : 'Pay cash to the club before tee time.'}
                </p>
              </div>

              <div className="flex items-center justify-between rounded-sm bg-surface-dim px-4 py-3 text-sm">
                <span className="text-ink-muted">{picks.length} pick{picks.length === 1 ? '' : 's'}</span>
                <span className="text-base font-bold tabular-nums text-ink">{fmt(total)}</span>
              </div>

              <button
                type="submit" disabled={submitting}
                className="flex min-h-[52px] w-full items-center justify-center rounded-sm bg-fairway-700 px-4 text-[15px] font-bold text-white transition-colors hover:bg-fairway-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Submitting…' : `Place bets · ${fmt(total)}`}
              </button>
              <p className="-mt-2 text-center text-xs text-ink-muted">Bets are final once submitted.</p>
            </div>
          </form>
        )}

        {!closedReason && submitted && (() => {
          // The ticket is rebuilt from the bets just saved (no extra stored data); the submit handler is untouched.
          const ticket = latestTicketFor(groupTickets(wagers, { eventId, leagueName: event.league?.name }), bettorName)
          const placeAnother = () => { setSubmitted(false); setPicks([emptyPick()]); setBettorName(''); setVenmoUrl(null) }
          const view = ticket && buildTicketView({
            ticket, pairings, final: false,
            nameOf: playerName,
            lastNameOf: pid => playerName(pid).split(' ').slice(1).join(' ') || playerName(pid),
          })
          return (
            <div>
              <div className="mx-auto flex max-w-[420px] items-start gap-3 rounded-sm border border-fairway-200 bg-status-active-bg px-4 py-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-fairway-700 text-white" aria-hidden="true">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                </span>
                <div>
                  <h2 className="text-[15px] font-bold text-status-active-text">Bets placed</h2>
                  <p className="text-sm text-status-active-text">Save this ticket. It updates when results are final.</p>
                </div>
              </div>

              <div className="mx-auto mt-3 max-w-[420px]">
                {payMethod === 'venmo' && venmoUrl && (
                  <a
                    href={venmoUrl} target="_blank" rel="noopener noreferrer"
                    className="mb-3 flex min-h-[48px] items-center justify-center rounded-sm px-6 text-sm font-bold text-white no-underline"
                    style={{ background: '#008CFF' }}
                  >
                    Pay via Venmo
                  </a>
                )}
                {payMethod === 'cash' && (
                  <div className="mb-3 rounded-sm bg-status-active-bg px-4 py-3 text-sm font-semibold text-status-active-text">
                    Pay cash to the club before tee time.
                  </div>
                )}
              </div>

              {view ? (
                <>
                  <div ref={ticketRef} className="mt-2">
                    <WagerTicket view={view} leagueName={event.league?.name} logoUrl={ticketLogo} eventName={eventName} />
                  </div>
                  <TicketActions
                    captureRef={ticketRef}
                    ticketId={view.id}
                    ticketUrl={`${window.location.origin}/wager/${eventId}/ticket/${view.id}`}
                    ready={ticketLogoReady}
                    eventId={eventId}
                    placeMore={{ onClick: placeAnother }}
                  />
                </>
              ) : (
                <div className="mt-3 text-center">
                  <Button variant="secondary" onClick={placeAnother}>Place another bet</Button>
                </div>
              )}
            </div>
          )
        })()}

        {allPickedIds.length > 0 && (
          <Card title="Live odds" aside={`Win ${fmt(winPool)} · Place ${fmt(placePool)}`}>
            <div className="grid grid-cols-[1fr_84px_84px] gap-2 border-b border-surface-border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <span>Player</span><span className="text-right">Win</span><span className="text-right">Place</span>
            </div>
            {allPickedIds.map(pid => {
              const wAmt = winTotals[pid] ?? 0
              const pAmt = placeTotals[pid] ?? 0
              const winOdds   = wAmt > 0 && winPool > 0 ? (winPool / wAmt).toFixed(2) : null
              const placeOdds = pAmt > 0 && placePool > 0 ? (placePool / pAmt).toFixed(2) : null
              return (
                <div key={pid} className="grid grid-cols-[1fr_84px_84px] items-center gap-2 border-b border-surface-border px-4 py-2.5 text-sm last:border-b-0">
                  <span className="min-w-0 break-words font-bold text-ink">{playerName(pid)}</span>
                  <span className="text-right tabular-nums">{winOdds ? <>{fmt(wAmt)}<span className="block text-[11px] text-ink-muted">{winOdds}x</span></> : <span className="text-ink-muted">—</span>}</span>
                  <span className="text-right tabular-nums">{placeOdds ? <>{fmt(pAmt)}<span className="block text-[11px] text-ink-muted">{placeOdds}x</span></> : <span className="text-ink-muted">—</span>}</span>
                </div>
              )
            })}
          </Card>
        )}

        {matchStats.length > 0 && (
          <Card title="Match play odds" aside={`Each match is its own pool · Total ${fmt(matchPoolTotal)}`}>
            <p className="border-b border-surface-border px-4 py-2 text-xs text-ink-muted">(#) = strokes received. The player with no number is the lower handicap and plays scratch.</p>
            {matchStats.map(({ match, pool, sideAmt }) => {
              const strokes = matchStrokes(match)
              return (
                <div key={match.id} className="border-b border-surface-border px-4 py-3 last:border-b-0">
                  <div className="flex justify-between text-xs font-semibold text-ink-muted">
                    <span>Match {match.match_number}</span><span>Pool {fmt(pool)}</span>
                  </div>
                  {[match.player_a_id, match.player_b_id].map(pid => {
                    const amt = sideAmt[pid] ?? 0
                    return (
                      <div key={pid} className="flex justify-between py-0.5 text-sm">
                        <span className="font-bold text-ink">{playerName(pid)}{strokes[pid] > 0 && <span className="font-normal text-ink-muted">{strokeLabel(strokes[pid])}</span>}</span>
                        <span className="tabular-nums">{amt > 0 ? <>{fmt(amt)} <span className="text-[11px] text-ink-muted">{(pool / amt).toFixed(2)}x</span></> : <span className="text-ink-muted">—</span>}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </Card>
        )}

        <details className="group rounded-sm border border-surface-border bg-white">
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-ink [&::-webkit-details-marker]:hidden">
            <span>How payouts work</span>
            <svg className="text-ink-muted transition-transform group-open:rotate-180" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
          </summary>
          <ul className="list-disc space-y-1.5 border-t border-surface-border px-4 py-3 pl-8 text-sm text-ink-muted">
            <li>The whole pool is paid to the winner(s), pro rata to stake. Your payout includes your stake.</li>
            <li>WIN pays on the low net score. PLACE pays for 1st or 2nd, split 50/50, stake back plus a share of the profit.</li>
            <li>If no one picks the winner, the funds roll to the club.</li>
            <li>Match bets are refunded if the match is halved.</li>
            <li>Bets are final once submitted.</li>
          </ul>
        </details>

        <p className="text-center">
          <Link to={`/wager/${eventId}/results`} className="inline-flex min-h-[44px] items-center text-sm font-semibold text-fairway-700 underline">View odds & results →</Link>
        </p>
      </div>
    </div>
  )
}
