/**
 * Wager.jsx — Public parimutuel wager page
 * Route: /wager/:eventId
 * Anyone with the link can place a bet on players in the field.
 * MIGC-only (Mulligan's Island Golf Club).
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MIGC_ORG  = import.meta.env.VITE_MIGC_ORG_ID
const GREEN     = '#1B4332'
const GOLD      = '#C9A84C'
const MIN_BET   = 5
const STEP      = 5

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
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState(null)

  // Form state
  const [bettorName,   setBettorName]   = useState('')
  const [picks,        setPicks]        = useState([emptyPick()])
  const [submitted,    setSubmitted]    = useState(false)
  const [submitting,   setSubmitting]   = useState(false)
  const [venmoUrl,     setVenmoUrl]     = useState(null)
  const [payMethod,    setPayMethod]    = useState('venmo') // 'venmo' | 'cash'

  function emptyPick() {
    return { id: Math.random(), playerId: '', position: 'win', amount: '' }
  }

  useEffect(() => {
    async function load() {
      // Load event + verify MIGC org
      const { data: ev } = await supabase
        .from('events')
        .select('*, league:leagues(name, org_id)')
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
        .select('player_id, player:players(first_name, last_name)')
        .eq('event_id', eventId)
        .order('flight').order('adjusted_handicap_index')
      setPlayers((eps ?? []).filter(ep => ep.player && typeof ep.player === 'object'))

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
      if (!p.playerId) { alert('Please select a player for each pick.'); return }
      if (!p.amount || parseFloat(p.amount) < MIN_BET) { alert(`Minimum bet is ${fmt(MIN_BET)}.`); return }
    }
    setSubmitting(true)

    const totalAmt = picks.reduce((s, p) => s + parseFloat(p.amount), 0)
    const memo = `${event.name} – ${bettorName.trim()} | ` +
      picks.map(p => `${playerName(p.playerId)} ${p.position.toUpperCase()} ${fmt(p.amount)}`).join(', ')

    const rows = picks.map(p => ({
      event_id:    eventId,
      bettor_name: bettorName.trim(),
      pick_1st:    p.position === 'win'   ? p.playerId : null,
      pick_2nd:    p.position === 'place' ? p.playerId : null,
      amount:      parseFloat(p.amount),
    }))

    const { error: insErr } = await supabase.from('wagers').insert(rows)
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

  // ── Render ───────────────────────────────────────────────────────
  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Schibsted Grotesk', sans-serif", color: '#6b7280' }}>Loading…</div>
  if (error)   return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Schibsted Grotesk', sans-serif", color: '#dc2626' }}>{error}</div>

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div style={{ minHeight: '100vh', background: '#f9f8f5', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
      {/* Header */}
      <div style={{ background: GREEN, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 16 }}>Mulligan's Island Golf Club</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>{event.name} · Wager Board</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>{eventDate}</div>
        </div>
        <Link to={`/wager/${eventId}/board`} style={{ fontSize: 12, fontWeight: 600, color: GOLD, textDecoration: 'none', border: `1px solid ${GOLD}`, borderRadius: 8, padding: '5px 10px' }}>
          View Board
        </Link>
      </div>

      <div style={{ maxWidth: 560, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Live odds summary */}
        {allPickedIds.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: GREEN, padding: '10px 16px' }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Live Odds Board</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11, marginLeft: 10 }}>
                WIN pool {fmt(winPool)} · PLACE pool {fmt(placePool)} · Total {fmt(totalPot)}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4f2' }}>
                  <th style={{ padding: '6px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Player</th>
                  <th style={{ padding: '6px 12px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>WIN</th>
                  <th style={{ padding: '6px 12px', textAlign: 'center', color: '#1d4ed8', fontWeight: 700 }}>PLACE</th>
                </tr>
              </thead>
              <tbody>
                {allPickedIds.map((pid, i) => {
                  const wAmt = winTotals[pid]   ?? 0
                  const pAmt = placeTotals[pid] ?? 0
                  const winOdds   = wAmt > 0 && winPool   > 0 ? (winPool   / wAmt).toFixed(2) : null
                  const placeOdds = pAmt > 0 && placePool > 0 ? (placePool / pAmt).toFixed(2) : null
                  return (
                    <tr key={pid} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#111' }}>{playerName(pid)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {winOdds ? <><span style={{ fontWeight: 700, color: '#16a34a' }}>{fmt(wAmt)}</span><br/><span style={{ color: '#9ca3af', fontSize: 10 }}>{winOdds}x</span></> : <span style={{ color: '#e5e7eb' }}>—</span>}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        {placeOdds ? <><span style={{ fontWeight: 700, color: '#1d4ed8' }}>{fmt(pAmt)}</span><br/><span style={{ color: '#9ca3af', fontSize: 10 }}>{placeOdds}x</span></> : <span style={{ color: '#e5e7eb' }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Betting closed */}
        {getBettingClosedReason(event) && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: '28px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Betting is closed</div>
            <div style={{ fontSize: 13, color: '#9ca3af' }}>{getBettingClosedReason(event)}</div>
          </div>
        )}

        {/* Bet form */}
        {!getBettingClosedReason(event) && !submitted && (
          <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: GREEN, padding: '10px 16px' }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Place a Bet</span>
            </div>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Bettor name */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 4 }}>Your Name</label>
                <input
                  type="text"
                  value={bettorName}
                  onChange={e => setBettorName(e.target.value)}
                  placeholder="First Last"
                  required
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>

              {/* Picks */}
              {picks.map((pick, idx) => (
                <div key={pick.id} style={{ background: '#f9f8f5', borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>Pick {idx + 1}</span>
                    {picks.length > 1 && (
                      <button type="button" onClick={() => removePick(pick.id)} style={{ fontSize: 11, color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Remove</button>
                    )}
                  </div>

                  {/* Player select */}
                  <select
                    value={pick.playerId}
                    onChange={e => updatePick(pick.id, 'playerId', e.target.value)}
                    required
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, background: '#fff', boxSizing: 'border-box' }}
                  >
                    <option value="">— Select player —</option>
                    {players.map(ep => (
                      <option key={ep.player_id} value={ep.player_id}>
                        {ep.player.first_name} {ep.player.last_name}
                      </option>
                    ))}
                  </select>

                  {/* WIN / PLACE toggle */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['win', 'place'].map(pos => (
                      <button
                        key={pos}
                        type="button"
                        onClick={() => updatePick(pick.id, 'position', pos)}
                        style={{
                          flex: 1, padding: '7px 0', borderRadius: 8, border: '2px solid',
                          borderColor: pick.position === pos ? (pos === 'win' ? '#16a34a' : '#1d4ed8') : '#e5e7eb',
                          background: pick.position === pos ? (pos === 'win' ? '#f0fdf4' : '#eff6ff') : '#fff',
                          color: pick.position === pos ? (pos === 'win' ? '#16a34a' : '#1d4ed8') : '#9ca3af',
                          fontWeight: 700, fontSize: 13, cursor: 'pointer',
                        }}
                      >
                        {pos === 'win' ? 'WIN (1st)' : 'PLACE (2nd)'}
                      </button>
                    ))}
                  </div>

                  {/* Amount */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>$</span>
                    <input
                      type="number"
                      min={MIN_BET}
                      step={STEP}
                      value={pick.amount}
                      onChange={e => updatePick(pick.id, 'amount', e.target.value)}
                      placeholder="5"
                      required
                      style={{ width: 90, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                    />
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Min ${MIN_BET} · ${STEP} increments</span>
                  </div>
                </div>
              ))}

              <button type="button" onClick={addPick} style={{ fontSize: 13, fontWeight: 600, color: GREEN, background: 'none', border: `1px dashed ${GREEN}`, borderRadius: 8, padding: '8px 0', cursor: 'pointer' }}>
                + Add Another Pick
              </button>

              {/* Payment method */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Payment Method</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[['venmo', 'Venmo'], ['cash', 'Cash']].map(([val, label]) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setPayMethod(val)}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 8, border: '2px solid',
                        borderColor: payMethod === val ? GREEN : '#e5e7eb',
                        background: payMethod === val ? '#f0fdf4' : '#fff',
                        color: payMethod === val ? GREEN : '#9ca3af',
                        fontWeight: 700, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                style={{ background: GREEN, color: '#fff', fontWeight: 700, fontSize: 15, padding: '12px 0', borderRadius: 10, border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Submitting…' : 'Submit Bet'}
              </button>
            </div>
          </form>
        )}

        {/* Confirmation */}
        {!getBettingClosedReason(event) && submitted && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', padding: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: GREEN, marginBottom: 4 }}>Bet Submitted!</div>
            <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>Good luck, {bettorName}.</div>

            {payMethod === 'venmo' && venmoUrl && (
              <a
                href={venmoUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'inline-block', background: '#008CFF', color: '#fff', fontWeight: 700, fontSize: 14, padding: '10px 24px', borderRadius: 10, textDecoration: 'none', marginBottom: 12 }}
              >
                Pay via Venmo
              </a>
            )}
            {payMethod === 'cash' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '10px 16px', fontSize: 13, color: GREEN, fontWeight: 600, marginBottom: 12 }}>
                Pay cash to the club before tee time.
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 8 }}>
              <button
                onClick={() => { setSubmitted(false); setPicks([emptyPick()]); setBettorName(''); setVenmoUrl(null) }}
                style={{ fontSize: 13, fontWeight: 600, color: GREEN, background: '#f0fdf4', border: `1px solid ${GREEN}`, borderRadius: 8, padding: '8px 16px', cursor: 'pointer' }}
              >
                Place Another Bet
              </button>
              <Link
                to={`/wager/${eventId}/board`}
                style={{ fontSize: 13, fontWeight: 600, color: '#fff', background: GREEN, border: 'none', borderRadius: 8, padding: '8px 16px', textDecoration: 'none' }}
              >
                View Board
              </Link>
            </div>
          </div>
        )}

        <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
          Full pool paid to winner(s). If no one picks the winner, funds roll to the club. Bets are final once submitted.
        </p>
      </div>
    </div>
  )
}
