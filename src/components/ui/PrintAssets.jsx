/**
 * PrintAssets — Printable golf event assets
 *
 * Three asset types:
 *  'cards'      → CTP and Long Drive cards  (5.5" × 8.5" portrait)
 *  'tee_sheet'  → Tee Sheet                 (8.5" × 11" portrait)
 *  'cart_signs' → Cart Signs                (5.5" × 8.5" portrait, 2 players / sign)
 *
 * Usage:
 *   <PrintAssets type="cards"      event={event} eventPlayers={eventPlayers} onClose={...} />
 *   <PrintAssets type="tee_sheet"  event={event} eventPlayers={eventPlayers} onClose={...} />
 *   <PrintAssets type="cart_signs" event={event} eventPlayers={eventPlayers} onClose={...} />
 */

import { useEffect } from 'react'

// ─── Colors ───────────────────────────────────────────────────────────────────
const GOLD      = '#C9A84C'
const GREEN     = '#1B4332'
const GREEN_MID = '#2D6A4F'

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcTeeTime(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  const total   = h * 60 + m + (groupNum - 1) * (intervalMins ?? 10)
  const hh      = Math.floor(total / 60) % 24
  const mm      = total % 60
  const ampm    = hh >= 12 ? 'PM' : 'AM'
  const hour    = hh % 12 || 12
  return `${hour}:${mm.toString().padStart(2, '0')} ${ampm}`
}

function formatEventDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function playerName(ep) {
  const p = ep.player ?? {}
  return `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
}

function groupedPlayers(eventPlayers) {
  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number
    if (!g) continue
    if (!groups[g]) groups[g] = []
    groups[g].push(ep)
  }
  // Sort each group by group_order
  for (const g of Object.keys(groups)) {
    groups[g].sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))
  }
  return groups
}

// ─── Shared Logo Header ───────────────────────────────────────────────────────
function LogoHeader({ logoUrl, leagueName, eventName, date, size = 'lg' }) {
  const logoSize  = size === 'sm' ? '0.8in'  : '1.1in'
  const nameSz    = size === 'sm' ? '0.17in' : '0.2in'
  const eventSz   = size === 'sm' ? '0.14in' : '0.16in'
  const dateSz    = size === 'sm' ? '0.12in' : '0.14in'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.1in' }}>
      {logoUrl ? (
        <img src={logoUrl} alt="" style={{
          width: logoSize, height: logoSize, borderRadius: '50%',
          objectFit: 'cover', border: `2.5px solid ${GOLD}`,
        }} />
      ) : (
        <div style={{
          width: logoSize, height: logoSize, borderRadius: '50%',
          background: 'rgba(255,255,255,0.12)', border: `2.5px solid ${GOLD}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.38in', color: GOLD, fontWeight: 'bold', fontFamily: 'Georgia, serif',
        }}>
          {leagueName?.slice(0, 2)?.toUpperCase() ?? '⛳'}
        </div>
      )}
      <div style={{ width: '1in', height: '1.5px', background: GOLD }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: nameSz, fontWeight: 'bold', color: GOLD, letterSpacing: '0.04em', textTransform: 'uppercase', fontFamily: 'Georgia, serif' }}>
          {leagueName}
        </div>
        <div style={{ fontSize: eventSz, color: 'rgba(255,255,255,0.8)', marginTop: '0.04in', fontFamily: 'Georgia, serif' }}>
          {eventName}
        </div>
        <div style={{ fontSize: dateSz, color: 'rgba(255,255,255,0.5)', marginTop: '0.03in', fontFamily: 'Georgia, serif' }}>
          {date}
        </div>
      </div>
    </div>
  )
}

// ─── Write-in Lines ───────────────────────────────────────────────────────────
function WriteInLines({ count = 10 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.22in', width: '100%' }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{
          borderBottom: `1px solid rgba(255,255,255,0.35)`,
          width: '100%',
          paddingBottom: '0.05in',
        }} />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET TYPE 1 — CTP / Long Drive Cards  (5.5" × 8.5")
