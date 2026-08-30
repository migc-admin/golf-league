/**
 * Public wager submission page — /wager/:eventId
 * Multi-pick cart: select player + win/place + amount per row.
 * Venmo deep link built from all picks at checkout.
 */

import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const GREEN = '#1B4332'

function formatDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function emptyPick() {
  return { id: crypto.randomUUID(), playerId: '', position: 'win', amount: '' }
}

export default function Wager() {
  const { eventId } = useParams()

  const [event,      setEvent]      = useState(null)
  const [players,    setPlayers]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)

  const [bettorName, setBettorName] = useState('')
  const [picks,      setPicks]      = useState([emptyPick()])
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [venmoUrl,   setVenmoUrl]   = useState(null)

  useEffect(() => {
    async function load() {
      const { data: ev, error: evErr } = await supabase
        .from('events')
        .select('id, event_number, name, event_date, venmo_handle, league:leagues(name, org_id), course:courses(name)')
        .eq('id', eventId)
        .maybeSingle()

      const MIGC_ORG = '5c7121f0-6a05-4222-9787-25245008f1da'
      if (evErr || !ev || ev.league?.org_id !== MIGC_ORG) {
        setError('Event not found.')
        setLoading(false)
        return
      }
      setEvent(ev)

      const { data: eps } = await supabase
        .from('event_players')
        .select('player_id, player:players(id, first_name, last_name)')
        .eq('event_id', eventId)

      const roster = (eps ?? [])
        .map(ep => ep.player)
        .filter(Boolean)
        .sort((a, b) => a.last_name.localeCompare(b.last_name))

      setPlayers(roster)
      setLoading(false)
    }
    load()
  }, [eventId])

  function updatePick(id, field, value) {
    setPicks(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  function addPick() {
    setPicks(prev => [...prev, emptyPick()])
  }

  function removePick(id) {
    setPicks(prev => prev.filter(p => p.id !== id))
  }

  const validPicks = picks.filter(p => p.playerId && p.amount && parseFloat(p.amount) > 0)
  const total = validPicks.reduce((sum, p) => sum + parseFloat(p.amount), 0)

  function playerName(id) {
    const p = players.find(pl => pl.id === id)
    return p ? `${p.first_name} ${p.last_name}` : ''
  }

  function buildVenmoUrl() {
    if (!event?.venmo_handle) return null
    const eventLabel = event.name ?? `Event #${event.event_number}`
    const note = validPicks
      .map(p => `${playerName(p.playerId)} ${p.position.toUpperCase()} $${parseFloat(p.amount).toFixed(0)}`)
      .join(', ')
    const memo = `${eventLabel} – ${bettorName.trim()} | ${note}`
    return `https://venmo.com/?txn=pay&recipients=${encodeURIComponent(event.venmo_handle)}&amount=${total.toFixed(2)}&note=${encodeURIComponent(memo)}`
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!bettorName.trim()) { alert('Enter your name.'); return }
    if (validPicks.length === 0) { alert('Add at least one pick with an amount.'); return }

    setSubmitting(true)

    // Store each pick as a separate wager row, grouped by bettor_name + created_at
    const rows = validPicks.map(p => ({
      event_id:    eventId,
      bettor_name: bettorName.trim(),
      pick_1st:    p.position === 'win'   ? p.playerId : null,
      pick_2nd:    p.position === 'place' ? p.playerId : null,
      amount:      parseFloat(p.amount),
      venmo_sent:  true,
    }))

    const { error } = await supabase.from('wagers').insert(rows)
    setSubmitting(false)
    if (error) { alert('Submission failed: ' + error.message); return }

    setVenmoUrl(buildVenmoUrl())
    setSubmitted(true)
  }

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

  const eventLabel = event.name ?? `Event #${event.event_number}`

  // ── Confirmation screen ──────────────────────────────────────────
  if (submitted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12" style={{ background: '#fbfaf8' }}>
        <div style={{
          background: '#fff', borderRadius: '1.5rem', border: '1px solid #ebe9e4',
          boxShadow: '0 20px 60px rgba(0,0,0,.08)', padding: '40px 28px',
          maxWidth: 420, width: '100%',
        }}>
          <div className="text-center mb-6">
            <div className="text-5xl mb-4">🏌️</div>
            <h2 className="text-xl font-bold mb-1" style={{ color: GREEN }}>Picks submitted!</h2>
            <p className="text-sm text-gray-500">{eventLabel} · {formatDate(event.event_date)}</p>
          </div>

          {/* Picks summary */}
          <div className="rounded-xl p-4 mb-5 space-y-2" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <p className="text-sm font-semibold mb-3" style={{ color: GREEN }}>Your wagers</p>
            {validPicks.map(p => (
              <div key={p.id} className="flex justify-between text-sm">
                <span className="text-gray-700">
                  {playerName(p.playerId)}
                  <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${p.position === 'win' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                    {p.position === 'win' ? 'WIN' : 'PLACE'}
                  </span>
                </span>
                <span className="font-semibold text-gray-900">${parseFloat(p.amount).toFixed(2)}</span>
              </div>
            ))}
            <div className="pt-2 mt-2 border-t border-green-200 flex justify-between text-sm font-bold">
              <span style={{ color: GREEN }}>Total</span>
              <span style={{ color: GREEN }}>${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Venmo CTA */}
          {venmoUrl ? (
            <a
              href={venmoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-3 rounded-xl text-sm font-bold text-white mb-3"
              style={{ background: '#3D95CE' }}
            >
              💸 Pay ${total.toFixed(2)} via Venmo
            </a>
          ) : (
            <div className="rounded-xl px-4 py-3 text-sm text-center mb-3" style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
              <p className="font-semibold" style={{ color: '#92400e' }}>Send ${total.toFixed(2)} to @{event.venmo_handle}</p>
              <p className="text-xs text-gray-500 mt-1">
                Memo: {eventLabel} – {bettorName.trim()}
              </p>
            </div>
          )}

          <p className="text-center text-xs text-gray-400">
            Payment is required to lock in your picks.
          </p>
        </div>
      </div>
    )
  }

  // ── Wager form ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen px-4 py-10" style={{ background: '#fbfaf8' }}>
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: GREEN }}>
            <span className="text-2xl">⛳</span>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: GREEN, letterSpacing: '-0.03em' }}>
            {eventLabel}
          </h1>
          <p className="text-sm text-gray-500">{event.league?.name} · {event.course?.name}</p>
          <p className="text-sm text-gray-400 mt-0.5">{formatDate(event.event_date)}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Your name */}
          <div style={{ background: '#fff', borderRadius: '1.25rem', border: '1px solid #ebe9e4', padding: '20px' }}>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Your Name</label>
            <input
              type="text"
              value={bettorName}
              onChange={e => setBettorName(e.target.value)}
              placeholder="First Last"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
            />
          </div>

          {/* Pick rows */}
          <div style={{ background: '#fff', borderRadius: '1.25rem', border: '1px solid #ebe9e4', padding: '20px' }}>
            <p className="text-xs font-semibold text-gray-600 mb-4">Your Picks</p>
            <div className="space-y-4">
              {picks.map((pick, idx) => (
                <div key={pick.id} className="relative">
                  {picks.length > 1 && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-400">Pick {idx + 1}</span>
                      <button
                        type="button"
                        onClick={() => removePick(pick.id)}
                        className="text-xs text-red-400 hover:text-red-600"
                      >
                        Remove
                      </button>
                    </div>
                  )}

                  {/* Player select */}
                  <select
                    value={pick.playerId}
                    onChange={e => updatePick(pick.id, 'playerId', e.target.value)}
                    required
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none mb-2"
                  >
                    <option value="">Select a player…</option>
                    {players.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.first_name} {p.last_name}
                      </option>
                    ))}
                  </select>

                  {/* Win / Place + Amount on same row */}
                  <div className="flex gap-2">
                    <div className="flex rounded-xl border border-gray-200 overflow-hidden text-sm font-semibold flex-shrink-0">
                      {[['win', 'WIN'], ['place', 'PLACE']].map(([val, label]) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => updatePick(pick.id, 'position', val)}
                          className="px-3 py-2 transition-colors"
                          style={pick.position === val
                            ? { background: GREEN, color: '#fff' }
                            : { background: '#f9f9f9', color: '#6b7280' }}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={pick.amount}
                        onChange={e => updatePick(pick.id, 'amount', e.target.value)}
                        placeholder="0"
                        required
                        className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Bet rules */}
            <p className="text-xs text-gray-400 mt-3 text-center">
              Minimum bet $5 · $5 increments only
            </p>

            {/* Add another pick */}
            <button
              type="button"
              onClick={addPick}
              className="mt-4 w-full py-2 rounded-xl border text-sm font-semibold transition-colors"
              style={{ borderColor: GREEN, color: GREEN, background: 'transparent' }}
            >
              + Add Another Pick
            </button>
          </div>

          {/* Total + Venmo preview */}
          {validPicks.length > 0 && (
            <div className="rounded-xl px-4 py-3" style={{ background: '#fefce8', border: '1px solid #fde68a' }}>
              <div className="flex justify-between text-sm font-bold mb-1" style={{ color: '#92400e' }}>
                <span>Total Wager</span>
                <span>${total.toFixed(2)}</span>
              </div>
              {event.venmo_handle && (
                <p className="text-xs text-gray-500">
                  You'll be prompted to pay @{event.venmo_handle} via Venmo after submitting.
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting || validPicks.length === 0}
            className="w-full py-3 rounded-xl text-sm font-bold text-white transition-opacity"
            style={{ background: GREEN, opacity: (submitting || validPicks.length === 0) ? 0.5 : 1 }}
          >
            {submitting ? 'Submitting…' : 'Submit Picks'}
          </button>
        </form>
      </div>
    </div>
  )
}
