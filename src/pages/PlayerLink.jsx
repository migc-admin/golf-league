/**
 * PlayerLink — permanent per-player URL, meant to be encoded onto a QR code and/or
 * a physical NFC tag that lives on the player's bag. Route: /p/:token
 *
 * Opens the player's profile: their course handicap, today's (or next) event with
 * buttons to start scoring and view the leaderboard, and their recent results.
 * No login required. Possession of the link is the credential, so scoring access
 * (the same guest session Scorecard.jsx already trusts) is only granted when the
 * player taps "Start scoring", never just by opening the page.
 *
 * The same link works for every future event the player plays in.
 */

import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { supabase } from '../lib/supabase'
import { computeLeaderboards } from '../lib/engines/scoring'
import {
  pickCurrentEvent, recentCompleted, summarizeResult, handicapSummary,
  teeInfo, eventTitle, eventUrls, localToday,
} from '../lib/playerProfile'

const GUEST_KEY = 'golf_guest_session'
const MIGC_ORG  = import.meta.env.VITE_MIGC_ORG_ID
const GOLD  = '#C9A84C'
const GREEN = '#1B4332'
const bg = { background: 'linear-gradient(150deg,#0b2318 0%,#1B4332 45%,#1f5c3e 100%)', fontFamily: "'Manrope', sans-serif" }

const EVENT_FIELDS = 'id, name, event_number, event_date, start_time, status, slug, group_codes, shotgun_start, tee_time_interval_mins, group_hole_assignments, course:courses(*), league:leagues(slug, name, org_id, org:organizations(slug))'

function prettyDate(d) {
  if (!d) return ''
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={bg}>
      <svg className="animate-spin h-8 w-8 text-white" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  )
}