// ═══════════════════════════════════════════════════════════════════════════════
function CtpLongDriveCard({ logoUrl, leagueName, eventName, date, competitionLine, sublabel }) {
  return (
    <div style={{
      width: '5.5in', height: '8.5in',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      background: GREEN, color: '#fff',
      padding: '0.5in 0.5in 0.45in',
      boxSizing: 'border-box',
      pageBreakAfter: 'always',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Header */}
      <LogoHeader logoUrl={logoUrl} leagueName={leagueName} eventName={eventName} date={date} />

      {/* Competition label */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '0.65in', fontWeight: 'bold', color: '#fff', lineHeight: 1.05, letterSpacing: '-0.01em' }}>
          {competitionLine}
        </div>
        {sublabel && (
          <div style={{ fontSize: '0.2in', color: GOLD, fontWeight: 'bold', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '0.1in' }}>
            {sublabel}
          </div>
        )}
      </div>

      {/* Write-in lines */}
      <div style={{ width: '100%', paddingTop: '0.15in' }}>
        <div style={{ fontSize: '0.11in', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.2in', textAlign: 'center' }}>
          Results
        </div>
        <WriteInLines count={10} />
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET TYPE 2 — Tee Sheet  (8.5" × 11")
// ═══════════════════════════════════════════════════════════════════════════════
function TeeSheetPage({ event, eventPlayers }) {
  const league     = event?.league ?? {}
  const logoUrl    = league.logo_url ?? null
  const leagueName = league.name ?? ''
  const eventName  = event?.name ?? (event?.event_number ? `Event #${event.event_number}` : '')
  const date       = formatEventDate(event?.event_date)
  const courseName = event?.course?.name ?? ''
  const interval   = event?.tee_time_interval_mins ?? 10
  const isShotgun  = event?.shotgun_start ?? false
  const holeMap    = event?.group_hole_assignments ?? {}

  const groups = groupedPlayers(eventPlayers)
  const groupNums = Object.keys(groups).map(Number).sort((a, b) => a - b)

  return (
    <div style={{
      width: '8.5in', minHeight: '11in',
      background: '#fff', color: '#111',
      padding: '0.5in 0.6in',
      boxSizing: 'border-box',
      fontFamily: 'Georgia, serif',
      pageBreakAfter: 'always',
    }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25in', marginBottom: '0.25in' }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: '0.85in', height: '0.85in', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${GOLD}`, flexShrink: 0 }} />
        ) : (
          <div style={{ width: '0.85in', height: '0.85in', borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, fontWeight: 'bold', fontSize: '0.28in', flexShrink: 0 }}>
            {leagueName?.slice(0, 2)?.toUpperCase() ?? '⛳'}
          </div>
        )}
        <div>
          <div style={{ fontSize: '0.22in', fontWeight: 'bold', color: GREEN, letterSpacing: '-0.01em' }}>{leagueName}</div>
          <div style={{ fontSize: '0.18in', color: '#333', marginTop: '0.03in' }}>{eventName}</div>
          <div style={{ fontSize: '0.13in', color: '#666', marginTop: '0.02in' }}>
            {[date, courseName, event?.start_time ? `First tee ${calcTeeTime(event.start_time, interval, 1)}` : null, `${interval}-min intervals`].filter(Boolean).join('  ·  ')}
          </div>
        </div>
      </div>

      {/* Gold divider */}
      <div style={{ height: '2px', background: `linear-gradient(90deg, ${GOLD}, ${GREEN})`, marginBottom: '0.2in' }} />

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '0.9in 0.65in 3.5in 1.5in',
        gap: '0 0.15in', padding: '0.07in 0.12in',
        background: GREEN, color: '#fff', borderRadius: '3px',
        fontSize: '0.13in', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase',
        marginBottom: '0.04in',
      }}>
        <div>Time</div>
        <div>Group</div>
        <div>Players</div>
        <div>Hole</div>
      </div>

      {/* Rows */}
      {groupNums.map((g, i) => {
        const members  = groups[g]
        const teeTime  = isShotgun ? calcTeeTime(event?.start_time, 0, 1) : calcTeeTime(event?.start_time, interval, g)
        const names    = members.map(ep => {
          const p = ep.player ?? {}
          return `${p.last_name ?? ''}${p.first_name ? ', ' + p.first_name : ''}`
        }).join('  /  ')

        return (
          <div key={g} style={{
            display: 'grid', gridTemplateColumns: '0.9in 0.65in 3.5in 1.5in',
            gap: '0 0.15in', padding: '0.1in 0.12in',
            background: i % 2 === 0 ? '#f8f8f6' : '#fff',
            borderBottom: '1px solid #e8e8e4',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: '0.15in', fontWeight: 'bold', color: GREEN }}>
              {teeTime ?? '—'}
            </div>
            <div style={{ fontSize: '0.14in', color: '#555', fontWeight: 'bold' }}>
              #{g}
            </div>
            <div style={{ fontSize: '0.14in', color: '#222', lineHeight: 1.4 }}>
              {names || '—'}
            </div>
            <div style={{ fontSize: '0.13in', color: '#888' }}>
              {isShotgun ? (holeMap[g] ? `Hole ${holeMap[g]}` : '—') : 'Hole 1'}
            </div>
          </div>
        )
      })}

      {groupNums.length === 0 && (
        <div style={{ textAlign: 'center', padding: '0.5in', color: '#999', fontSize: '0.15in' }}>
          No groups assigned yet.
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '0.3in', borderTop: `1px solid ${GOLD}`, paddingTop: '0.12in', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: '0.11in', color: '#aaa' }}>
          {groupNums.length} group{groupNums.length !== 1 ? 's' : ''} · {eventPlayers.filter(ep => ep.group_number).length} players
        </div>
        <div style={{ fontSize: '0.11in', color: '#aaa' }}>
          Printed {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET TYPE 3 — Cart Signs  (5.5" × 8.5", 2 players per card)
// ═══════════════════════════════════════════════════════════════════════════════
function CartSignCard({ logoUrl, leagueName, eventName, date, groupNum, teeTime, holeLabel, players }) {
  return (
    <div style={{
      width: '5.5in', height: '8.5in',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      background: GREEN, color: '#fff',
      padding: '0.45in 0.5in',
      boxSizing: 'border-box',
      pageBreakAfter: 'always',
      fontFamily: 'Georgia, serif',
    }}>
      {/* Header */}
      <LogoHeader logoUrl={logoUrl} leagueName={leagueName} eventName={eventName} date={date} size="sm" />

      {/* Group info */}
      <div style={{ textAlign: 'center', width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.3in', marginBottom: '0.15in' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '0.11in', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Group</div>
            <div style={{ fontSize: '0.38in', fontWeight: 'bold', color: '#fff', lineHeight: 1 }}>#{groupNum}</div>
          </div>
          {teeTime && (
            <>
              <div style={{ width: '1px', background: 'rgba(255,255,255,0.2)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.11in', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tee Time</div>
                <div style={{ fontSize: '0.38in', fontWeight: 'bold', color: GOLD, lineHeight: 1 }}>{teeTime}</div>
              </div>
            </>
          )}
        </div>

        {/* Hole */}
        <div style={{ fontSize: '0.13in', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.04em' }}>
          {holeLabel ?? 'Hole 1'}
        </div>
      </div>

      {/* Player names */}
      <div style={{ width: '100%' }}>
        <div style={{ width: '2in', height: '1.5px', background: GOLD, margin: '0 auto 0.2in' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.18in' }}>
          {players.map((ep, i) => (
            <div key={ep.id ?? i} style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '6px',
              padding: '0.14in 0.2in',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.22in', fontWeight: 'bold', color: '#fff', lineHeight: 1.1 }}>
                {playerName(ep) || '—'}
              </div>
              {ep.flight && (
                <div style={{ fontSize: '0.12in', color: GOLD, marginTop: '0.04in', letterSpacing: '0.04em' }}>
                  Flight {ep.flight}
                </div>
              )}
            </div>
          ))}
          {/* Blank slots if fewer than 2 */}
          {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
            <div key={`blank-${i}`} style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px dashed rgba(255,255,255,0.1)',
              borderRadius: '6px',
              padding: '0.14in 0.2in',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '0.18in', color: 'rgba(255,255,255,0.2)' }}>—</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main PrintAssets component
// ═══════════════════════════════════════════════════════════════════════════════
const PAGE_SIZE = {
  cards:      '5.5in 8.5in',
  tee_sheet:  '8.5in 11in',
  cart_signs: '5.5in 8.5in',
}

const TITLES = {
  cards:      'CTP & Long Drive Cards',
  tee_sheet:  'Tee Sheet',
  cart_signs: 'Cart Signs',
}

export default function PrintAssets({ type, event, eventPlayers = [], onClose }) {
  const league     = event?.league ?? {}
  const logoUrl    = league.logo_url ?? null
  const leagueName = league.name ?? ''
  const eventName  = event?.name ?? (event?.event_number ? `Event #${event.event_number}` : '')
  const date       = formatEventDate(event?.event_date)
  const interval   = event?.tee_time_interval_mins ?? 10

  // ── Derive cards list based on type ──────────────────────────────────────
  let printNodes = []

  if (type === 'cards') {
    const payoutConfig = event?.payout_config ?? {}
    const ctpHoles = Object.keys(payoutConfig)
      .filter(k => k.startsWith('ctp_'))
      .map(k => parseInt(k.replace('ctp_', ''), 10))
      .sort((a, b) => a - b)

    const hasLongDrive = (event?.side_game_options ?? []).some(s => s.startsWith('long_drive'))
    const ldHole = event?.long_drive_hole ?? null

    ctpHoles.forEach(h => {
      printNodes.push(
        <CtpLongDriveCard key={`ctp_${h}`}
          logoUrl={logoUrl} leagueName={leagueName} eventName={eventName} date={date}
          competitionLine={`Hole ${h}`}
          sublabel="Closest to the Pin"
        />
      )
    })

    if (hasLongDrive) {
      printNodes.push(
        <CtpLongDriveCard key="long_drive"
          logoUrl={logoUrl} leagueName={leagueName} eventName={eventName} date={date}
          competitionLine={ldHole ? `Hole ${ldHole}` : 'Long Drive'}
          sublabel={ldHole ? 'Long Drive' : null}
        />
      )
    }
  }

  if (type === 'tee_sheet') {
    printNodes = [
      <TeeSheetPage key="tee_sheet" event={event} eventPlayers={eventPlayers} />
    ]
  }

  if (type === 'cart_signs') {
    const groups        = groupedPlayers(eventPlayers)
    const groupNums     = Object.keys(groups).map(Number).sort((a, b) => a - b)
    const isShotgun     = event?.shotgun_start ?? false
    const holeMap       = event?.group_hole_assignments ?? {}

    groupNums.forEach(g => {
      const members  = groups[g]
      const teeTime  = isShotgun ? (event?.start_time ? calcTeeTime(event.start_time, 0, 1) : null)
                                 : calcTeeTime(event?.start_time, interval, g)
      const holeLabel = isShotgun
        ? (holeMap[g] ? `Hole ${holeMap[g]}` : 'TBD')
        : 'Hole 1'

      const card1 = members.slice(0, 2)
      const card2 = members.slice(2, 4)

      printNodes.push(
        <CartSignCard key={`g${g}-c1`}
          logoUrl={logoUrl} leagueName={leagueName} eventName={eventName} date={date}
          groupNum={g} teeTime={teeTime} holeLabel={holeLabel} players={card1}
        />
      )
      if (card2.length > 0) {
        printNodes.push(
          <CartSignCard key={`g${g}-c2`}
            logoUrl={logoUrl} leagueName={leagueName} eventName={eventName} date={date}
            groupNum={g} teeTime={teeTime} holeLabel={holeLabel} players={card2}
          />
        )
      }
    })
  }

  // ── Print CSS ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const size = PAGE_SIZE[type] ?? '8.5in 11in'
    const style = document.createElement('style')
    style.id = 'print-assets-style'
    style.textContent = `
      @page { size: ${size}; margin: 0; }
      @media print {
        body > * { display: none !important; }
        #print-assets-root { display: flex !important; }
      }
    `
    document.head.appendChild(style)
    return () => document.getElementById('print-assets-style')?.remove()
  }, [type])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (printNodes.length === 0) {
    const hint = type === 'cards'
      ? 'Add CTP holes in Payout Config or enable Long Drive to generate cards.'
      : type === 'cart_signs'
      ? 'Assign players to groups first in the Groups tab.'
      : 'No data to print.'

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
          <p className="text-gray-700 font-semibold mb-1">Nothing to print yet</p>
          <p className="text-sm text-gray-400 mb-5">{hint}</p>
          <button onClick={onClose} className="px-5 py-2 rounded-lg bg-gray-100 text-gray-700 font-medium hover:bg-gray-200">Close</button>
        </div>
      </div>
    )
  }

  const cardCount = printNodes.length
  const subtitle  = type === 'cards'      ? `${cardCount} card${cardCount !== 1 ? 's' : ''} · 5.5" × 8.5"`
                  : type === 'tee_sheet'  ? '1 page · 8.5" × 11"'
                  : `${cardCount} sign${cardCount !== 1 ? 's' : ''} · 5.5" × 8.5" · 2 players / sign`

  return (
    <>
      {/* Preview modal */}
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(0,0,0,0.72)' }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 bg-white shadow-md flex-shrink-0">
          <div>
            <span className="font-semibold text-gray-900">{TITLES[type]}</span>
            <span className="ml-2 text-sm text-gray-400">{subtitle}</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium">
              Close
            </button>
            <button
              onClick={() => window.print()}
              className="px-4 py-1.5 rounded-lg text-sm text-white font-medium"
              style={{ background: GREEN }}
            >
              🖨 Print
            </button>
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="flex-1 overflow-y-auto py-8 flex flex-col items-center gap-6">
          {printNodes.map((node, i) => (
            <div key={i} style={{ boxShadow: '0 4px 28px rgba(0,0,0,0.5)', borderRadius: 4, overflow: 'hidden' }}>
              {node}
            </div>
          ))}
        </div>
      </div>

      {/* Hidden element that actually prints */}
      <div
        id="print-assets-root"
        style={{ display: 'none', flexDirection: 'column', position: 'fixed', top: 0, left: 0, zIndex: 9999 }}
      >
        {printNodes}
      </div>
    </>
  )
}
