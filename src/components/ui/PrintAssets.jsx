/**
 * PrintAssets — Printable golf event assets
 *
 * Three asset types:
 *  'cards'      → CTP and Long Drive cards  (4.72" × 8.27" portrait / A5)
 *  'tee_sheet'  → Tee Sheet                 (8.5" × 11" portrait)
 *  'cart_signs' → Cart Signs                (8.5" × 5.5" landscape)
 */

import { useEffect, useRef, useState, forwardRef } from 'react'
import { createPortal } from 'react-dom'
import { toPng } from 'html-to-image'
import html2canvas from 'html2canvas'

const GOLD  = '#C9A84C'
const GREEN = '#1B4332'
const FONT  = "'Playfair Display', Georgia, serif"

// ─── Mobile-safe PNG download ─────────────────────────────────────
// iOS Safari ignores <a download> — open in new tab instead so user can long-press save
function downloadPng(dataUrl, filename) {
  const isMobileSafari = /iphone|ipad|ipod/i.test(navigator.userAgent)
  if (isMobileSafari) {
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(`<html><body style="margin:0;background:#000"><img src="${dataUrl}" style="max-width:100%;display:block"/></body></html>`)
      w.document.close()
    }
  } else {
    const link = document.createElement('a')
    link.download = filename
    link.href = dataUrl
    link.click()
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function calcTeeTime(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  const total  = h * 60 + m + (groupNum - 1) * (intervalMins ?? 10)
  const hh     = Math.floor(total / 60) % 24
  const mm     = total % 60
  const ampm   = hh >= 12 ? 'p.m.' : 'a.m.'
  const hour   = hh % 12 || 12
  return `${hour}:${mm.toString().padStart(2, '0')} ${ampm}`
}

function shortDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })
}

function formatEventDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function groupedPlayers(eventPlayers) {
  const groups = {}
  for (const ep of eventPlayers) {
    const g = ep.group_number
    if (g == null || g === 0) continue
    const key = Number(g)
    if (!groups[key]) groups[key] = []
    groups[key].push(ep)
  }
  for (const g of Object.keys(groups)) {
    groups[g].sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))
  }
  return groups
}

function epName(ep, { showFlight = false, tglSet = null } = {}) {
  const p    = ep?.player ?? {}
  const name = [p.first_name, p.last_name].filter(Boolean).join(' ') || '—'
  const flight = showFlight && ep?.flight ? ` (${ep.flight})` : ''
  const star   = tglSet?.has(ep?.player_id) ? '*' : ''
  return `${name}${flight}${star}`
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET TYPE 1 — CTP / Long Drive Cards  (4.72" × 8.27" — A5 portrait)
// ═══════════════════════════════════════════════════════════════════════════════
function CtpLongDriveCard({ logoUrl, leagueName, eventName, date, competitionLine }) {
  return (
    <div style={{
      width: '4.72in', height: '8.27in',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      background: '#fff', color: '#111',
      padding: '0.45in 0.55in 0.4in',
      boxSizing: 'border-box',
      fontFamily: FONT,
    }}>
      {/* Logo */}
      {logoUrl ? (
        <img src={logoUrl} alt="" style={{
          width: '1.15in', height: '1.15in', borderRadius: '50%',
          objectFit: 'cover', marginBottom: '0.18in',
        }} />
      ) : (
        <div style={{
          width: '1.15in', height: '1.15in', borderRadius: '50%',
          background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: GOLD, fontWeight: 'bold', fontSize: '0.38in', marginBottom: '0.18in',
          fontFamily: FONT,
        }}>
          {leagueName?.slice(0, 2)?.toUpperCase() ?? '⛳'}
        </div>
      )}

      {/* League name */}
      <div style={{ fontSize: '0.24in', fontWeight: 'bold', color: '#111', textAlign: 'center', lineHeight: 1.2, marginBottom: '0.06in', fontFamily: FONT }}>
        {leagueName}
      </div>

      {/* Event / date */}
      <div style={{ fontSize: '0.18in', color: '#333', textAlign: 'center', lineHeight: 1.3, marginBottom: '0.22in', fontFamily: FONT }}>
        {eventName}{eventName && date ? ' / ' : ''}{date}
      </div>

      {/* Divider */}
      <div style={{ width: '2.8in', height: '1px', background: '#bbb', marginBottom: '0.22in' }} />

      {/* Competition label */}
      <div style={{ fontSize: '0.26in', fontWeight: 'bold', color: '#111', textAlign: 'center', lineHeight: 1.2, marginBottom: '0.3in', fontFamily: FONT }}>
        {competitionLine}
      </div>

      {/* Write-in lines */}
      <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingTop: '0.1in' }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={{ borderBottom: '1px solid #bbb', width: '100%' }} />
        ))}
      </div>
    </div>
  )
}

