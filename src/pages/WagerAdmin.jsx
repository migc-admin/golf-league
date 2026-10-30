/**
 * WagerAdmin.jsx — Admin wager board
 * Route: /wager/:eventId/board
 *
 * Presentation only: shown inside the event admin layout (sidebar with a Wagers item). Every
 * handler and number is the one the board always had; pool math, winners and payouts live in
 * lib/wagerSettlement.js.
 */

import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { computeWagerSettlement, wagerOutcomes } from '../lib/wagerSettlement'
import WagerShareCard, { WAGER_CARD_WIDTH } from '../components/WagerShareCard'
import { buildManualWagerRow } from '../lib/wagerManual'
import { buildResultsModel } from '../lib/wagerResultsView'
import { buildSummary, poolView } from '../lib/wagerSummaryView'
import AdminLayout from '../components/AdminLayout'
import WagerPageHeader from '../components/wager/WagerPageHeader'
import StatTiles from '../components/ui/StatTiles'
import Button from '../components/ui/Button'
import AmberBanner from '../components/ui/AmberBanner'
import PngWagerSummary from '../components/wager/PngWagerSummary'
import { wagerPngFilename } from '../lib/wagerExport'
import { PoolView } from '../components/wager/ResultsViews'
import {
  BettingStatusBar, AllBetsCard, RemovedBetsCard, ManualBetCard, PaymentsCard, OddsCard, MatchPoolsCard, Card, fmt,
} from '../components/wager/AdminBoard'

