/**
 * Public wager board — /wager/:eventId/board
 * Anyone with the link can see all bets, odds, and the total pot.
 * No auth required.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const GREEN = '#1B4332'

function formatDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })
}

function formatTime(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

export default function WagerAdmin() {
  const { eventId } = useParams()

  const [event,   setEvent]   = useState(null)
  const [wagers,  setWagers]  = useState([])
  const [players, setPlayers] = useState({})
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)

  useEffect(() => {
    async function load() {
      const { data: ev } = await supabase
        .from('events')
        .select('id, event_number, name, event_date, league:leagues(name, org_id), course:courses(name)')
        .eq('id', eventId)
        .maybeSingle()

      const MIGC_ORG = '5c7121f0-6a05-4222-9787-25245008f1da'
      if (!ev || ev.league?.org_id !== MIGC_ORG) { setError('Event not found.'); setLoading(false); return }
      setEvent(ev)

      const { data: eps } = await supabase
        .from('event_players')
        .select('player_id, player:players(id, first_name, last_name)')
        .eq('event_id', eventId)

      const playerMap = {}
      for (const ep of eps ?? []) {
        if (ep.player) playerMap[ep.player.id] = `${ep.player.first_name} ${ep.player.last_name}`
      }
      setPlayers(playerMap)

      const { data: ws } = await supabase
        .from('wagers')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      setWagers(ws ?? [])
      setLoading(false)
    }
    load()

    // Auto-refresh every 30s
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [eventId])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fbfaf8' }}>
      <p className="text-gray-400 text-sm">Loading…</p>
    </div>
  )
  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fbfaf8' }}>
      <p className="text-red-500 text-sm">{error}</p>
    </div>
  )

  const totalPot  = wagers.reduce((sum, w) => sum + parseFloat(w.amount), 0)
  const winPool   = wagers.filter(w => w.pick_1st).reduce((sum, w) => sum + parseFloat(w.amount), 0)
  const placePool = wagers.filter(w => w.pick_2nd).reduce((sum, w) => sum + parseFloat(w.amount), 0)

  // Tally win and place amounts per player
  const winTotals   = {}
  const placeTotals = {}
  for (const w of wagers) {
    if (w.pick_1st) winTotals[w.pick_1st]     = (winTotals[w.pick_1st]   ?? 0) + parseFloat(w.amount)
    if (w.pick_2nd) placeTotals[w.pick_2nd]   = (placeTotals[w.pick_2nd] ?? 0) + parseFloat(w.amount)
  }

  // All players who received any bets, sorted by total money on them
  const allPickedIds = [...new Set([...Object.keys(winTotals), ...Object.keys(placeTotals)])]
    .sort((a, b) => {
      const totA = (winTotals[a] ?? 0) + (placeTotals[a] ?? 0)
      const totB = (winTotals[b] ?? 0) + (placeTotals[b] ?? 0)
      return totB - totA
    })

  // Group wagers by bettor name for the "all bets" section
  const byBettor = {}
  for (const w of [...wagers].reverse()) {
    if (!byBettor[w.bettor_name]) byBettor[w.bettor_name] = []
    byBettor[w.bettor_name].push(w)
  }

  const eventLabel = event.name ?? `Event #${event.event_number}`

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: '#fbfaf8' }}>
      <div className="max-w-lg mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: GREEN }}>
            <span className="text-2xl">⛳</span>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: GREEN, letterSpacing: '-0.03em' }}>
            Wager Board
          </h1>
          <p className="text-sm text-gray-500">{eventLabel} · {event.league?.name}</p>
          <p className="text-sm text-gray-400">{formatDate(event.event_date)}</p>
        </div>

        {/* Summary tiles */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Pot',  value: `$${totalPot.toFixed(2)}` },
            { label: 'Bets',       value: wagers.length },
            { label: 'Bettors',    value: Object.keys(byBettor).length },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: '#fff', border: '1px solid #ebe9e4' }}>
              <p className="text-xs text-gray-400 mb-1">{s.label}</p>
              <p className="text-xl font-bold" style={{ color: GREEN }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Odds board */}
        {allPickedIds.length > 0 && (
          <div style={{ background: '#fff', borderRadius: '1.25rem', border: '1px solid #ebe9e4' }}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h2 className="text-sm font-bold text-gray-900">Live Odds</h2>
              <p className="text-xs text-gray-400 mt-0.5">Updates every 30 seconds · parimutuel</p>
            </div>
            <div className="divide-y divide-gray-50">
              <div className="grid grid-cols-4 px-5 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                <div className="col-span-2">Player</div>
                <div className="text-right">WIN</div>
                <div className="text-right">PLACE</div>
              </div>
              {allPickedIds.map((id, idx) => {
                const wAmt = winTotals[id]   ?? 0
                const pAmt = placeTotals[id] ?? 0
                const winOdds   = wAmt > 0 && winPool   > 0 ? (winPool   / wAmt).toFixed(2) : null
                const placeOdds = pAmt > 0 && placePool > 0 ? (placePool / pAmt).toFixed(2) : null
                return (
                  <div key={id} className="grid grid-cols-4 px-5 py-3 items-center">
                    <div className="col-span-2 flex items-center gap-2">
                      {idx < 3 && (
                        <span className="text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: idx === 0 ? '#D4AF37' : idx === 1 ? '#e5e7eb' : '#d97706', color: '#fff' }}>
                          {idx + 1}
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-900">{players[id] ?? id}</span>
                    </div>
                    <div className="text-right">
                      {winOdds
                        ? <div>
                            <span className="text-xs font-bold text-green-700">${wAmt.toFixed(0)}</span>
                            <span className="block text-xs text-gray-400">{winOdds}x</span>
                          </div>
                        : <span className="text-xs text-gray-300">—</span>}
                    </div>
                    <div className="text-right">
                      {placeOdds
                        ? <div>
                            <span className="text-xs font-bold text-blue-700">${pAmt.toFixed(0)}</span>
                            <span className="block text-xs text-gray-400">{placeOdds}x</span>
                          </div>
                        : <span className="text-xs text-gray-300">—</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* All bets by bettor */}
        <div style={{ background: '#fff', borderRadius: '1.25rem', border: '1px solid #ebe9e4' }}>
          <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center">
            <h2 className="text-sm font-bold text-gray-900">All Bets</h2>
            {wagers.length > 0 && (
              <button
                onClick={async () => {
                  if (!window.confirm(`Delete all ${wagers.length} bet(s) for this event? This cannot be undone.`)) return
                  await supabase.from('wagers').delete().eq('event_id', eventId)
                  setWagers([])
                }}
                className="text-xs font-semibold text-red-500 hover:text-red-700"
              >
                Clear All
              </button>
            )}
          </div>
          {wagers.length === 0 ? (
            <p className="px-5 py-6 text-sm text-gray-400 text-center">No bets placed yet.</p>
          ) : (
            <div className="divide-y divide-gray-50">
              {Object.entries(byBettor).map(([name, ws]) => {
                const bettorTotal = ws.reduce((s, w) => s + parseFloat(w.amount), 0)
                return (
                  <div key={name} className="px-5 py-4">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-bold text-gray-900">{name}</span>
                      <span className="text-sm font-bold" style={{ color: GREEN }}>${bettorTotal.toFixed(2)}</span>
                    </div>
                    <div className="space-y-1">
                      {ws.map(w => (
                        <div key={w.id} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className={`font-bold px-1.5 py-0.5 rounded ${w.pick_1st ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                              {w.pick_1st ? 'WIN' : 'PLACE'}
                            </span>
                            <span className="text-gray-700">{players[w.pick_1st ?? w.pick_2nd] ?? '—'}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-gray-500">${parseFloat(w.amount).toFixed(2)}</span>
                            <button
                              onClick={async () => {
                                if (!window.confirm('Delete this bet?')) return
                                await supabase.from('wagers').delete().eq('id', w.id)
                                setWagers(prev => prev.filter(x => x.id !== w.id))
                              }}
                              className="text-red-400 hover:text-red-600 font-bold leading-none"
                              title="Delete bet"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-300 mt-2">{formatTime(ws[ws.length - 1].created_at)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">Auto-refreshes every 30 seconds</p>
      </div>
    </div>
  )
}