// Two CTP/Long Drive cards, shrunk to fit side-by-side on a standard Letter sheet
const CTP_ORIG_W    = 4.72
const CTP_ORIG_H    = 8.27
const CTP_PAGE_MARGIN = 0.4  // in
const CTP_GAP         = 0.3  // in

function CtpCardsPage({ cards }) {
  const availW = 8.5 - CTP_PAGE_MARGIN * 2
  const cardW  = (availW - CTP_GAP) / 2
  const scale  = cardW / CTP_ORIG_W
  const cardH  = CTP_ORIG_H * scale

  return (
    <div style={{
      width: '8.5in', height: '11in',
      boxSizing: 'border-box',
      padding: `${CTP_PAGE_MARGIN}in`,
      display: 'flex', justifyContent: 'center', alignItems: 'flex-start',
      gap: `${CTP_GAP}in`,
      background: '#fff',
      pageBreakAfter: 'always',
    }}>
      {cards.map((c, i) => (
        <div key={i} style={{
          width: `${cardW}in`, height: `${cardH}in`,
          boxSizing: 'border-box',
          border: '1.5px dashed #999',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${CTP_ORIG_W}in`, height: `${CTP_ORIG_H}in`,
            transform: `scale(${scale})`, transformOrigin: 'top left',
          }}>
            <CtpLongDriveCard {...c} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET TYPE 2 — Tee Sheet  (8.5" × 11")
// ═══════════════════════════════════════════════════════════════════════════════
function TeeSheetPage({ event, eventPlayers, forPng = false, tglSelections = [] }) {
  const league     = event?.league ?? {}
  const logoUrl    = league.logo_url ?? null
  const leagueName = league.name ?? ''
  const eventName  = event?.name ?? (event?.event_number ? `Event #${event.event_number}` : '')
  const date       = formatEventDate(event?.event_date)
  const courseName = event?.course?.name ?? ''
  const interval   = event?.tee_time_interval_mins ?? 10
  const isShotgun  = event?.shotgun_start ?? false
  const holeMap    = event?.group_hole_assignments ?? {}

  const hasFlights = eventPlayers.some(ep => ep.flight === 'A' || ep.flight === 'B')
  const tglSet     = tglSelections.length > 0 ? new Set(tglSelections.map(s => s.player_id)) : null
  const hasTgl     = tglSet && tglSet.size > 0

  const groups    = groupedPlayers(eventPlayers)
  const groupNums = Object.keys(groups).map(Number).sort((a, b) => a - b)

  const cols = '0.85in 0.55in 4.5in 0.75in'

  return (
    <div style={{
      width: '8.5in', ...(forPng ? {} : { minHeight: '11in' }),
      background: '#fff', color: '#111',
      padding: '0.5in 0.55in',
      boxSizing: 'border-box',
      fontFamily: FONT,
      ...(forPng ? {} : { pageBreakAfter: 'always' }),
    }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.22in', marginBottom: '0.22in' }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: '0.85in', height: '0.85in', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${GOLD}`, flexShrink: 0 }} />
        ) : (
          <div style={{ width: '0.85in', height: '0.85in', borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, fontWeight: 'bold', fontSize: '0.28in', flexShrink: 0, fontFamily: FONT }}>
            {leagueName?.slice(0, 2)?.toUpperCase() ?? '⛳'}
          </div>
        )}
        <div>
          <div style={{ fontSize: '0.22in', fontWeight: 'bold', color: GREEN, fontFamily: FONT }}>{leagueName}</div>
          <div style={{ fontSize: '0.17in', color: '#333', marginTop: '0.03in', fontFamily: FONT }}>{eventName}</div>
          <div style={{ fontSize: '0.12in', color: '#666', marginTop: '0.02in', fontFamily: FONT }}>
            {[
              date,
              courseName,
              isShotgun ? 'Shotgun Start' : (event?.start_time ? `First tee ${calcTeeTime(event.start_time, interval, 1)}` : null),
              !isShotgun ? `${interval}-min intervals` : null,
            ].filter(Boolean).join('  ·  ')}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '2px', background: `linear-gradient(90deg, ${GOLD}, ${GREEN})`, marginBottom: '0.18in' }} />

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: cols,
        gap: '0 0.1in', padding: '0.07in 0.1in',
        background: GREEN, color: '#fff', borderRadius: '3px',
        fontSize: '0.12in', fontWeight: 'bold', letterSpacing: '0.04em', textTransform: 'uppercase',
        marginBottom: '0.03in', fontFamily: FONT,
      }}>
        <div>Time</div>
        <div>Group</div>
        <div>Players</div>
        <div>Hole</div>
      </div>

      {/* Rows */}
      {groupNums.map((g, i) => {
        const members = groups[g]
        const teeTime = isShotgun
          ? calcTeeTime(event?.start_time, 0, 1)
          : calcTeeTime(event?.start_time, interval, g)
        const names = members.map(ep => epName(ep, { showFlight: hasFlights, tglSet })).join('  /  ')
        const hole  = isShotgun ? (holeMap[g] ? `Hole ${holeMap[g]}` : '—') : 'Hole 1'

        return (
          <div key={g} style={{
            display: 'grid', gridTemplateColumns: cols,
            gap: '0 0.1in', padding: '0.09in 0.1in',
            background: i % 2 === 0 ? '#f7f7f5' : '#fff',
            borderBottom: '1px solid #e8e8e4',
            alignItems: 'center',
          }}>
            <div style={{ fontSize: '0.14in', fontWeight: 'bold', color: GREEN, whiteSpace: 'nowrap', fontFamily: FONT }}>
              {teeTime ?? '—'}
            </div>
            <div style={{ fontSize: '0.13in', color: '#555', fontWeight: 'bold', fontFamily: FONT }}>#{g}</div>
            <div style={{ fontSize: '0.13in', color: '#222', lineHeight: 1.3, wordBreak: 'break-word', fontFamily: FONT }}>
              {names || '—'}
            </div>
            <div style={{ fontSize: '0.12in', color: '#888', whiteSpace: 'nowrap', fontFamily: FONT }}>{hole}</div>
          </div>
        )
      })}

      {groupNums.length === 0 && (
        <div style={{ textAlign: 'center', padding: '0.5in', color: '#999', fontSize: '0.14in', fontFamily: FONT }}>
          No groups assigned yet.
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: '0.2in', borderTop: `1px solid ${GOLD}`, paddingTop: '0.1in' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ fontSize: '0.1in', color: '#aaa', fontFamily: FONT }}>
            {groupNums.length} group{groupNums.length !== 1 ? 's' : ''} · {eventPlayers.filter(ep => ep.group_number).length} players
          </div>
          <div style={{ fontSize: '0.1in', color: '#aaa', fontFamily: FONT }}>Printed {new Date().toLocaleDateString()}</div>
        </div>
        {hasTgl && (
          <div style={{ marginTop: '0.06in', fontSize: '0.1in', color: '#888', fontFamily: FONT }}>
            * Participating in Team Play for this event
          </div>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSET TYPE 3 — Cart Signs  (8.5" × 5.5" landscape)
// ═══════════════════════════════════════════════════════════════════════════════
function CartSignCard({ logoUrl, leagueName, eventName, date, groupNum, teeTime, holeLabel, players }) {
  return (
    <div style={{
      width: '8.5in', height: '5.5in',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      background: '#fff', color: '#111',
      padding: '0.38in 0.65in',
      boxSizing: 'border-box',
      fontFamily: FONT,
    }}>
      {/* Logo + league + event/date */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.08in', marginBottom: '0.18in' }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: '0.9in', height: '0.9in', borderRadius: '50%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '0.9in', height: '0.9in', borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', color: GOLD, fontWeight: 'bold', fontSize: '0.3in', fontFamily: FONT }}>
            {leagueName?.slice(0, 2)?.toUpperCase() ?? '⛳'}
          </div>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.28in', fontWeight: 'bold', color: '#111', lineHeight: 1.15, fontFamily: FONT }}>
            {leagueName}
          </div>
          <div style={{ fontSize: '0.22in', color: '#222', lineHeight: 1.2, fontFamily: FONT }}>
            {eventName}{eventName && date ? ' / ' : ''}{date}
          </div>
        </div>
      </div>

      {/* Group number */}
      <div style={{ fontSize: '0.3in', fontWeight: 'bold', color: '#111', marginBottom: '0.18in', fontFamily: FONT }}>
        Group #{groupNum}
      </div>

      {/* Divider */}
      <div style={{ width: '6in', height: '1px', background: '#ccc', marginBottom: '0.18in' }} />

      {/* Players left / time+hole right */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.08in' }}>
          {players.map((ep, i) => (
            <div key={ep?.id ?? i} style={{ fontSize: '0.3in', color: '#111', fontFamily: FONT }}>
              {epName(ep)}
            </div>
          ))}
        </div>
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '0.08in' }}>
          {teeTime && (
            <div style={{ fontSize: '0.3in', color: '#111', fontFamily: FONT }}>{teeTime}</div>
          )}
          {holeLabel && (
            <div style={{ fontSize: '0.3in', color: '#111', fontFamily: FONT }}>{holeLabel}</div>
          )}
        </div>
      </div>
    </div>
  )
}

// Two cart signs, shrunk slightly to stack on a single standard Letter sheet
const SIGN_ORIG_W      = 8.5
const SIGN_ORIG_H      = 5.5
const SIGN_PAGE_MARGIN_X = 0.25  // in
const SIGN_PAGE_MARGIN_Y = 0.15  // in
const SIGN_GAP           = 0.3   // in

function CartSignsPage({ signs }) {
  const availH = 11 - SIGN_PAGE_MARGIN_Y * 2 - SIGN_GAP
  const signH  = availH / 2
  const scale  = signH / SIGN_ORIG_H
  const signW  = SIGN_ORIG_W * scale

  return (
    <div style={{
      width: '8.5in', height: '11in',
      boxSizing: 'border-box',
      padding: `${SIGN_PAGE_MARGIN_Y}in ${SIGN_PAGE_MARGIN_X}in`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: `${SIGN_GAP}in`,
      background: '#fff',
      pageBreakAfter: 'always',
    }}>
      {signs.map((s, i) => (
        <div key={i} style={{
          width: `${signW}in`, height: `${signH}in`,
          boxSizing: 'border-box',
          border: '1.5px dashed #999',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${SIGN_ORIG_W}in`, height: `${SIGN_ORIG_H}in`,
            transform: `scale(${scale})`, transformOrigin: 'top left',
          }}>
            <CartSignCard {...s} />
          </div>
        </div>
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main export
// ═══════════════════════════════════════════════════════════════════════════════
const PAGE_SIZE = {
  cards:      '8.5in 11in',
  tee_sheet:  '8.5in 11in',
  cart_signs: '8.5in 11in',
}

// Physical pixel dimensions at 96dpi (1in = 96px) — all types now render full Letter pages
const PREVIEW_DIMS = {
  cart_signs: { w: 8.5 * 96, h: 11 * 96 },
  cards:      { w: 8.5 * 96, h: 11 * 96 },
  tee_sheet:  { w: 8.5 * 96, h: 11 * 96 },
}
const PREVIEW_SCALE = {
  cart_signs: 0.68,
  cards:      0.68,
  tee_sheet:  0.68,
}

const TITLES = {
  cards:      'CTP & Long Drive Cards',
  tee_sheet:  'Tee Sheet',
  cart_signs: 'Cart Signs',
}

export default function PrintAssets({ type, event, eventPlayers = [], tglSelections = [], onClose }) {
  const league     = event?.league ?? {}
  const logoUrl    = league.logo_url ?? null
  const leagueName = league.name ?? ''
  const eventName  = event?.name ?? (event?.event_number ? `Event #${event.event_number}` : '')
  const date       = shortDate(event?.event_date)
  const interval   = event?.tee_time_interval_mins ?? 10

  const pngRef      = useRef(null)
  const reelRef     = useRef(null)   // modal preview
  const captureRef  = useRef(null)   // off-screen capture target
  const [downloadingPng,  setDownloadingPng]  = useState(false)
  const [downloadingReel, setDownloadingReel] = useState(false)
  const [showReel,        setShowReel]        = useState(false)

  const handleDownloadPng = async () => {
    if (!pngRef.current || downloadingPng) return
    setDownloadingPng(true)
    try {
      const dataUrl = await toPng(pngRef.current, { pixelRatio: 2, cacheBust: true, backgroundColor: '#ffffff' })
      downloadPng(dataUrl, `tee-sheet-${event?.event_number ?? 'event'}.png`)
    } finally {
      setDownloadingPng(false)
    }
  }

  const handleDownloadReel = async () => {
    const el = captureRef.current
    if (!el || downloadingReel) return
    setDownloadingReel(true)
    try {
      const dataUrl = await toPng(el, { pixelRatio: 3, cacheBust: true, skipFonts: false })
      const eventName = event?.name ?? `Event_${event?.event_number ?? 'event'}`
      downloadPng(dataUrl, `${eventName.replace(/\s+/g, '_')}_tee-sheet-reel.png`)
    } catch (err) {
      console.error('IG Reel export failed:', err)
    } finally {
      setDownloadingReel(false)
    }
  }

  let printNodes = []
  let itemCount  = 0

  // ── CTP / Long Drive cards ────────────────────────────────────────────────
  if (type === 'cards') {
    const sideGames    = event?.side_game_options ?? []
    const payoutConfig = event?.payout_config ?? {}
    const cardItems    = []

    const hasCtp   = sideGames.includes('ctp')
    const ctpHoles = Object.keys(payoutConfig)
      .filter(k => k.startsWith('ctp_'))
      .map(k => parseInt(k.replace('ctp_', ''), 10))
      .sort((a, b) => a - b)

    if (hasCtp && ctpHoles.length > 0) {
      ctpHoles.forEach(h => {
        cardItems.push({
          logoUrl, leagueName, eventName, date,
          competitionLine: `Closest to Pin #${h}`,
        })
      })
    } else if (hasCtp) {
      cardItems.push({ logoUrl, leagueName, eventName, date, competitionLine: 'Closest to Pin' })
    }

    const hasLongDrive = sideGames.some(s => s.startsWith('long_drive'))
    const ldHole       = event?.long_drive_hole ?? null

    if (hasLongDrive) {
      cardItems.push({
        logoUrl, leagueName, eventName, date,
        competitionLine: ldHole ? `Longest Drive #${ldHole}` : 'Longest Drive',
      })
    }

    // Custom competitions
    const customCompetitions = (event?.custom_competitions ?? []).filter(c => c?.trim())
    customCompetitions.forEach(name => {
      cardItems.push({ logoUrl, leagueName, eventName, date, competitionLine: name })
    })

    itemCount = cardItems.length
    for (let i = 0; i < cardItems.length; i += 2) {
      printNodes.push(<CtpCardsPage key={`page_${i / 2}`} cards={cardItems.slice(i, i + 2)} />)
    }
  }

  // ── Tee Sheet ─────────────────────────────────────────────────────────────
  if (type === 'tee_sheet') {
    printNodes = [<TeeSheetPage key="tee_sheet" event={event} eventPlayers={eventPlayers} tglSelections={tglSelections} />]
    itemCount  = 1
  }

  // ── Cart Signs ────────────────────────────────────────────────────────────
  if (type === 'cart_signs') {
    const groups    = groupedPlayers(eventPlayers)
    const groupNums = Object.keys(groups).map(Number).sort((a, b) => a - b)
    const isShotgun = event?.shotgun_start ?? false
    const holeMap   = event?.group_hole_assignments ?? {}
    const signItems = []

    groupNums.forEach(g => {
      const members   = groups[g]
      const teeTime   = isShotgun
        ? calcTeeTime(event?.start_time, 0, 1)
        : calcTeeTime(event?.start_time, interval, g)
      const holeLabel = isShotgun
        ? (holeMap[g] ? `Hole #${holeMap[g]}` : null)
        : 'Hole 1'

      // One sign per cart (2 players each side)
      const card1 = members.slice(0, 2)
      const card2 = members.slice(2, 4)

      signItems.push({
        logoUrl, leagueName, eventName, date,
        groupNum: g, teeTime, holeLabel, players: card1,
      })
      if (card2.length > 0) {
        signItems.push({
          logoUrl, leagueName, eventName, date,
          groupNum: g, teeTime, holeLabel, players: card2,
        })
      }
    })

    itemCount = signItems.length
    for (let i = 0; i < signItems.length; i += 2) {
      printNodes.push(<CartSignsPage key={`page_${i / 2}`} signs={signItems.slice(i, i + 2)} />)
    }
  }

  // ── Print CSS ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const size  = PAGE_SIZE[type] ?? '8.5in 11in'
    const style = document.createElement('style')
    style.id    = 'print-assets-style'
    style.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&display=swap');
      @page { size: ${size}; margin: 0; }
      @media print {
        body > * { display: none !important; }
        #print-assets-root { display: block !important; }
      }
    `
    document.head.appendChild(style)
    return () => document.getElementById('print-assets-style')?.remove()
  }, [type])

  // ── Empty state ───────────────────────────────────────────────────────────
  if (printNodes.length === 0) {
    const hint = type === 'cards'
      ? "Enable CTP, Long Drive, or add custom competitions in the event's Side Games to generate cards."
      : type === 'cart_signs'
      ? 'Assign players to groups in the Groups tab first.'
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

  const pageCount = printNodes.length
  const subtitle  = type === 'tee_sheet'
    ? '1 page · 8.5" × 11"'
    : type === 'cart_signs'
    ? `${itemCount} sign${itemCount !== 1 ? 's' : ''} · ${pageCount} page${pageCount !== 1 ? 's' : ''} · 8.5" × 11"`
    : `${itemCount} card${itemCount !== 1 ? 's' : ''} · ${pageCount} page${pageCount !== 1 ? 's' : ''} · 8.5" × 11"`

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
            {type === 'tee_sheet' ? (
              <>
                <button
                  onClick={handleDownloadPng}
                  disabled={downloadingPng}
                  className="px-4 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium disabled:opacity-50"
                >
                  {downloadingPng ? 'Generating…' : '⬇ Download PNG'}
                </button>
                <button
                  onClick={() => setShowReel(v => !v)}
                  className="px-4 py-1.5 rounded-lg text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium"
                >
                  📱 IG Reel
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-1.5 rounded-lg text-sm text-white font-medium"
                  style={{ background: GREEN }}
                >
                  🖨 Download PDF
                </button>
              </>
            ) : (
              <button
                onClick={() => window.print()}
                className="px-4 py-1.5 rounded-lg text-sm text-white font-medium"
                style={{ background: GREEN }}
              >
                🖨 Print
              </button>
            )}
          </div>
        </div>

        {/* Scrollable preview */}
        <div className="flex-1 overflow-y-auto py-8 flex flex-col items-center gap-8">
          {printNodes.map((node, i) => {
            const dims  = PREVIEW_DIMS[type]
            const scale = PREVIEW_SCALE[type]
            const outerW = dims.w * scale
            const outerH = dims.h * scale
            return (
              <div key={i} style={{ position: 'relative', width: outerW, height: outerH, flexShrink: 0 }}>
                {/* Label */}
                <div style={{
                  position: 'absolute', top: -24, left: 0,
                  fontSize: 11, color: '#aaa', letterSpacing: '0.05em', textTransform: 'uppercase',
                }}>
                  {type === 'tee_sheet' ? 'Tee Sheet' : `Page ${i + 1} of ${printNodes.length}`}
                </div>
                {/* Scaled card */}
                <div style={{
                  transformOrigin: 'top left',
                  transform: `scale(${scale})`,
                  width: dims.w,
                  height: dims.h,
                  boxShadow: '0 6px 32px rgba(0,0,0,0.55)',
                  borderRadius: 4,
                  overflow: 'hidden',
                }}>
                  {node}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Print portal */}
      {createPortal(
        <div id="print-assets-root" style={{ display: 'none' }}>
          {printNodes}
        </div>,
        document.body
      )}

      {/* Off-screen render for Tee Sheet PNG capture — sized to actual content, not a forced full page */}
      {type === 'tee_sheet' && createPortal(
        <div style={{ position: 'fixed', top: '-99999px', left: '-99999px', pointerEvents: 'none', zIndex: -1 }}>
          <div ref={pngRef}>
            <TeeSheetPage forPng event={event} eventPlayers={eventPlayers} tglSelections={tglSelections} />
          </div>
        </div>,
        document.body
      )}

      {/* Off-screen capture target — positioned just off right edge so toPng renders fully */}
      {type === 'tee_sheet' && createPortal(
        <div style={{ position: 'fixed', top: 0, left: '100vw', pointerEvents: 'none', zIndex: -1 }}>
          <TeeSheetReelCard ref={captureRef} event={event} eventPlayers={eventPlayers} tglSelections={tglSelections} />
        </div>,
        document.body
      )}

      {/* IG Reel panel */}
      {type === 'tee_sheet' && showReel && (
        <IGReelPanel
          event={event}
          eventPlayers={eventPlayers}
          tglSelections={tglSelections}
          reelRef={reelRef}
          downloading={downloadingReel}
          onDownload={handleDownloadReel}
          onClose={() => setShowReel(false)}
        />
      )}

    </>
  )
}

// ─── IG Reel Card (1080×1920 tee sheet) ──────────────────────────────────────
const TeeSheetReelCard = forwardRef(function TeeSheetReelCard({ event, eventPlayers, tglSelections = [] }, ref) {
  const league     = event?.league ?? {}
  const logoUrl    = league.logo_url ?? null
  const leagueName = league.name ?? ''
  const eventName  = event?.name ?? (event?.event_number ? `Event #${event.event_number}` : '')
  const courseName = event?.course?.name ?? ''
  const date       = formatEventDate(event?.event_date)
  const interval   = event?.tee_time_interval_mins ?? 10
  const isShotgun  = event?.shotgun_start ?? false
  const holeMap    = event?.group_hole_assignments ?? {}

  const hasFlights = eventPlayers.some(ep => ep.flight === 'A' || ep.flight === 'B')
  const tglSet     = tglSelections.length > 0 ? new Set(tglSelections.map(s => s.player_id)) : null
  const hasTgl     = tglSet && tglSet.size > 0

  const groups    = groupedPlayers(eventPlayers)
  const groupNums = Object.keys(groups).map(Number).sort((a, b) => a - b)

  // Card is 360×640 at 1× — exported at 3× = 1080×1920
  return (
    <div ref={ref} style={{
      width: 360,
      background: 'linear-gradient(160deg, #1B4332 0%, #0f2e22 55%, #0a1f17 100%)',
      borderRadius: 20,
      display: 'flex',
      flexDirection: 'column',
      padding: '28px 22px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxSizing: 'border-box',
      position: 'relative',
    }}>
      {/* Gold top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #D4AF37, #f0d060, #D4AF37)' }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover' }} crossOrigin="anonymous" />
        ) : (
          <div style={{ width: 40, height: 40, borderRadius: 8, background: '#D4AF37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 13, color: '#1B4332' }}>
            {(leagueName ?? 'S').slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <div style={{ color: '#D4AF37', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{leagueName}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, marginTop: 1 }}>scorifygolf.com</div>
        </div>
      </div>

      {/* Event info */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ color: '#fff', fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{eventName}</div>
        <div style={{ color: '#D4AF37', fontSize: 11, fontWeight: 600, marginTop: 4 }}>{courseName}</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 }}>Tee Sheet · {new Date(event?.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 10 }} />

      {/* Rows — each group is a block: header row + 2-column player grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {groupNums.map((g, i) => {
          const members = groups[g]
          const teeTime = isShotgun
            ? calcTeeTime(event?.start_time, 0, 1)
            : calcTeeTime(event?.start_time, interval, g)
          const hole = isShotgun ? (holeMap[g] ? `Hole #${holeMap[g]}` : '—') : 'Hole 1'
          // Split players into 2 columns
          const col1 = members.filter((_, idx) => idx % 2 === 0)
          const col2 = members.filter((_, idx) => idx % 2 === 1)
          return (
            <div key={g} style={{
              borderRadius: 8,
              background: i % 2 === 0 ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
              padding: '6px 8px',
            }}>
              {/* Group header: time · group# · hole */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: '#D4AF37' }}>{teeTime ?? '—'}</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.4)' }}>Group #{g}</span>
                <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', marginLeft: 'auto' }}>{hole}</span>
              </div>
              {/* 2-column player names */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px' }}>
                {col1.map((ep, idx) => (
                  <div key={ep.player_id ?? idx} style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {epName(ep, { showFlight: hasFlights, tglSet })}
                  </div>
                ))}
                {col2.map((ep, idx) => (
                  <div key={ep.player_id ?? idx} style={{ fontSize: 10, color: 'rgba(255,255,255,0.9)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', gridRow: idx + 1, gridColumn: 2 }}>
                    {epName(ep, { showFlight: hasFlights, tglSet })}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {hasTgl ? '* Team Play participant · ' : ''}Powered by Scorify Golf
        </div>
        <img src="/logo.png" alt="Scorify Golf" style={{ height: 22, objectFit: 'contain', opacity: 0.5 }} />
      </div>
    </div>
  )
})

// ─── IG Reel preview overlay ──────────────────────────────────────────────────
function IGReelPanel({ event, eventPlayers, tglSelections, reelRef, downloading, onDownload, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.8)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <div onClick={e => e.stopPropagation()}>
        <TeeSheetReelCard ref={reelRef} event={event} eventPlayers={eventPlayers} tglSelections={tglSelections} />
      </div>
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', gap: 10 }}>
        <button
          onClick={onDownload}
          disabled={downloading}
          style={{ background: GREEN, color: '#fff', fontWeight: 700, fontSize: 14, padding: '11px 24px', borderRadius: 12, border: 'none', cursor: downloading ? 'not-allowed' : 'pointer', opacity: downloading ? 0.7 : 1 }}
        >
          {downloading ? 'Exporting…' : '⬇ Download PNG (1080×1920)'}
        </button>
        <button
          onClick={onClose}
          style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 600, fontSize: 14, padding: '11px 18px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer' }}
        >
          Close
        </button>
      </div>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textAlign: 'center' }}>
        Preview shows up to 12 groups. Full tee sheet prints all groups.
      </p>
    </div>
  )
}
