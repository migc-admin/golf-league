/**
 * WagerAdmin.jsx — Admin wager board
 * Route: /wager/:eventId/board
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { computeWagerSettlement, wagerOutcomes } from '../lib/wagerSettlement'

const MIGC_ORG = import.meta.env.VITE_MIGC_ORG_ID
const GREEN    = '#1B4332'
const GOLD     = '#C9A84C'

function fmt(n) { return `$${Number(n).toFixed(2)}` }

async function fetchWagers(eventId) {
  const { data } = await supabase
    .from('wagers')
    .select('*')
    .eq('event_id', eventId)
    .order('created_at')
  return data ?? []
}

/** Returns true if betting should be auto-closed (within 10 min of start or past) */
function isTeeTimePast(event) {
  if (!event.event_date || !event.start_time) return false
  const teeTime = new Date(`${event.event_date}T${event.start_time.slice(0, 8)}`)
  return Date.now() >= teeTime.getTime() - 10 * 60 * 1000
}

export default function WagerAdmin() {
  const { eventId } = useParams()
  const { isAdmin, loading: authLoading } = useAuth()

  const [event,       setEvent]       = useState(null)
  const [players,     setPlayers]     = useState([])
  const [wagers,      setWagers]      = useState([])
  const [scores,      setScores]      = useState([])
  const [pairings,    setPairings]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [acting,      setActing]      = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [toggling,    setToggling]    = useState(false)
  const [exporting,   setExporting]   = useState(false)

  async function loadData() {
    const { data: ev } = await supabase
      .from('events')
      .select('*, course:courses(*), league:leagues(name, org_id)')
      .eq('id', eventId).single()

    if (!ev || ev.league?.org_id !== MIGC_ORG) {
      setError('This wager board is not available.')
      setLoading(false)
      return
    }
    setEvent(ev)

    const { data: eps } = await supabase
      .from('event_players')
      .select('*, player:players(first_name, last_name)')
      .eq('event_id', eventId)
    setPlayers(eps ?? [])

    setWagers(await fetchWagers(eventId))

    // Scores always loaded — used for live leaderboard during active event too
    const { data: sc } = await supabase
      .from('scores')
      .select('player_id, hole_number, gross_score')
      .eq('event_id', eventId)
    setScores(sc ?? [])

    // Match play pairings — drives match wager pools and settlement
    const { data: mp } = await supabase
      .from('match_pairings')
      .select('*')
      .eq('event_id', eventId)
      .order('match_number')
    setPairings(mp ?? [])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(async () => {
      setWagers(await fetchWagers(eventId))
    }, 15000)
    return () => clearInterval(interval)
  }, [eventId])

  function playerName(pid) {
    if (!pid) return '—'
    const ep = players.find(p => p.player_id === pid)
    if (!ep) return '—'
    return `${ep.player.first_name} ${ep.player.last_name}`
  }

  async function toggleBettingClosed() {
    setToggling(true)
    const next = !event.wagers_closed
    await supabase.from('events').update({ wagers_closed: next }).eq('id', eventId)
    setEvent(prev => ({ ...prev, wagers_closed: next }))
    setToggling(false)
  }

  async function setPaymentMethod(id, method) {
    setActing(id)
    const { error: upErr } = await supabase.from('wagers').update({ payment_method: method || null }).eq('id', id)
    if (upErr) alert('Could not save payment method: ' + upErr.message)
    setWagers(await fetchWagers(eventId))
    setActing(null)
  }

  async function softDelete(id) {
    if (!window.confirm('Remove this bet? It will be saved and can be restored.')) return
    setActing(id)
    await supabase.from('wagers').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    setWagers(await fetchWagers(eventId))
    setActing(null)
  }

  async function restore(id) {
    setActing(id)
    await supabase.from('wagers').update({ deleted_at: null }).eq('id', id)
    setWagers(await fetchWagers(eventId))
    setActing(null)
  }

  async function clearAll() {
    if (!window.confirm('Remove ALL active bets? They will be saved and can be restored individually.')) return
    await supabase.from('wagers').update({ deleted_at: new Date().toISOString() }).eq('event_id', eventId).is('deleted_at', null)
    setWagers(await fetchWagers(eventId))
  }

  if (authLoading || loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif", color: '#6b7280' }}>Loading…</div>
  if (!isAdmin) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif", flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>Access Denied</div><div style={{ fontSize: 13, color: '#6b7280' }}>Admin login required.</div><a href="/login" style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: GREEN }}>Sign in →</a></div>
  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Manrope', sans-serif", color: '#dc2626' }}>{error}</div>

  const active  = wagers.filter(w => !w.deleted_at)
  const deleted = wagers.filter(w =>  w.deleted_at)

  // Pool math, winners and payouts live in lib/wagerSettlement.js (unit tested).
  const settlement = computeWagerSettlement({ active, players, scores, pairings, course: event.course, matchRules: event.match_rules })
  const {
    winPool, placePool, totalPot, winTotals, placeTotals, allPickedIds,
    winResults, placeResults, matchCards, matchPoolTotal,
  } = settlement

  // Excel export of every bet (including removed ones) for tracking payments and payouts.
  async function exportExcel() {
    setExporting(true)
    try {
      const [{ default: ExcelJS }, { buildWagerWorkbook, downloadWorkbook, wagerExportFilename }] = await Promise.all([
        import('exceljs'),
        import('../lib/wagerExport'),
      ])
      const workbook = buildWagerWorkbook(ExcelJS, {
        event, wagers, pairings, nameOf: playerName,
        outcomes: wagerOutcomes(settlement, active, event.status),
        settlement,
      })
      await downloadWorkbook(workbook, wagerExportFilename(event))
    } catch (err) {
      console.error('Wager export failed:', err)
      alert('Could not create the Excel file: ' + (err?.message ?? err))
    } finally {
      setExporting(false)
    }
  }

  // Who owes what and how: active bets grouped by bettor, split by payment method.
  const payByBettor = {}
  for (const w of active) {
    const key = w.bettor_name.trim().toLowerCase()
    const row = (payByBettor[key] ??= { name: w.bettor_name.trim(), venmo: 0, cash: 0, unset: 0 })
    row[w.payment_method === 'venmo' ? 'venmo' : w.payment_method === 'cash' ? 'cash' : 'unset'] += parseFloat(w.amount)
  }
  const payRows = Object.values(payByBettor).sort((a, b) => a.name.localeCompare(b.name))
  const payTotals = payRows.reduce((t, r) => ({ venmo: t.venmo + r.venmo, cash: t.cash + r.cash, unset: t.unset + r.unset }), { venmo: 0, cash: 0, unset: 0 })

  const showResults = event.status === 'complete' || event.status === 'active'
  const autoClosed  = isTeeTimePast(event)
  const bettingOpen = !event.wagers_closed && !autoClosed && event.status !== 'complete'

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const BettorTable = ({ bettors, color, border, playerName }) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
      <thead>
        <tr style={{ borderBottom: `1px solid ${border}` }}>
          <th style={{ textAlign: 'left',  padding: '4px 0', color, fontWeight: 700 }}>Bettor</th>
          <th style={{ textAlign: 'left',  padding: '4px 0', color, fontWeight: 700 }}>Picked</th>
          <th style={{ textAlign: 'right', padding: '4px 0', color, fontWeight: 700 }}>Stake</th>
          <th style={{ textAlign: 'right', padding: '4px 0', color, fontWeight: 700 }}>Payout</th>
        </tr>
      </thead>
      <tbody>
        {bettors.map((b, i) => (
          <tr key={i} style={{ borderBottom: `1px solid ${border}` }}>
            <td style={{ padding: '6px 0', fontWeight: 700, color: '#111' }}>{b.name}</td>
            <td style={{ padding: '6px 0', color: '#374151' }}>{playerName(b.pid)}</td>
            <td style={{ padding: '6px 0', textAlign: 'right', color: '#6b7280' }}>{fmt(b.bet)}</td>
            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 900, color }}>{fmt(b.payout)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )

  const BetRow = ({ w, isDeleted }) => (
    <tr style={{ borderTop: '1px solid #f3f4f6', background: isDeleted ? '#fef2f2' : 'transparent', opacity: isDeleted ? 0.75 : 1 }}>
      <td style={{ padding: '9px 12px', fontWeight: 700, color: '#111' }}>{w.bettor_name}</td>
      <td style={{ padding: '9px 12px', color: '#374151' }}>{playerName(w.pick_1st ?? w.pick_2nd ?? w.pick_match)}</td>
      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
        {w.match_pairing_id
          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 6, padding: '2px 7px' }}>MATCH</span>
          : w.pick_1st
          ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 7px' }}>WIN</span>
          : <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 7px' }}>PLACE</span>
        }
      </td>
      <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{fmt(w.amount)}</td>
      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
        {isDeleted ? (
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{w.payment_method ? w.payment_method.toUpperCase() : '—'}</span>
        ) : (
          <select
            value={w.payment_method ?? ''}
            disabled={acting === w.id}
            onChange={e => setPaymentMethod(w.id, e.target.value)}
            style={{
              fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 4px', cursor: 'pointer',
              border: `1px solid ${w.payment_method === 'cash' ? '#bbf7d0' : w.payment_method === 'venmo' ? '#bfdbfe' : '#e5e7eb'}`,
              background: w.payment_method === 'cash' ? '#f0fdf4' : w.payment_method === 'venmo' ? '#eff6ff' : '#fff',
              color: w.payment_method === 'cash' ? '#16a34a' : w.payment_method === 'venmo' ? '#1d4ed8' : '#9ca3af',
            }}
          >
            <option value="">— not set</option>
            <option value="venmo">Venmo</option>
            <option value="cash">Cash</option>
          </select>
        )}
      </td>
      <td style={{ padding: '9px 12px', textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
        {new Date(w.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
      </td>
      <td style={{ padding: '9px 12px', textAlign: 'center' }}>
        {isDeleted ? (
          <button onClick={() => restore(w.id)} disabled={acting === w.id}
            style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'none', border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', opacity: acting === w.id ? 0.5 : 1 }}>
            {acting === w.id ? '…' : 'Restore'}
          </button>
        ) : (
          <button onClick={() => softDelete(w.id)} disabled={acting === w.id}
            style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', opacity: acting === w.id ? 0.5 : 1 }}>
            {acting === w.id ? '…' : 'Delete'}
          </button>
        )}
      </td>
    </tr>
  )

  const tableHead = (
    <thead>
      <tr style={{ background: '#f9fafb' }}>
        <th style={{ padding: '8px 12px', textAlign: 'left',   color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Bettor</th>
        <th style={{ padding: '8px 12px', textAlign: 'left',   color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Pick</th>
        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Type</th>
        <th style={{ padding: '8px 12px', textAlign: 'right',  color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Amt</th>
        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Pay</th>
        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Time</th>
        <th style={{ padding: '8px 12px' }}></th>
      </tr>
    </thead>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f9f8f5', fontFamily: "'Manrope', sans-serif" }}>
      {/* Header */}
      <div style={{ background: GREEN, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 16 }}>Mulligan's Island Golf Club</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>{event.name} · Wager Board — Admin</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>{eventDate}</div>
        </div>
        <Link to={`/wager/${eventId}`} style={{ fontSize: 12, fontWeight: 600, color: GOLD, textDecoration: 'none', border: `1px solid ${GOLD}`, borderRadius: 8, padding: '5px 10px' }}>
          Public Page ↗
        </Link>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Betting Status Control */}
        {event.status !== 'complete' && (
          <div style={{ background: '#fff', borderRadius: 14, border: `1px solid ${bettingOpen ? '#bbf7d0' : '#fecaca'}`, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, color: bettingOpen ? '#16a34a' : '#dc2626' }}>
                {bettingOpen ? '🟢 Betting Open' : autoClosed ? '🔴 Auto-Closed (Tee Time)' : '🔴 Betting Closed'}
              </div>
              {autoClosed && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Automatically closed 10 min before tee time</div>
              )}
              {event.wagers_closed && !autoClosed && (
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Manually closed by admin</div>
              )}
            </div>
            {!autoClosed && (
              <button
                onClick={toggleBettingClosed}
                disabled={toggling}
                style={{
                  fontSize: 12, fontWeight: 700, padding: '7px 14px', borderRadius: 8, border: 'none', cursor: toggling ? 'not-allowed' : 'pointer',
                  background: bettingOpen ? '#dc2626' : '#16a34a',
                  color: '#fff', opacity: toggling ? 0.6 : 1,
                }}
              >
                {toggling ? '…' : bettingOpen ? 'Close Betting' : 'Reopen Betting'}
              </button>
            )}
          </div>
        )}

        {/* Pool Summary */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: GREEN, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Pool Summary</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{active.length} active bet{active.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${matchPoolTotal > 0 ? 4 : 3}, 1fr)`, padding: '14px 16px', gap: 8 }}>
            {[
              ['WIN Pool', fmt(winPool), '#16a34a'],
              ['PLACE Pool', fmt(placePool), '#1d4ed8'],
              ...(matchPoolTotal > 0 ? [['Match Pool', fmt(matchPoolTotal), '#7c3aed']] : []),
              ['Total Pot', fmt(totalPot + matchPoolTotal), GREEN],
            ].map(([label, val, color]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Payments: who owes what, and how they chose to pay */}
        {payRows.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: GREEN, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Payments</span>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11 }}>
                Venmo {fmt(payTotals.venmo)} · Cash {fmt(payTotals.cash)}{payTotals.unset > 0 ? ` · Not set ${fmt(payTotals.unset)}` : ''}
              </span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4f2' }}>
                  <th style={{ padding: '7px 12px', textAlign: 'left',  color: '#6b7280', fontWeight: 700 }}>Bettor</th>
                  <th style={{ padding: '7px 12px', textAlign: 'right', color: '#1d4ed8', fontWeight: 700 }}>Venmo</th>
                  <th style={{ padding: '7px 12px', textAlign: 'right', color: '#16a34a', fontWeight: 700 }}>Cash</th>
                  <th style={{ padding: '7px 12px', textAlign: 'right', color: '#9ca3af', fontWeight: 700 }}>Not set</th>
                  <th style={{ padding: '7px 12px', textAlign: 'right', color: '#111', fontWeight: 700 }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {payRows.map((r, i) => (
                  <tr key={r.name} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '7px 12px', fontWeight: 700, color: '#111' }}>{r.name}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: r.venmo ? '#1d4ed8' : '#d1d5db' }}>{r.venmo ? fmt(r.venmo) : '—'}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: r.cash ? '#16a34a' : '#d1d5db' }}>{r.cash ? fmt(r.cash) : '—'}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', color: r.unset ? '#6b7280' : '#d1d5db' }}>{r.unset ? fmt(r.unset) : '—'}</td>
                    <td style={{ padding: '7px 12px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{fmt(r.venmo + r.cash + r.unset)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Odds Board */}
        {allPickedIds.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: GREEN, padding: '10px 16px' }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Live Odds</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4f2' }}>
                  <th style={{ padding: '7px 12px', textAlign: 'left',   color: '#6b7280', fontWeight: 700 }}>Player</th>
                  <th style={{ padding: '7px 12px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>WIN Amt</th>
                  <th style={{ padding: '7px 12px', textAlign: 'center', color: '#16a34a', fontWeight: 700 }}>WIN Odds</th>
                  <th style={{ padding: '7px 12px', textAlign: 'center', color: '#1d4ed8', fontWeight: 700 }}>PLACE Amt</th>
                  <th style={{ padding: '7px 12px', textAlign: 'center', color: '#1d4ed8', fontWeight: 700 }}>PLACE Odds</th>
                </tr>
              </thead>
              <tbody>
                {allPickedIds.map((pid, i) => {
                  const wAmt = winTotals[pid]   ?? 0
                  const pAmt = placeTotals[pid] ?? 0
                  const winOdds   = wAmt > 0 && winPool   > 0 ? (winPool   / wAmt).toFixed(2) + 'x' : '—'
                  const placeOdds = pAmt > 0 && placePool > 0 ? (placePool / pAmt).toFixed(2) + 'x' : '—'
                  return (
                    <tr key={pid} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                      <td style={{ padding: '8px 12px', fontWeight: 700, color: '#111' }}>{playerName(pid)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#16a34a', fontWeight: 600 }}>{wAmt > 0 ? fmt(wAmt) : '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280' }}>{winOdds}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#1d4ed8', fontWeight: 600 }}>{pAmt > 0 ? fmt(pAmt) : '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280' }}>{placeOdds}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Wager Results — active or complete events with scores */}
        {showResults && scores.length > 0 && (winResults || placeResults) && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: GREEN, padding: '10px 16px' }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Wager Results</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginLeft: 8 }}>
                {event.status === 'complete' ? 'Final · Low net score' : 'Live · Updates as scores are entered'}
              </span>
            </div>
            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* WIN results */}
              {winResults && (() => {
                const color = '#16a34a', bg = '#f0fdf4', border = '#bbf7d0'
                if (winResults.matched) return (
                  <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 8 }}>WIN Pool · 1st place net {winResults.net}</div>
                    <BettorTable bettors={winResults.bettors} color={color} border={border} playerName={playerName} />
                  </div>
                )
                return (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>WIN Pool · 1st place net {winResults.net}</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>Winner: <strong>{winResults.topPlayers.map(id => playerName(id)).join(', ')}</strong> — no WIN bets placed on {winResults.topPlayers.length === 1 ? 'this player' : 'these players'}.</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{fmt(winPool)} rolls to the club.</div>
                  </div>
                )
              })()}

              {/* PLACE results */}
              {placeResults && (() => {
                const color = '#1d4ed8', bg = '#eff6ff', border = '#bfdbfe'
                if (!placeResults.matched) return (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 4 }}>PLACE Pool · No matched bets</div>
                    <div style={{ fontSize: 13, color: '#6b7280' }}>1st/2nd: <strong>{placeResults.topPlayers.map(id => playerName(id)).join(', ')}</strong> — no PLACE bets on these players.</div>
                    <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>{fmt(placePool)} rolls to the club.</div>
                  </div>
                )
                return (
                  <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 2 }}>
                      PLACE Pool · {placeResults.twoWayTie ? `Tied for 1st — net ${placeResults.net}` : `1st net ${placeResults.net} · 2nd net ${placeResults.net2}`}
                    </div>
                    <div style={{ fontSize: 10, color, marginBottom: 8 }}>Pool split 50/50 between 1st-place and 2nd-place bettors · Each bettor gets stake back + proportional share of profit</div>

                    {/* Group 1 — 1st place */}
                    {placeResults.g1.hasMatch ? (
                      <>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '6px 0 4px' }}>
                          1st place — {placeResults.g1.players.map(id => playerName(id)).join(' / ')}
                        </div>
                        <BettorTable bettors={placeResults.g1.bettors} color={color} border={border} playerName={playerName} />
                      </>
                    ) : (
                      <div style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0' }}>
                        1st place ({placeResults.g1.players.map(id => playerName(id)).join(', ')}) — no PLACE bets · half pool rolls to club.
                      </div>
                    )}

                    {/* Group 2 — 2nd place */}
                    {placeResults.g2.players.length > 0 && (
                      placeResults.g2.hasMatch ? (
                        <>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', margin: '10px 0 4px' }}>
                            2nd place — {placeResults.g2.players.map(id => playerName(id)).join(' / ')}
                          </div>
                          <BettorTable bettors={placeResults.g2.bettors} color={color} border={border} playerName={playerName} />
                        </>
                      ) : (
                        <div style={{ fontSize: 12, color: '#9ca3af', margin: '6px 0' }}>
                          2nd place ({placeResults.g2.players.map(id => playerName(id)).join(', ')}) — no PLACE bets · half pool rolls to club.
                        </div>
                      )
                    )}
                  </div>
                )
              })()}

            </div>
          </div>
        )}

        {/* Match Play Wagers */}
        {matchCards.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: GREEN, padding: '10px 16px' }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Match Play Wagers</span>
              <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginLeft: 8 }}>
                Pool per match · halved = stakes refunded
              </span>
            </div>
            {matchCards.map(({ match, sideAmt, pool, result, settlement }, i) => (
              <div key={match.id} style={{ padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: '#111' }}>
                    Match {match.match_number}: {playerName(match.player_a_id)} vs {playerName(match.player_b_id)}
                  </span>
                  <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 700 }}>Pool {fmt(pool)}</span>
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 6 }}>
                  {result ? `${result.matchStatus}${result.winner ? ' · Final' : ''}` : 'Match not scored yet'}
                </div>
                {[match.player_a_id, match.player_b_id].map(pid => {
                  const amt = sideAmt[pid] ?? 0
                  return (
                    <div key={pid} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}>
                      <span style={{ fontWeight: 600, color: '#374151' }}>{playerName(pid)}</span>
                      <span>
                        {amt > 0
                          ? <><span style={{ fontWeight: 700, color: '#7c3aed' }}>{fmt(amt)}</span> <span style={{ color: '#9ca3af', fontSize: 11 }}>{(pool / amt).toFixed(2)}x</span></>
                          : <span style={{ color: '#d1d5db' }}>—</span>}
                      </span>
                    </div>
                  )
                })}
                {settlement?.type === 'paid' && (
                  <div style={{ background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 6 }}>Winner: {playerName(settlement.winnerPid)}</div>
                    <BettorTable bettors={settlement.bettors} color="#7c3aed" border="#ddd6fe" playerName={playerName} />
                  </div>
                )}
                {settlement?.type === 'refund' && (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', marginTop: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginBottom: settlement.bettors.length ? 6 : 0 }}>Match halved — all stakes refunded</div>
                    {settlement.bettors.length > 0 && <BettorTable bettors={settlement.bettors} color="#6b7280" border="#e5e7eb" playerName={playerName} />}
                  </div>
                )}
                {settlement?.type === 'club' && (
                  <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px', marginTop: 8, fontSize: 12, color: '#6b7280' }}>
                    Winner: <strong>{playerName(settlement.winnerPid)}</strong> — no bets on the winner. {fmt(pool)} rolls to the club.
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Active Bets */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: GREEN, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Active Bets</span>
            <div style={{ display: 'flex', gap: 8 }}>
              {wagers.length > 0 && (
                <button onClick={exportExcel} disabled={exporting}
                  style={{ fontSize: 11, fontWeight: 700, color: GOLD, background: 'transparent', border: `1px solid ${GOLD}`, borderRadius: 6, padding: '4px 10px', cursor: exporting ? 'not-allowed' : 'pointer', opacity: exporting ? 0.6 : 1 }}>
                  {exporting ? 'Exporting…' : '⬇ Export Excel'}
                </button>
              )}
              {active.length > 0 && (
                <button onClick={clearAll}
                  style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                  Remove All
                </button>
              )}
            </div>
          </div>
          {active.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No active bets.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              {tableHead}
              <tbody>{active.map(w => <BetRow key={w.id} w={w} isDeleted={false} />)}</tbody>
            </table>
          )}
        </div>

        {/* Removed Bets */}
        {deleted.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fecaca', overflow: 'hidden' }}>
            <button onClick={() => setShowDeleted(s => !s)}
              style={{ width: '100%', background: '#fef2f2', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', cursor: 'pointer' }}>
              <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>Removed Bets ({deleted.length})</span>
              <span style={{ color: '#dc2626', fontSize: 12 }}>{showDeleted ? '▲ Hide' : '▼ Show'}</span>
            </button>
            {showDeleted && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                {tableHead}
                <tbody>{deleted.map(w => <BetRow key={w.id} w={w} isDeleted={true} />)}</tbody>
              </table>
            )}
          </div>
        )}

        <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
          Full pool paid to winner(s). If no one picks the winner, funds roll to the club. Halved matches refund stakes.
        </p>
      </div>
    </div>
  )
}
