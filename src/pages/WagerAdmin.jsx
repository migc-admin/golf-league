/**
 * WagerAdmin.jsx — Public wager board with delete capability
 * Route: /wager/:eventId/board
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const MIGC_ORG = '5c7121f0-6a05-4222-9787-25245008f1da'
const GREEN    = '#1B4332'
const GOLD     = '#C9A84C'

function fmt(n) { return `$${Number(n).toFixed(2)}` }

export default function WagerAdmin() {
  const { eventId } = useParams()

  const [event,   setEvent]   = useState(null)
  const [players, setPlayers] = useState([])
  const [wagers,  setWagers]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [deleting, setDeleting] = useState(null) // wagerId being deleted

  async function loadData() {
    const { data: ev } = await supabase
      .from('events')
      .select('*, league:leagues(name, org_id)')
      .eq('id', eventId).single()

    if (!ev || ev.league?.org_id !== MIGC_ORG) {
      setError('This wager board is not available.')
      setLoading(false)
      return
    }
    setEvent(ev)

    const { data: eps } = await supabase
      .from('event_players')
      .select('player_id, player:players(first_name, last_name)')
      .eq('event_id', eventId)
    setPlayers(eps ?? [])

    const { data: ws } = await supabase
      .from('wagers')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at')
    setWagers(ws ?? [])

    setLoading(false)
  }

  useEffect(() => {
    loadData()
    const interval = setInterval(async () => {
      const { data: ws } = await supabase.from('wagers').select('*').eq('event_id', eventId).order('created_at')
      setWagers(ws ?? [])
    }, 15000)
    return () => clearInterval(interval)
  }, [eventId])

  function playerName(pid) {
    if (!pid) return '—'
    const ep = players.find(p => p.player_id === pid)
    if (!ep) return '—'
    return `${ep.player.first_name} ${ep.player.last_name}`
  }

  async function deleteWager(id) {
    if (!window.confirm('Delete this bet?')) return
    setDeleting(id)
    await supabase.from('wagers').delete().eq('id', id)
    setWagers(prev => prev.filter(w => w.id !== id))
    setDeleting(null)
  }

  async function clearAll() {
    if (!window.confirm('Delete ALL bets for this event? This cannot be undone.')) return
    await supabase.from('wagers').delete().eq('event_id', eventId)
    setWagers([])
  }

  if (loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#6b7280' }}>Loading…</div>
  if (error)   return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#dc2626' }}>{error}</div>

  // Pool math
  const winPool   = wagers.filter(w => w.pick_1st).reduce((s, w) => s + parseFloat(w.amount), 0)
  const placePool = wagers.filter(w => w.pick_2nd).reduce((s, w) => s + parseFloat(w.amount), 0)
  const totalPot  = winPool + placePool

  const winTotals = {}
  const placeTotals = {}
  for (const w of wagers) {
    if (w.pick_1st) winTotals[w.pick_1st]   = (winTotals[w.pick_1st]   ?? 0) + parseFloat(w.amount)
    if (w.pick_2nd) placeTotals[w.pick_2nd] = (placeTotals[w.pick_2nd] ?? 0) + parseFloat(w.amount)
  }

  const allPickedIds = [...new Set([...Object.keys(winTotals), ...Object.keys(placeTotals)])]
    .sort((a, b) => ((winTotals[b] ?? 0) + (placeTotals[b] ?? 0)) - ((winTotals[a] ?? 0) + (placeTotals[a] ?? 0)))

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <div style={{ minHeight: '100vh', background: '#f9f8f5', fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Header */}
      <div style={{ background: GREEN, padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ color: GOLD, fontWeight: 800, fontSize: 16 }}>Mulligan's Island Golf Club</div>
          <div style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 2 }}>{event.name} · Wager Board — Admin</div>
          <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 }}>{eventDate}</div>
        </div>
        <Link to={`/wager/${eventId}`} style={{ fontSize: 12, fontWeight: 600, color: GOLD, textDecoration: 'none', border: `1px solid ${GOLD}`, borderRadius: 8, padding: '5px 10px' }}>
          Place a Bet
        </Link>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Pool Summary */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: GREEN, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Pool Summary</span>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{wagers.length} bet{wagers.length !== 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '14px 16px', gap: 8 }}>
            {[
              ['WIN Pool', fmt(winPool), '#16a34a'],
              ['PLACE Pool', fmt(placePool), '#1d4ed8'],
              ['Total Pot', fmt(totalPot), GREEN],
            ].map(([label, val, color]) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 700, marginBottom: 2 }}>{label}</div>
                <div style={{ fontSize: 20, fontWeight: 900, color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Odds Board */}
        {allPickedIds.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div style={{ background: GREEN, padding: '10px 16px' }}>
              <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Live Odds</span>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f0f4f2' }}>
                  <th style={{ padding: '7px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700 }}>Player</th>
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

        {/* Individual Bets */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: GREEN, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>All Bets</span>
            {wagers.length > 0 && (
              <button
                onClick={clearAll}
                style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
              >
                Clear All
              </button>
            )}
          </div>

          {wagers.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No bets placed yet.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Bettor</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Pick</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Type</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Amt</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Time</th>
                  <th style={{ padding: '8px 12px' }}></th>
                </tr>
              </thead>
              <tbody>
                {wagers.map((w, i) => (
                  <tr key={w.id} style={{ borderTop: '1px solid #f3f4f6', background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                    <td style={{ padding: '9px 12px', fontWeight: 700, color: '#111' }}>{w.bettor_name}</td>
                    <td style={{ padding: '9px 12px', color: '#374151' }}>{playerName(w.pick_1st ?? w.pick_2nd)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      {w.pick_1st
                        ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, padding: '2px 7px' }}>WIN</span>
                        : <span style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '2px 7px' }}>PLACE</span>
                      }
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'right', fontWeight: 700, color: '#111' }}>{fmt(w.amount)}</td>
                    <td style={{ padding: '9px 12px', textAlign: 'center', color: '#9ca3af', fontSize: 11 }}>
                      {new Date(w.created_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                    </td>
                    <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                      <button
                        onClick={() => deleteWager(w.id)}
                        disabled={deleting === w.id}
                        style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', opacity: deleting === w.id ? 0.5 : 1 }}
                      >
                        {deleting === w.id ? '…' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
          Full pool paid to winner(s). If no one picks the winner, funds roll to the club.
        </p>
      </div>
    </div>
  )
}