const MIGC_ORG = import.meta.env.VITE_MIGC_ORG_ID

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
  const [exportingPng, setExportingPng] = useState(false)
  const shareRef = useRef(null)
  const [extraNames,  setExtraNames]  = useState({}) // id -> name, for picked players no longer in the event
  const [memberNames, setMemberNames] = useState([]) // org members, to show bettors' proper names in the PNG
  const [printing, setPrinting] = useState(false)

  async function loadData() {
    const { data: ev } = await supabase
      .from('events')
      .select('*, course:courses(*), league:leagues(name, slug, logo_url, org_id)')
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

    const { data: orgPlayers } = await supabase.from('players').select('first_name, last_name').eq('org_id', ev.league.org_id)
    setMemberNames((orgPlayers ?? []).map(p => `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()).filter(Boolean))

    const wagerRows = await fetchWagers(eventId)
    setWagers(wagerRows)

    // Scores always loaded — used for live leaderboard during active event too
    const { data: sc } = await supabase
      .from('scores')
      .select('player_id, hole_number, gross_score, putts')
      .eq('event_id', eventId)
    setScores(sc ?? [])

    // Match play pairings — drives match wager pools and settlement
    const { data: mp } = await supabase
      .from('match_pairings')
      .select('*')
      .eq('event_id', eventId)
      .order('match_number')
    setPairings(mp ?? [])

    // A bet or match can point at a player who is no longer in this event (removed, or a
    // merge that did not finish). Look their names up so the board can still show who was picked.
    const inField = new Set((eps ?? []).map(e => e.player_id))
    const missing = new Set()
    for (const w of wagerRows) for (const id of [w.pick_1st, w.pick_2nd, w.pick_match]) if (id && !inField.has(id)) missing.add(id)
    for (const m of mp ?? []) for (const id of [m.player_a_id, m.player_b_id]) if (id && !inField.has(id)) missing.add(id)
    if (missing.size > 0) {
      const { data: gone } = await supabase.from('players').select('id, first_name, last_name').in('id', [...missing])
      setExtraNames(Object.fromEntries((gone ?? []).map(p => [p.id, `${p.first_name} ${p.last_name}`])))
    } else {
      setExtraNames({})
    }

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
    if (!ep) return extraNames[pid] ? `${extraNames[pid]} (not in event)` : '—'
    return `${ep.player.first_name} ${ep.player.last_name}`
  }

  // A bet taken in person: same row shape the public page inserts. Works whether betting is open or closed.
  async function addManualBet(fields) {
    const { row, error: invalid } = buildManualWagerRow({ eventId, ...fields })
    if (invalid) { alert(invalid); return false }
    let { error: insErr } = await supabase.from('wagers').insert(row)
    // If the payment_method column isn't in the database yet, save the bet without it.
    if (insErr && /payment_method/i.test(insErr.message ?? '')) {
      const { payment_method, ...withoutMethod } = row
      ;({ error: insErr } = await supabase.from('wagers').insert(withoutMethod))
    }
    if (insErr) { alert('Could not save the bet: ' + insErr.message); return false }
    setWagers(await fetchWagers(eventId))
    return true
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

  const Notice = ({ children, tone = 'text-ink-muted' }) => (
    <div className={`flex min-h-screen items-center justify-center bg-surface-dim px-4 text-center font-sans ${tone}`}>{children}</div>
  )
  if (authLoading || loading) return <Notice>Loading…</Notice>
  if (!isAdmin) return <Notice tone="text-ink"><div><div className="text-lg font-bold text-red-600">Access Denied</div><div className="mt-1 text-sm text-ink-muted">Admin login required.</div><a href="/login" className="mt-3 inline-block text-sm font-semibold text-fairway-700">Sign in →</a></div></Notice>
  if (error) return <Notice tone="text-red-600">{error}</Notice>

  const active  = wagers.filter(w => !w.deleted_at)
  const inFieldIds = new Set(players.map(p => p.player_id))
  const orphanPicks = {}
  for (const w of active) {
    const pid = w.pick_match ?? w.pick_1st ?? w.pick_2nd
    if (pid && !inFieldIds.has(pid)) {
      const o = (orphanPicks[pid] ??= { name: extraNames[pid] ?? 'Unknown player', bets: 0, amount: 0 })
      o.bets += 1; o.amount += parseFloat(w.amount)
    }
  }
  const orphanMatches = pairings.filter(m => !inFieldIds.has(m.player_a_id) || !inFieldIds.has(m.player_b_id))
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

  // PNG of the board (pools, results with payouts, live odds) to share with the group.
  async function exportPng() {
    if (!shareRef.current) return
    setExportingPng(true)
    try {
      const [{ toPng }, { wagerPngFilename }] = await Promise.all([
        import('html-to-image'),
        import('../lib/wagerExport'),
      ])
      if (document.fonts?.ready) await document.fonts.ready
      await new Promise(r => setTimeout(r, 80))
      const dataUrl = await toPng(shareRef.current, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#F5F4F0',
        width: WAGER_CARD_WIDTH,
      })
      const link = document.createElement('a')
      link.download = wagerPngFilename(event)
      link.href = dataUrl
      link.click()
    } catch (err) {
      console.error('Wager PNG export failed:', err)
      alert('Could not create the image: ' + (err?.message ?? err))
    } finally {
      setExportingPng(false)
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

  const model = buildResultsModel({ event, settlement, active, nameOf: playerName, memberNames })
  const summary = buildSummary(model)
  const settled = event.status === 'complete'
  const eventName = event.name ?? `Event #${event.event_number}`
  const meta = [eventName, event.course?.name, eventDate].filter(Boolean).join(' · ')
  const generatedOn = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  const betFormUrl = `${window.location.origin}/wager/${eventId}`
  const betNote = autoClosed ? 'Automatically closed 10 min before tee time.' : event.wagers_closed ? 'Manually closed by admin.' : null

  const closeMenu = e => e.currentTarget.closest('details')?.removeAttribute('open')

  const tiles = [
    { label: 'Win pool', value: fmt(winPool) },
    { label: 'Place pool', value: fmt(placePool) },
    { label: 'Match pools', value: fmt(matchPoolTotal), helper: `${pairings.length} match${pairings.length === 1 ? '' : 'es'}` },
    { label: 'Total pot', value: fmt(totalPot + matchPoolTotal), helper: `${active.length} bet${active.length === 1 ? '' : 's'}`, tone: 'good' },
  ]

  const eventContext = {
    eventSlug: event.slug,
    leagueSlug: event.league?.slug,
    meta: {
      id: eventId, isMigc: true, name: eventName, status: event.status,
      sideGameOptions: event.side_game_options ?? [],
      hasMatchPlay: [...(event.formats ?? (event.format ? [event.format] : []))].some(f => f === 'match_points' || f === 'ryder_cup'),
    },
  }

  return (
    <AdminLayout eventContext={eventContext}>
      <div className="space-y-6 font-sans">
        <WagerPageHeader
          leagueName={event.league?.name}
          logoUrl={event.league?.logo_url}
          title="Wagers"
          pill={{ tone: bettingOpen ? 'open' : 'closed', label: bettingOpen ? 'Betting open' : settled ? 'Betting closed · Settled' : 'Betting closed' }}
          meta={meta}
          actions={
            <>
              <Button as={Link} to={`/wager/${eventId}`} variant="secondary" icon="external" iconAfter>Bet form</Button>
              <Button as={Link} to={`/wager/${eventId}/results`} variant="secondary" icon="external" iconAfter>Public results</Button>
              <details className="relative">
                <summary className="inline-flex min-h-[44px] cursor-pointer list-none items-center rounded-sm border border-surface-highest bg-white px-4 text-sm font-semibold text-ink hover:bg-surface-dim [&::-webkit-details-marker]:hidden">Exports</summary>
                <div className="absolute right-0 z-20 mt-1 w-44 rounded-sm border border-surface-border bg-white p-1 shadow-card">
                  {wagers.length > 0 && <button type="button" disabled={exporting} onClick={e => { closeMenu(e); exportExcel() }} className="flex min-h-[44px] w-full items-center rounded-sm px-3 text-left text-sm text-ink hover:bg-surface-dim disabled:opacity-60">{exporting ? 'Exporting…' : 'Export Excel'}</button>}
                  {active.length > 0 && <button type="button" disabled={exportingPng} onClick={e => { closeMenu(e); exportPng() }} className="flex min-h-[44px] w-full items-center rounded-sm px-3 text-left text-sm text-ink hover:bg-surface-dim disabled:opacity-60">{exportingPng ? 'Creating…' : 'Export PNG'}</button>}
                  {wagers.length === 0 && <span className="block px-3 py-2 text-xs text-ink-muted">Nothing to export yet.</span>}
                </div>
              </details>
              {settled && <Button onClick={() => setPrinting(true)} icon="download">Payout summary (PNG)</Button>}
            </>
          }
        />

        <StatTiles tiles={tiles} />

        <BettingStatusBar
          open={bettingOpen}
          count={active.length}
          note={betNote}
          canToggle={!settled && !autoClosed}
          toggling={toggling}
          onToggle={toggleBettingClosed}
        />

        {(Object.keys(orphanPicks).length > 0 || orphanMatches.length > 0) && (
          <AmberBanner title="Some bets are on players who are no longer in this event.">
            {[
              ...Object.values(orphanPicks).map(o => `${o.name}: ${o.bets} bet${o.bets > 1 ? 's' : ''}, ${fmt(o.amount)}.`),
              ...orphanMatches.map(m => `Match ${m.match_number} includes a player who is not in the event, so it can't be scored.`),
            ].join(' ')} Their results and payouts can't be calculated until the player is back in the event.
          </AmberBanner>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-6">
            <AllBetsCard
              bets={active}
              pairings={pairings}
              playerName={playerName}
              acting={acting}
              onPayment={setPaymentMethod}
              onDelete={softDelete}
              onClearAll={clearAll}
              onCopyLink={() => navigator.clipboard?.writeText(betFormUrl)}
            />
            <RemovedBetsCard bets={deleted} pairings={pairings} playerName={playerName} acting={acting} onRestore={restore} />
          </div>
          <ManualBetCard
            players={players}
            pairings={pairings}
            playerName={playerName}
            bettorNames={[...new Set(active.map(w => w.bettor_name.trim()))].sort((a, b) => a.localeCompare(b))}
            onAdd={addManualBet}
          />
        </div>

        <PaymentsCard rows={payRows} totals={payTotals} />
        <OddsCard rows={model.odds} />
        <MatchPoolsCard cards={matchCards} playerName={playerName} />

        {showResults && scores.length > 0 && (winResults || placeResults || model.matches.length > 0) && (
          <Card title="Wager results" aside={settled ? 'Final · Low net score' : 'Live · Updates as scores are entered'}>
            <PoolView cards={poolView(model)} searching={false} />
          </Card>
        )}

        <p className="text-xs text-ink-muted">
          Full pool paid to winner(s). If no one picks the winner, funds roll to the club. Halved matches refund stakes.
        </p>
      </div>

      {/* Off-screen copy of the board, captured as a PNG by "Export PNG" */}
      <div style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none', zIndex: -1 }} aria-hidden="true">
        <div ref={shareRef}>
          <WagerShareCard
            event={event}
            eventDate={eventDate}
            logoUrl={event.league?.logo_url ?? '/logo.png'}
            model={model}
          />
        </div>
      </div>

      {printing && (
        <PngWagerSummary
          filename={wagerPngFilename(event).replace(/^wager-results-/, 'wager-summary-')}
          onDone={() => setPrinting(false)}
          logoUrl={event.league?.logo_url}
          leagueName={event.league?.name}
          eventName={eventName}
          meta={meta}
          summary={summary}
          generatedOn={generatedOn}
        />
      )}
    </AdminLayout>
  )
}
