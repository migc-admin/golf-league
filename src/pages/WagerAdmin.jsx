/**
 * WagerAdmin.jsx — Admin wager board
 * Route: /wager/:eventId/board
 */

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'

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
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [acting,      setActing]      = useState(null)
  const [showDeleted, setShowDeleted] = useState(false)
  const [toggling,    setToggling]    = useState(false)

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
      .select('player_id, course_handicap, adjusted_handicap_index, player:players(first_name, last_name)')
      .eq('event_id', eventId)
    setPlayers(eps ?? [])

    setWagers(await fetchWagers(eventId))

    // Scores always loaded — used for live leaderboard during active event too
    const { data: sc } = await supabase
      .from('scores')
      .select('player_id, gross_score')
      .eq('event_id', eventId)
    setScores(sc ?? [])

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

  if (authLoading || loading) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Schibsted Grotesk', sans-serif", color: '#6b7280' }}>Loading…</div>
  if (!isAdmin) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Schibsted Grotesk', sans-serif", flexDirection: 'column', gap: 8 }}><div style={{ fontSize: 18, fontWeight: 700, color: '#dc2626' }}>Access Denied</div><div style={{ fontSize: 13, color: '#6b7280' }}>Admin login required.</div><a href="/login" style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: GREEN }}>Sign in →</a></div>
  if (error) return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Schibsted Grotesk', sans-serif", color: '#dc2626' }}>{error}</div>

  const active  = wagers.filter(w => !w.deleted_at)
  const deleted = wagers.filter(w =>  w.deleted_at)

  // Pool math — active only
  const winPool   = active.filter(w => w.pick_1st).reduce((s, w) => s + parseFloat(w.amount), 0)
  const placePool = active.filter(w => w.pick_2nd).reduce((s, w) => s + parseFloat(w.amount), 0)
  const totalPot  = winPool + placePool

  const winTotals   = {}
  const placeTotals = {}
  for (const w of active) {
    if (w.pick_1st) winTotals[w.pick_1st]   = (winTotals[w.pick_1st]   ?? 0) + parseFloat(w.amount)
    if (w.pick_2nd) placeTotals[w.pick_2nd] = (placeTotals[w.pick_2nd] ?? 0) + parseFloat(w.amount)
  }

  const allPickedIds = [...new Set([...Object.keys(winTotals), ...Object.keys(placeTotals)])]
    .sort((a, b) => ((winTotals[b] ?? 0) + (placeTotals[b] ?? 0)) - ((winTotals[a] ?? 0) + (placeTotals[a] ?? 0)))

  // ── Winner calculation ─────────────────────────────────────────────
  // WIN:   pays bettors who picked the 1st place (lowest net) finisher
  // PLACE: North American pari-mutuel — selection must finish 1st OR 2nd.
  //        Pool is split 50/50 between the 1st-place group and 2nd-place group.
  //        Each bettor gets their stake back + proportional share of their group's profit half.
  //        Dead heats: tied players share their group's half proportionally.
  let winResults   = null
  let placeResults = null

  if (scores.length > 0) {
    const grossByPlayer = {}
    for (const s of scores) {
      if (s.gross_score != null)
        grossByPlayer[s.player_id] = (grossByPlayer[s.player_id] ?? 0) + s.gross_score
    }
    const netByPlayer = {}
    for (const ep of players) {
      if (grossByPlayer[ep.player_id] != null) {
        const ch = ep.course_handicap ?? ep.adjusted_handicap_index ?? 0
        netByPlayer[ep.player_id] = grossByPlayer[ep.player_id] - ch
      }
    }

    // Sort all scored players by net ascending
    const allSorted = Object.entries(netByPlayer).sort((a, b) => a[1] - b[1])
    if (allSorted.length === 0) { /* no scores yet */ }
    else {
      // 1st place: lowest net (may be multiple tied)
      const net1 = allSorted[0][1]
      const place1Players = allSorted.filter(([, n]) => n === net1).map(([id]) => id)

      // 2nd place: next distinct net score (may be multiple tied)
      // If 2+ players tie for 1st, they occupy both 1st and 2nd — no separate 2nd group
      const twoWayTieForFirst = place1Players.length >= 2
      let place2Players = []
      let net2 = null
      if (!twoWayTieForFirst) {
        const secondEntry = allSorted.find(([, n]) => n > net1)
        if (secondEntry) {
          net2 = secondEntry[1]
          place2Players = allSorted.filter(([, n]) => n === net2).map(([id]) => id)
        }
      }

      // ── WIN pool ──────────────────────────────────────────────────
      const winBettors = active.filter(w => w.pick_1st && place1Players.includes(w.pick_1st))
      if (winBettors.length > 0) {
        const totalStake = winBettors.reduce((s, w) => s + parseFloat(w.amount), 0)
        winResults = {
          net: net1,
          matched: true,
          bettors: winBettors.map(w => ({
            name:   w.bettor_name,
            pid:    w.pick_1st,
            bet:    parseFloat(w.amount),
            payout: Math.floor((parseFloat(w.amount) / totalStake) * winPool * 100) / 100,
          })),
        }
      } else {
        winResults = { net: net1, matched: false, topPlayers: place1Players }
      }

      // ── PLACE pool ────────────────────────────────────────────────
      // Group 1 = bettors who picked 1st place finisher(s)
      // Group 2 = bettors who picked 2nd place finisher(s)
      // (If 2-way tie for 1st, group1 = tied player A bettors, group2 = tied player B bettors)
      let g1Players, g2Players
      if (twoWayTieForFirst) {
        // Two tied players fill 1st and 2nd — treat each tied player as their own group
        g1Players = [place1Players[0]]
        g2Players = place1Players.slice(1) // remaining tied players
      } else {
        g1Players = place1Players
        g2Players = place2Players
      }

      const g1Bettors = active.filter(w => w.pick_2nd && g1Players.includes(w.pick_2nd))
      const g2Bettors = active.filter(w => w.pick_2nd && g2Players.includes(w.pick_2nd))
      const s1 = g1Bettors.reduce((s, w) => s + parseFloat(w.amount), 0)
      const s2 = g2Bettors.reduce((s, w) => s + parseFloat(w.amount), 0)

      const hasG1 = g1Bettors.length > 0
      const hasG2 = g2Bettors.length > 0

      if (!hasG1 && !hasG2) {
        // Nobody bet on 1st or 2nd place finishers
        placeResults = {
          net: net1, net2: twoWayTieForFirst ? net1 : net2,
          matched: false,
          topPlayers: [...g1Players, ...g2Players],
        }
      } else {
        // Profit = pool minus stakes returned to both groups
        const stakesReturned = (hasG1 ? s1 : 0) + (hasG2 ? s2 : 0)
        const profit = placePool - stakesReturned
        // Each group gets half the profit (if the other group has no bettors, their half rolls to club)
        const halfProfit = profit / 2

        function placePayouts(bettors, groupStake, groupHalfProfit) {
          return bettors.map(w => {
            const bet = parseFloat(w.amount)
            const profitShare = groupStake > 0 ? Math.floor((bet / groupStake) * groupHalfProfit * 100) / 100 : 0
            return {
              name:   w.bettor_name,
              pid:    w.pick_2nd,
              bet,
              payout: Math.floor((bet + profitShare) * 100) / 100,
            }
          })
        }

        placeResults = {
          net: net1,
          net2: twoWayTieForFirst ? net1 : net2,
          twoWayTie: twoWayTieForFirst,
          matched: true,
          g1: { players: g1Players, bettors: hasG1 ? placePayouts(g1Bettors, s1, halfProfit) : [], hasMatch: hasG1 },
          g2: { players: g2Players, bettors: hasG2 ? placePayouts(g2Bettors, s2, halfProfit) : [], hasMatch: hasG2 },
          halfRollsToClub: (!hasG1 || !hasG2),
        }
      }
    }
  }

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
        <th style={{ padding: '8px 12px', textAlign: 'center', color: '#6b7280', fontWeight: 700, fontSize: 11 }}>Time</th>
        <th style={{ padding: '8px 12px' }}></th>
      </tr>
    </thead>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f9f8f5', fontFamily: "'Schibsted Grotesk', sans-serif" }}>
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

        {/* Active Bets */}
        <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <div style={{ background: GREEN, padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: GOLD, fontWeight: 700, fontSize: 13 }}>Active Bets</span>
            {active.length > 0 && (
              <button onClick={clearAll}
                style={{ fontSize: 11, fontWeight: 700, color: '#fca5a5', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
                Remove All
              </button>
            )}
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
          Full pool paid to winner(s). If no one picks the winner, funds roll to the club.
        </p>
      </div>
    </div>
  )
}