export default function PlayerLink() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [status,  setStatus]  = useState('loading') // loading | invalid | ready
  const [player,  setPlayer]  = useState(null)
  const [rows,    setRows]    = useState([])
  const [results, setResults] = useState(null)      // null while loading, then { [event_id]: summary | false }

  useEffect(() => {
    let mounted = true

    async function load() {
      try {
        const { data: p } = await supabase
          .from('players')
          .select('id, first_name, last_name')
          .eq('player_link_token', token)
          .maybeSingle()
        if (!mounted) return
        if (!p) { setStatus('invalid'); return }
        setPlayer(p)

        // `events!inner` makes the status filter actually exclude other events
        const { data: eps } = await supabase
          .from('event_players')
          .select(`event_id, group_number, flight, course_handicap, handicap_index, adjusted_handicap_index, event:events!inner(${EVENT_FIELDS})`)
          .eq('player_id', p.id)
          .in('event.status', ['active', 'upcoming', 'complete'])
        if (!mounted) return
        const all = (eps ?? []).filter(r => r.event)
        setRows(all)
        setStatus('ready')

        // Past results: compute each recent completed event's leaderboard to find their finish
        const done = recentCompleted(all, 5)
        const entries = await Promise.all(done.map(async r => {
          try {
            const [{ data: field }, { data: scores }] = await Promise.all([
              supabase.from('event_players').select('player_id, flight, course_handicap, tee, is_guest, player:players(first_name, last_name)').eq('event_id', r.event_id),
              supabase.from('scores').select('player_id, hole_number, gross_score, putts').eq('event_id', r.event_id),
            ])
            if (!r.event.course?.par_per_hole) return [r.event_id, false]
            const lb = computeLeaderboards(field ?? [], scores ?? [], r.event.course)
            return [r.event_id, summarizeResult(lb, p.id) ?? false]
          } catch {
            return [r.event_id, false]
          }
        }))
        if (mounted) setResults(Object.fromEntries(entries))
      } catch {
        if (mounted) setStatus('invalid')
      }
    }

    load()
    return () => { mounted = false }
  }, [token])

  if (status === 'loading') return <Spinner />

  if (status === 'invalid') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center" style={bg}>
        <Helmet><meta name="robots" content="noindex" /></Helmet>
        <p className="text-white text-xl font-bold">Link not recognized.</p>
        <p className="text-white/60 text-sm mt-2 max-w-xs">Contact your admin to get a new tag.</p>
      </div>
    )
  }

  const name = `${player.first_name ?? ''} ${player.last_name ?? ''}`.trim()
  const today = localToday()
  const current = pickCurrentEvent(rows, today)
  const completed = recentCompleted(rows, 5)
  const hc = handicapSummary(current, completed)

  const ev = current?.row.event
  const urls = ev ? eventUrls(ev, MIGC_ORG) : null
  const group = current?.row.group_number ?? null
  const tee = ev ? teeInfo(ev, group) : null
  const accessCode = ev && group != null ? (ev.group_codes ?? {})[String(group)] : null
  const canScore = current?.kind === 'active' && !!accessCode

  function startScoring() {
    localStorage.setItem(GUEST_KEY, JSON.stringify({
      eventId: ev.id,
      groupNum: group,
      accessCode,
      selectedName: name,
      _expires: Date.now() + 12 * 60 * 60 * 1000,
    }))
    navigate(urls.scorecard)
  }

  const card = { background: '#fff', borderRadius: 16, padding: '16px 18px' }
  const primary = { background: GOLD, color: '#0b2318', fontWeight: 800, fontSize: 16, padding: '14px 0', borderRadius: 12, width: '100%', border: 'none' }
  const secondary = { background: '#fff', color: GREEN, border: `2px solid ${GREEN}`, fontWeight: 700, fontSize: 15, padding: '12px 0', borderRadius: 12, width: '100%', display: 'block', textAlign: 'center', textDecoration: 'none' }

  return (
    <div className="min-h-screen px-4 py-6" style={bg}>
      <Helmet>
        <title>{name} — Scorify Golf</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="mx-auto" style={{ maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Header */}
        <div className="text-center text-white" style={{ padding: '8px 0 4px' }}>
          <img src="/WhiteLogo.jpg" alt="Scorify Golf" style={{ width: 48, height: 48, margin: '0 auto 10px', objectFit: 'contain', borderRadius: 12 }} />
          <h1 style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.02em' }}>{name}</h1>
          {hc && (hc.courseHandicap != null || hc.index != null) && (
            <div className="flex justify-center gap-2" style={{ marginTop: 10 }}>
              {hc.courseHandicap != null && (
                <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700 }}>
                  Course handicap <span style={{ color: GOLD }}>{hc.courseHandicap}</span>
                </span>
              )}
              {hc.index != null && (
                <span style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 999, padding: '6px 14px', fontSize: 13, fontWeight: 700 }}>
                  Index <span style={{ color: GOLD }}>{hc.index.toFixed(1)}</span>
                </span>
              )}
            </div>
          )}
          {hc?.eventName && <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 6 }}>As of {hc.eventName}</p>}
        </div>

        {/* Current / next event */}
        {ev ? (
          <div style={card}>
            <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase' }}>
              {current.kind === 'active' ? (ev.event_date === today ? 'Playing today' : 'Current event') : 'Next event'}
            </p>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: '#111', marginTop: 2 }}>{eventTitle(ev)}</h2>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>
              {[prettyDate(ev.event_date), ev.course?.name].filter(Boolean).join(' · ')}
            </p>
            {group != null && (
              <p style={{ fontSize: 14, fontWeight: 700, color: GREEN, marginTop: 8 }}>
                Group {group}
                {tee?.time ? ` · ${tee.time}` : ''}
                {tee?.hole ? ` · Hole ${tee.hole}` : ''}
                {tee?.shotgun ? ' (shotgun)' : ''}
              </p>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {canScore ? (
                <button type="button" onClick={startScoring} style={primary}>Start scoring</button>
              ) : (
                <p style={{ fontSize: 13, color: '#6b7280', background: '#f3f4f6', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  {current.kind === 'upcoming'
                    ? 'Scoring opens when the event starts.'
                    : 'Scoring isn’t open yet. Ask your admin to set up today’s access codes.'}
                </p>
              )}
              <Link to={urls.leaderboard} style={secondary}>View leaderboard</Link>
              {urls.wager && <Link to={urls.wager} style={secondary}>Wager board</Link>}
            </div>
          </div>
        ) : (
          <div style={{ ...card, textAlign: 'center' }}>
            <p style={{ fontWeight: 800, color: '#111' }}>No event coming up</p>
            <p style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Check back once your next tournament is posted.</p>
          </div>
        )}

        {/* Recent results */}
        <div style={card}>
          <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.08em', color: '#6b7280', textTransform: 'uppercase', marginBottom: 6 }}>Recent results</p>
          {completed.length === 0 ? (
            <p style={{ fontSize: 13, color: '#6b7280' }}>No completed events yet.</p>
          ) : (
            <div>
              {completed.map((r, i) => {
                const res = results?.[r.event_id]
                const u = eventUrls(r.event, MIGC_ORG)
                return (
                  <Link key={r.event_id} to={u.leaderboard}
                    style={{ display: 'block', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid #f3f4f6', textDecoration: 'none' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                      <span style={{ fontWeight: 700, color: '#111', fontSize: 14 }}>{eventTitle(r.event)}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af', whiteSpace: 'nowrap' }}>{prettyDate(r.event.event_date)}</span>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 2, color: res ? '#374151' : '#9ca3af' }}>
                      {results === null
                        ? 'Loading…'
                        : res
                          ? <><strong style={{ color: GREEN }}>{res.place}</strong> of {res.fieldSize}{res.flight ? ` in Flight ${res.flight}` : ''} · Net {res.net} · Gross {res.gross}</>
                          : 'No score recorded'}
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
