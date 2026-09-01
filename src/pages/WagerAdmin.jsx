/**
 * WagerAdmin.jsx — Public wager board with delete capability
 * Route: /wager/:eventId/board
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

const MIGC_ORG = '5c7121f0-6a05-4222-9787-25245008f1da'
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

export default function WagerAdmin() {
  const { eventId } = useParams()
  const { isAdmin, loading: authLoading } = useAuth()

  const [event,         setEvent]         = useState(null)
  const [players,       setPlayers]       = useState([])
  const [wagers,        setWagers]        = useState([])
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(null)
  const [acting,        setActing]        = useState(null)   // id being soft-deleted or restored
  const [showDeleted,   setShowDeleted]   = useState(false)

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

    setWagers(await fetchWagers(eventId))
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

  if (authLoading || loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#6b7280' }}>Loading…</div>
  if (!isAdmin) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#dc2626', flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 18, fontWeight: 700 }}>Access Denied</div><div style={{ fontSize: 13, color: '#6b7280' }}>Admin login required to view this page.</div><a href="/login" style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: '#1B4332' }}>Sign in →</a></div>
  if (error)   return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'sans-serif', color: '#dc2626' }}>{error}</div>

  const active  = wagers.filter(w => !w.deleted_at)
  const deleted = wagers.filter(w =>  w.deleted_at)

  // Pool math — active only
  const winPool   = active.filter(w => w.pick_1st).reduce((s, w) => s + parseFloat(w.amount), 0)
  const placePool = active.filter(w => w.pick_2nd).reduce((s, w) => s + parseFloat(w.amount), 0)
  const totalPot  = winPool + placePool

  const winTotals = {}
  const placeTotals = {}
  for (const w of active) {
    if (w.pick_1st) winTotals[w.pick_1st]   = (winTotals[w.pick_1st]   ?? 0) + parseFloat(w.amount)
    if (w.pick_2nd) placeTotals[w.pick_2nd] = (placeTotals[w.pick_2nd] ?? 0) + parseFloat(w.amount)
  }

  const allPickedIds = [...new Set([...Object.keys(winTotals), ...Object.keys(placeTotals)])]
    .sort((a, b) => ((winTotals[b] ?? 0) + (placeTotals[b] ?? 0)) - ((winTotals[a] ?? 0) + (placeTotals[a] ?? 0)))

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const BetRow = ({ w, isDeleted }) => (
    <tr style={{ borderTop: '1px solid #f3f4f6', background: isDeleted ? '#fef2f2' : 'transparent', opacity: isDeleted ? 0.75 : 1 }}>
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
        {isDeleted ? (
          <button
            onClick={() => restore(w.id)}
            disabled={acting === w.id}
            style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', background: 'none', border: '1px solid #bbf7d0', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', opacity: acting === w.id ? 0.5 : 1 }}
          >
            {acting === w.id ? '…' : 'Restore'}
          </button>
        ) : (
          <button
            onClick={() => softDelete(w.id)}
            disabled={acting === w.id}
            style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', background: 'none', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 8px', cursor: 'pointer', opacity: acting === w.id ? 0.5 : 1 }}
          >
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
        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Time</th>
        <th style={{ padding: '8px 12px' }}></th>
      </tr>
    </thead>
  )

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
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>{active.length} active bet{active.length !== 1 ? 's' : ''}</span>
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

        {/* Active Bets */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: GREEN, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Active Bets</span>
            {active.length > 0 && (
              <button
                onClick={clearAll}
                style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}
              >
                Remove All
              </button>
            )}
          </div>
          {active.length === 0 ? (
            <div style={{ padding: '28px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>No active bets.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              {tableHead}
              <tbody>
                {active.map(w => <BetRow key={w.id} w={w} isDeleted={false} />)}
              </tbody>
            </table>
          )}
        </div>

        {/* Deleted Bets */}
        {deleted.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #fecaca', overflow: 'hidden' }}>
            <button
              onClick={() => setShowDeleted(s => !s)}
              style={{ width: '100%', background: '#fef2f2', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: 'none', cursor: 'pointer' }}
            >
              <span style={{ color: '#dc2626', fontWeight: 700, fontSize: 13 }}>Removed Bets ({deleted.length})</span>
              <span style={{ color: '#dc2626', fontSize: 12 }}>{showDeleted ? '▲ Hide' : '▼ Show'}</span>
            </button>
            {showDeleted && (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                {tableHead}
                <tbody>
                  {deleted.map(w => <BetRow key={w.id} w={w} isDeleted={true} />)}
                </tbody>
              </table>
            )}
          </div>
        )}

        <p style={{ fontSize: 10, color: '#9ca3af', textAlign: 'center' }}>
          Full pool paid to winner(s). If no one picks the winner, funds roll to the club.
        </p>
      </div>
    </div>
  )
}
