/**
 * ScorecardExport — Landscape 11"×8.5" PNG, two cards stacked per page.
 *
 * All data columns (holes + OUT/INIT/IN/TOT/HCP/NET/PUTTS) are equal width.
 * Rows: Hole · Tee×N (yardage) · Par · S.I. · Player×4
 */

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
import { getStrokesOnHole, computeLeaderboards, getStrokeIndexForTee } from '../lib/engines/scoring'
import { computeSkinsForFlight, computeAllSkins } from '../lib/engines/skins'
import { computePayouts } from '../lib/engines/payouts'
import { computeTGLEventResults, assignTGLPoints } from '../lib/engines/tgl'

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

// ─── Layout constants ─────────────────────────────────────────────
const PAGE_W    = 1100
const PAGE_H    = 850
const PAD       = 18
const GAP       = 40   // gap between the two stacked cards, houses the cut line
const CARD_W    = PAGE_W - PAD * 2   // 1064
const CARD_H    = Math.floor((PAGE_H - PAD * 2 - GAP) / 2)

// All data columns equal width; label and INIT are narrower
const COL_LABEL = 80   // player name / row label
const COL_HOLE  = 36   // score cells + OUT/IN/TOT/INIT/HCP/NET/PUTTS all match this

const CELL_H    = 24   // row height px

// ─── Colors ───────────────────────────────────────────────────────
const GREEN     = '#1B4332'
const GOLD      = '#C9A84C'
const GRAY_BG   = '#f5f5f3'
const BORDER    = '#c0c0c0'

// ─── Export Button ────────────────────────────────────────────────
export function ExportScorecardsButton({ event, eventPlayers, course, orgName, orgSlug, orgLogoUrl }) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const containerRef = useRef(null)

  const groupNums = [...new Set(
    eventPlayers.map(ep => ep.group_number).filter(Boolean)
  )].sort((a, b) => a - b)

  const groupCodes = event.group_codes ?? {}

  async function handleExport() {
    setExportError(null)
    if (!course) { setExportError('No course loaded — cannot export.'); return }
    if (groupNums.length === 0) { setExportError('No groups assigned.'); return }
    setExporting(true)
    try {
      // Pre-fetch logo once for all groups (4s timeout, skip on failure)
      let logoDataUrl = null
      if (orgLogoUrl) {
        try {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 4000)
          const resp = await fetch(orgLogoUrl, { signal: ctrl.signal })
          clearTimeout(timer)
          const blob = await resp.blob()
          logoDataUrl = await new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result)
            reader.onerror = rej
            reader.readAsDataURL(blob)
          })
        } catch {
          logoDataUrl = null
        }
      }

      for (const g of groupNums) {
        const players = eventPlayers
          .filter(ep => ep.group_number === g)
          .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))

        const code   = groupCodes[g] ?? ''
        const qrUrl  = `${window.location.origin}/${orgSlug}/${event.league?.slug}/${event.slug}/scorecard?eid=${event.id}`
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 140, margin: 1,
          color: { dark: GREEN, light: '#ffffff' },
        })

        const node = containerRef.current
        if (!node) continue
        node.innerHTML = ''

        const ctpHoles     = Object.keys(event.payout_config ?? {})
          .filter(k => k.startsWith('ctp_'))
          .map(k => parseInt(k.replace('ctp_', ''), 10))
          .sort((a, b) => a - b)
        const longDriveHole = event.long_drive_hole ?? null

        // Parse starting hole number from group_hole_assignments (e.g. "4A" or "4B" → 4)
        const holeAssignStr = (event.group_hole_assignments ?? {})[g] ?? null
        const startingHole = holeAssignStr ? parseInt(holeAssignStr, 10) || null : null

        // Build flight→tee map from ALL event players so every flight label
        // shows the correct tee even when a group has no player of that flight
        const globalFlightTeeMap = {}
        eventPlayers.forEach(ep => {
          if (ep.flight && ep.tee) globalFlightTeeMap[ep.flight] = ep.tee
        })

        const pageEl = buildPage({ event, course, groupNum: g, players, code, qrDataUrl, ctpHoles, longDriveHole, orgName, startingHole, holeAssignStr, orgLogoUrl: logoDataUrl, globalFlightTeeMap })
        node.appendChild(pageEl)

        // Wait for images to load
        await Promise.all(
          [...pageEl.querySelectorAll('img')].map(
            img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
          )
        )
        await new Promise(r => setTimeout(r, 80))

        const dataUrl = await toPng(pageEl, {
          pixelRatio: 3,
          cacheBust: true,
          backgroundColor: '#ffffff',
          width: PAGE_W,
          height: PAGE_H,
        })

        const link = document.createElement('a')
        const leaguePart = (event.league?.name ?? 'league').replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const eventPart  = (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()
        downloadPng(dataUrl, `scorecard_${leaguePart}_${eventPart}_group${g}.png`)
        await new Promise(r => setTimeout(r, 250))
      }
    } catch (err) {
      console.error('Scorecard export failed:', err)
      setExportError(err?.message ?? 'Export failed — check console for details.')
    } finally {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setExporting(false)
    }
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={exporting || groupNums.length === 0}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8,
          border: '1px solid #d1d5db',
          background: exporting ? '#f3f4f6' : '#ffffff',
          color: '#374151', fontSize: 13, fontWeight: 600,
          cursor: (exporting || groupNums.length === 0) ? 'not-allowed' : 'pointer',
          opacity: groupNums.length === 0 ? 0.5 : 1,
        }}
      >
        {exporting ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Exporting…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Export Scorecards
          </>
        )}
      </button>
      {exportError && (
        <p style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{exportError}</p>
      )}
      <div
        ref={containerRef}
        style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none', zIndex: -1 }}
      />
    </>
  )
}

// ─── Page: two cards stacked ──────────────────────────────────────
function buildPage({ event, course, groupNum, players, code, qrDataUrl, ctpHoles, longDriveHole, orgName, startingHole, holeAssignStr, orgLogoUrl, globalFlightTeeMap }) {
  const page = el('div', {
    width: PAGE_W + 'px', height: PAGE_H + 'px',
    background: '#ffffff',
    display: 'flex', flexDirection: 'column',
    padding: PAD + 'px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
  })
  const opts = { event, course, groupNum, players, code, qrDataUrl, ctpHoles, longDriveHole, orgName, startingHole, holeAssignStr, orgLogoUrl, globalFlightTeeMap }
  page.appendChild(buildCard(opts))
  page.appendChild(buildCutLine())
  page.appendChild(buildCard(opts))
  return page
}

// ─── Cut line — dashed divider centered in the gap between stacked cards ──
function buildCutLine() {
  const wrap = el('div', {
    height: GAP + 'px', flexShrink: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  })
  const line = el('div', {
    position: 'absolute', left: '0', right: '0', top: '50%',
    borderTop: `1.5px dashed ${BORDER}`,
  })
  wrap.appendChild(line)
  const label = txt('✂ cut here', {
    position: 'relative', background: '#ffffff', padding: '0 10px',
    fontSize: '9px', color: '#9ca3af', letterSpacing: '0.05em',
  })
  wrap.appendChild(label)
  return wrap
}

// ─── Card ─────────────────────────────────────────────────────────
function buildCard({ event, course, groupNum, players, code, qrDataUrl, ctpHoles, longDriveHole, orgName, startingHole, holeAssignStr, orgLogoUrl, globalFlightTeeMap = {} }) {
  const parPerHole  = course.par_per_hole  ?? []
  const strokeIndex = course.stroke_index  ?? []
  const courseTees  = course.tees          ?? []

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : ''

  // Unique tees used by players in this group (preserving course order)
  const playerTeeNames = [...new Set(players.map(p => p.tee).filter(Boolean))]
  const groupTees  = courseTees.filter(t => playerTeeNames.includes(t.name))
  const teesToShow = groupTees.length > 0 ? groupTees : courseTees

  // Per-flight tee labels — built from this group's players, falling back to
  // the event-wide globalFlightTeeMap so every flight shows the correct tee
  // even when a group contains players of only one flight.
  const groupFlightSet = new Set(players.map(p => p.flight).filter(Boolean))
  const allFlights = new Set([...groupFlightSet, ...Object.keys(globalFlightTeeMap)])
  const flightTeeLines = [...allFlights].sort().map(f => {
    const t = players.find(p => p.flight === f && p.tee)?.tee ?? globalFlightTeeMap[f] ?? null
    return t ? `Flight ${f} - ${t} Tees` : `Flight ${f}`
  })
  // If no flights at all, fall back to tee names only
  if (flightTeeLines.length === 0 && playerTeeNames.length > 0) {
    flightTeeLines.push(...playerTeeNames.map(t => `${t} Tees`))
  }

  const card = el('div', {
    width: CARD_W + 'px',
    height: CARD_H + 'px',
    border: '2px solid ' + GREEN,
    borderRadius: '6px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    flexShrink: '0',
  })

  // ── Header ──────────────────────────────────────────────────────
  const header = el('div', {
    background: GREEN,
    padding: '5px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: '0',
  })

  // Left: club / event text (course name appears once, on the date line)
  const hLeft = el('div', { flex: '1' })
  hLeft.appendChild(txt(orgName ?? 'Scorify Golf', {
    display: 'block', color: GOLD,
    fontSize: '13px', fontWeight: '700', letterSpacing: '0.02em',
  }))
  hLeft.appendChild(txt(`Event #${event.event_number}`, {
    display: 'block', color: '#ffffff', fontSize: '10px', marginTop: '1px',
  }))
  hLeft.appendChild(txt(`${course.name ?? ''} · ${eventDate}`, {
    display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '9px', marginTop: '1px',
  }))
  header.appendChild(hLeft)

  // Right: flight/tee lines + group badge, all inline (row)
  const hRight = el('div', {
    display: 'flex', alignItems: 'center', gap: '10px',
  })

  // Flight/tee lines stacked to the left of group badge
  if (flightTeeLines.length > 0) {
    const ftBlock = el('div', { textAlign: 'right' })
    flightTeeLines.forEach(line => {
      ftBlock.appendChild(txt(line, {
        display: 'block', color: 'rgba(255,255,255,0.85)',
        fontSize: '9px', fontWeight: '600', whiteSpace: 'nowrap',
        lineHeight: '1.5',
      }))
    })
    hRight.appendChild(ftBlock)
  }

  const teeTime = computeTeeTime(event.start_time, event.shotgun_start ? 0 : (event.tee_time_interval_mins ?? 10), groupNum)

  const groupBadge = el('div', {
    background: GOLD, color: '#1a1a1a',
    fontWeight: '800', borderRadius: '5px', padding: '3px 10px',
    whiteSpace: 'nowrap', flexShrink: '0', textAlign: 'center',
  })
  const groupLine = txt(`Group ${groupNum}`, { display: 'block', fontSize: '16px', fontWeight: '800' })
  groupBadge.appendChild(groupLine)
  if (teeTime) {
    groupBadge.appendChild(txt(teeTime, {
      display: 'block', fontSize: '11px', fontWeight: '700',
      color: '#3a2a00', marginTop: '1px',
    }))
  }
  hRight.appendChild(groupBadge)
  header.appendChild(hRight)
  card.appendChild(header)

  // ── Score table ──────────────────────────────────────────────────
  card.appendChild(buildTable({ course, parPerHole, strokeIndex, teesToShow, players, longDriveHole, startingHole }))

  // ── Footer ───────────────────────────────────────────────────────
  const footer = el('div', {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '5px 10px',
    background: GRAY_BG,
    borderTop: '2px solid ' + GREEN,
    flexShrink: '0',
  })
  if (qrDataUrl) {
    const img = document.createElement('img')
    img.src = qrDataUrl
    img.style.cssText = 'width: 58px; height: 58px; flexShrink: 0;'
    footer.appendChild(img)
  }
  const ftxt = el('div')
  ftxt.appendChild(txt('Scan to enter scores', {
    display: 'block', fontSize: '9px', color: '#6b7280', marginBottom: '2px',
  }))
  if (code) {
    const codeRow = el('div', { display: 'flex', alignItems: 'center', gap: '5px' })
    codeRow.appendChild(txt('Access Code:', { fontSize: '10px', color: '#374151' }))
    codeRow.appendChild(txt(code, {
      fontSize: '18px', fontWeight: '800', color: GREEN,
      letterSpacing: '0.14em', fontFamily: 'monospace',
    }))
    ftxt.appendChild(codeRow)
  }
  footer.appendChild(ftxt)

  // ── Competitions panel (Starting Hole + CTP + Long Drive) ────────
  const hasCtp = ctpHoles && ctpHoles.length > 0
  const hasLd  = !!longDriveHole
  const hasStart = !!startingHole
  if (hasStart || hasCtp || hasLd) {
    const panel = el('div', {
      display: 'flex', gap: '10px', alignItems: 'stretch',
    })

    if (hasStart) {
      const startBox = el('div', {
        background: '#e8f0e8',
        border: '1px solid #9dbf9d',
        borderRadius: '8px',
        padding: '6px 10px',
        minWidth: '80px',
        textAlign: 'center',
      })
      startBox.appendChild(txt('Starting Hole', {
        display: 'block', fontSize: '8px', fontWeight: '700',
        color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: '4px', textAlign: 'center',
      }))
      startBox.appendChild(txt(holeAssignStr ? `#${holeAssignStr}` : `#${startingHole}`, {
        display: 'block', fontSize: '13px', fontWeight: '800',
        color: '#1a1a1a', letterSpacing: '0.03em', textAlign: 'center',
      }))
      panel.appendChild(startBox)
    }

    if (hasCtp) {
      const ctpBox = el('div', {
        background: '#f0f7f0',
        border: '1px solid #b6d8b6',
        borderRadius: '8px',
        padding: '6px 10px',
        minWidth: '100px',
        textAlign: 'center',
      })
      ctpBox.appendChild(txt('Closest to the Pin', {
        display: 'block', fontSize: '8px', fontWeight: '700',
        color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: '4px', textAlign: 'center',
      }))
      const holeNums = ctpHoles.map(h => `#${h}`).join('  ·  ')
      ctpBox.appendChild(txt(holeNums, {
        display: 'block', fontSize: '13px', fontWeight: '800',
        color: '#1a1a1a', letterSpacing: '0.03em', textAlign: 'center',
      }))
      panel.appendChild(ctpBox)
    }

    if (hasLd) {
      const ldBox = el('div', {
        background: '#fffbe6',
        border: '1px solid #f0d060',
        borderRadius: '8px',
        padding: '6px 10px',
        minWidth: '80px',
        textAlign: 'center',
      })
      ldBox.appendChild(txt('Long Drive', {
        display: 'block', fontSize: '8px', fontWeight: '700',
        color: '#7a5a00', textTransform: 'uppercase', letterSpacing: '0.05em',
        marginBottom: '4px', textAlign: 'center',
      }))
      ldBox.appendChild(txt(`#${longDriveHole}`, {
        display: 'block', fontSize: '13px', fontWeight: '800',
        color: '#1a1a1a', letterSpacing: '0.03em', textAlign: 'center',
      }))
      panel.appendChild(ldBox)
    }

    footer.appendChild(panel)
  }

  // ── Org logo (bottom-right) ───────────────────────────────────────
  if (orgLogoUrl) {
    const logoWrap = el('div', { marginLeft: 'auto', flexShrink: '0' })
    const logoImg = document.createElement('img')
    logoImg.src = orgLogoUrl
    logoImg.style.cssText = 'width: 64px; height: 64px; border-radius: 50%; object-fit: cover; border: 2px solid ' + GREEN + ';'
    logoWrap.appendChild(logoImg)
    footer.appendChild(logoWrap)
  }

  card.appendChild(footer)

  return card
}

// ─── Score table ─────────────────────────────────────────────────
function buildTable({ course, parPerHole, strokeIndex, teesToShow, players, longDriveHole, startingHole }) {
  const tbl = document.createElement('table')
  tbl.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
    font-family: Arial, Helvetica, sans-serif;
    flex: 1;
  `

  // Colgroup — label + 18 holes + 7 equal-width special cols (OUT/INIT/IN/TOT/HCP/NET/PUTTS)
  const cg = document.createElement('colgroup')
  const colDefs = [
    COL_LABEL,
    ...Array(9).fill(COL_HOLE),   // H1-9
    COL_HOLE,                      // OUT
    COL_HOLE,                      // INIT
    ...Array(9).fill(COL_HOLE),   // H10-18
    COL_HOLE, COL_HOLE,            // IN, TOT
    COL_HOLE, COL_HOLE, COL_HOLE, // HCP, NET, PUTTS
  ]
  colDefs.forEach(w => {
    const c = document.createElement('col')
    c.style.width = w + 'px'
    cg.appendChild(c)
  })
  tbl.appendChild(cg)

  // ── Cell factories ───────────────────────────────────────────────
  function mkTd(content, opts = {}) {
    const {
      bg = '#ffffff', color = '#111827', bold = false,
      align = 'center', fontSize = '10px', border = true,
    } = opts
    const td = document.createElement('td')
    td.style.cssText = `
      height: ${CELL_H}px;
      text-align: ${align};
      vertical-align: middle;
      background: ${bg};
      color: ${color};
      font-weight: ${bold ? '700' : '400'};
      font-size: ${fontSize};
      border: ${border ? `1px solid ${BORDER}` : 'none'};
      padding: 0 2px;
      white-space: nowrap;
      overflow: hidden;
      box-sizing: border-box;
    `
    td.textContent = String(content ?? '')
    return td
  }

  // Score cell with optional stroke dots in upper-right
  function mkScoreCell(strokes, opts = {}) {
    const td = mkTd('', { bg: 'transparent', ...opts })
    td.style.position = 'relative'
    if (strokes > 0) {
      const dotWrap = document.createElement('span')
      dotWrap.style.cssText = `
        position: absolute; top: 2px; right: 2px;
        display: flex; gap: 1px; align-items: center;
      `
      for (let i = 0; i < Math.min(strokes, 2); i++) {
        const dot = document.createElement('span')
        dot.style.cssText = `
          display: inline-block; width: 4px; height: 4px;
          border-radius: 50%; background: #1a6b2f;
        `
        dotWrap.appendChild(dot)
      }
      td.appendChild(dotWrap)
    }
    return td
  }

  function mkLabel(content, opts = {}) {
    const td = mkTd(content, { bg: GRAY_BG, color: '#374151', bold: true, align: 'left', fontSize: '9px', ...opts })
    td.style.paddingLeft = '5px'
    return td
  }

  // INIT cell — same solid border as all others, light green tint
  function mkInitCell(content, opts = {}) {
    return mkTd(content, {
      bg: '#e8f0e8', color: GREEN, bold: true, fontSize: '9px',
      ...opts,
    })
  }

  // ── Helper: build a full row ─────────────────────────────────────
  function addRow(rowDef) {
    const {
      label, labelBg = GRAY_BG, labelColor = '#374151', labelFontSize = '9px',
      h1to9,           // array[9] of values
      out,             // OUT cell value
      initCell,        // INIT cell value/options
      h10to18,         // array[9]
      inVal, tot,
      hcp, net, putts,
      // style overrides
      holeBg = '#ffffff', holeColor = '#111827', holeBold = false,
      summBg = '#e8e8e4', summColor = '#1a1a1a',
      skipLdHighlight = false,
    } = rowDef

    const LD_BG    = '#fffbe6'  // light yellow for long drive hole
    const START_BG = '#e8f0e8'  // light green for starting hole (same as INIT)

    const tr = document.createElement('tr')
    tr.appendChild(mkLabel(label, { bg: labelBg, color: labelColor, fontSize: labelFontSize }))

    // H1-9
    ;(h1to9 ?? Array(9).fill('')).forEach((v, i) => {
      const hNum  = i + 1
      const isLd  = !skipLdHighlight && longDriveHole === hNum
      const isSt  = !skipLdHighlight && startingHole === hNum
      const bg = isLd
        ? (holeBg === 'transparent' ? 'rgba(255,235,59,0.18)' : LD_BG)
        : isSt
          ? (holeBg === 'transparent' ? 'rgba(27,67,50,0.10)' : START_BG)
          : holeBg
      tr.appendChild(mkTd(v, { bg, color: holeColor, bold: holeBold }))
    })
    // OUT
    tr.appendChild(mkTd(out ?? '', { bg: summBg, color: summColor, bold: true }))
    // INIT
    tr.appendChild(typeof initCell === 'object' && initCell !== null
      ? (() => { const c = mkInitCell(initCell.val ?? ''); return c })()
      : mkInitCell(initCell ?? '')
    )
    // H10-18
    ;(h10to18 ?? Array(9).fill('')).forEach((v, i) => {
      const hNum  = i + 10
      const isLd  = !skipLdHighlight && longDriveHole === hNum
      const isSt  = !skipLdHighlight && startingHole === hNum
      const bg = isLd
        ? (holeBg === 'transparent' ? 'rgba(255,235,59,0.18)' : LD_BG)
        : isSt
          ? (holeBg === 'transparent' ? 'rgba(27,67,50,0.10)' : START_BG)
          : holeBg
      tr.appendChild(mkTd(v, { bg, color: holeColor, bold: holeBold }))
    })
    // IN / TOT
    tr.appendChild(mkTd(inVal ?? '', { bg: summBg, color: summColor, bold: true }))
    tr.appendChild(mkTd(tot   ?? '', { bg: summBg, color: summColor, bold: true }))
    // HCP / NET / PUTTS
    tr.appendChild(mkTd(hcp   ?? '', { bg: '#deeede', color: GREEN,     bold: !!hcp }))
    tr.appendChild(mkTd(net   ?? '', { bg: '#f0f8f0', color: '#111827' }))
    tr.appendChild(mkTd(putts ?? '', { bg: '#f0f8f0', color: '#111827' }))

    tbl.appendChild(tr)
    return tr
  }

  // ── Row: Hole numbers ────────────────────────────────────────────
  const holeNums = Array.from({ length: 9 }, (_, i) => i + 1)
  addRow({
    label: 'HOLE', labelBg: GREEN, labelColor: '#ffffff',
    h1to9: holeNums, out: 'OUT', initCell: 'INIT',
    h10to18: Array.from({ length: 9 }, (_, i) => i + 10), inVal: 'IN', tot: 'TOT',
    hcp: 'HCP', net: 'NET', putts: 'PUTTS',
    holeBg: GREEN, holeColor: '#ffffff', holeBold: true,
    summBg: GOLD, summColor: '#1a1a1a',
    skipLdHighlight: true,
  })

  // ── Tee rows (yardage per hole) ──────────────────────────────────
  teesToShow.forEach(tee => {
    const yds   = tee.yardage ?? []
    const front = yds.slice(0, 9).reduce((a, b) => a + (b || 0), 0)
    const back  = yds.slice(9, 18).reduce((a, b) => a + (b || 0), 0)
    const ratingSlope = (tee.rating && tee.slope) ? ` (${tee.rating}/${tee.slope})` : ''
    const teeBg = tee.color
      ? hexWithAlpha(tee.color, 0.12)
      : '#f0f4ee'

    addRow({
      label: `${tee.name} Tees${ratingSlope}`,
      labelBg: teeBg, labelColor: '#1a1a1a', labelFontSize: '7px',
      h1to9:   yds.slice(0, 9).map(v => v || ''),
      out:     front || '',
      initCell: '',
      h10to18: yds.slice(9, 18).map(v => v || ''),
      inVal:  back || '',
      tot:    (front + back) || '',
      holeBg: teeBg, holeColor: '#1a1a1a',
      summBg: '#dde8dd', summColor: '#1a1a1a',
    })
  })

  // ── Row: Par ─────────────────────────────────────────────────────
  const fPar = parPerHole.slice(0, 9).reduce((a, b) => a + b, 0)
  const bPar = parPerHole.slice(9).reduce((a, b) => a + b, 0)
  addRow({
    label: 'PAR', labelBg: GRAY_BG, labelColor: '#374151',
    h1to9:   parPerHole.slice(0, 9),
    out:     fPar,
    initCell: '',
    h10to18: parPerHole.slice(9, 18),
    inVal:  bPar, tot: fPar + bPar,
    holeBg: GRAY_BG, holeColor: '#374151', holeBold: true,
    summBg: '#e0e0dc',
  })

  // ── Row: Stroke Index ────────────────────────────────────────────
  addRow({
    label: 'S.I.', labelBg: '#efefed', labelColor: '#6b7280',
    h1to9:   strokeIndex.slice(0, 9),
    out:     '',
    initCell: '',
    h10to18: strokeIndex.slice(9, 18),
    inVal: '', tot: '', hcp: '', net: '', putts: '',
    holeBg: '#efefed', holeColor: '#6b7280',
    summBg: '#efefed', summColor: '#9ca3af',
  })

  // ── Player rows ──────────────────────────────────────────────────
  const slots = [...players]
  while (slots.length < 4) slots.push(null)

  slots.slice(0, 4).forEach((ep, i) => {
    const firstName = ep?.player?.first_name ?? ''
    const lastName  = ep?.player?.last_name  ?? ''
    const flight    = ep?.flight ?? null
    const ch        = ep?.course_handicap ?? null
    const playerSis = ep ? getStrokeIndexForTee(course, ep.tee) : strokeIndex

    let nameLabel
    if (ep) {
      const abbr = firstName ? `${firstName[0]}. ${lastName}` : lastName
      nameLabel  = flight ? `${abbr} (${flight})` : abbr
    } else {
      nameLabel = `Player ${i + 1}`
    }

    const initials = ep
      ? `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
      : ''

    const tr = document.createElement('tr')
    tr.appendChild(mkLabel(nameLabel, {
      bg: 'transparent', color: ep ? '#111827' : '#b0b0b0', bold: false,
    }))

    // H1-9 with stroke dots (+ long drive / starting hole highlight)
    for (let h = 1; h <= 9; h++) {
      const strokes = (ep && ch !== null) ? getStrokesOnHole(ch, playerSis[h - 1]) : 0
      const bg = longDriveHole === h
        ? 'rgba(255,235,59,0.18)'
        : startingHole === h
          ? 'rgba(27,67,50,0.10)'
          : 'transparent'
      tr.appendChild(mkScoreCell(strokes, { bg }))
    }
    // OUT
    tr.appendChild(mkTd('', { bg: 'transparent', color: '#374151', bold: true }))
    // INIT
    tr.appendChild(mkInitCell(initials))
    // H10-18 with stroke dots (+ long drive / starting hole highlight)
    for (let h = 10; h <= 18; h++) {
      const strokes = (ep && ch !== null) ? getStrokesOnHole(ch, playerSis[h - 1]) : 0
      const bg = longDriveHole === h
        ? 'rgba(255,235,59,0.18)'
        : startingHole === h
          ? 'rgba(27,67,50,0.10)'
          : 'transparent'
      tr.appendChild(mkScoreCell(strokes, { bg }))
    }
    // IN / TOT
    tr.appendChild(mkTd('', { bg: 'transparent', color: '#374151', bold: true }))
    tr.appendChild(mkTd('', { bg: 'transparent', color: '#374151', bold: true }))
    // HCP / NET / PUTTS
    tr.appendChild(mkTd(ch !== null ? ch : '', { bg: '#deeede', color: GREEN, bold: ch !== null }))
    tr.appendChild(mkTd('', { bg: '#f0f8f0', color: '#111827' }))
    tr.appendChild(mkTd('', { bg: '#f0f8f0', color: '#111827' }))

    tbl.appendChild(tr)
  })

  return tbl
}

// ─── Skins Grid Export ────────────────────────────────────────────
export function ExportSkinsGridButton({ event, eventPlayers, allScores, course, orgName, orgLogoUrl }) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const containerRef = useRef(null)

  const hasSkins = (event?.side_game_options ?? []).some(s => s.startsWith('skins'))
  if (!hasSkins) return null

  async function handleExport() {
    setExportError(null)
    if (!course) { setExportError('No course loaded.'); return }
    setExporting(true)
    try {
      let logoDataUrl = null
      if (orgLogoUrl) {
        try {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 4000)
          const resp = await fetch(orgLogoUrl, { signal: ctrl.signal })
          clearTimeout(timer)
          const blob = await resp.blob()
          logoDataUrl = await new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result)
            reader.onerror = rej
            reader.readAsDataURL(blob)
          })
        } catch { logoDataUrl = null }
      }

      const flights = [...new Set(eventPlayers.map(ep => ep.flight).filter(Boolean))].sort()
      if (flights.length === 0) flights.push(null)

      for (const flight of flights) {
        const flightPlayers = flight
          ? eventPlayers.filter(ep => ep.flight === flight)
          : eventPlayers
        flightPlayers.sort((a, b) => (a.course_handicap ?? 99) - (b.course_handicap ?? 99))

        const node = containerRef.current
        if (!node) continue
        node.innerHTML = ''
        const pageEl = buildSkinsGrid({ event, course, flightPlayers, allScores, flight, orgName, orgLogoUrl: logoDataUrl })
        node.appendChild(pageEl)

        await Promise.all(
          [...pageEl.querySelectorAll('img')].map(
            img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
          )
        )
        await new Promise(r => setTimeout(r, 80))

        const dataUrl = await toPng(pageEl, {
          pixelRatio: 2,
          cacheBust: true,
          backgroundColor: '#ffffff',
        })

        const link = document.createElement('a')
        const evPart = (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()
        downloadPng(dataUrl, `skins_grid_${evPart}${flight ? `_flight${flight}` : ''}.png`)
        await new Promise(r => setTimeout(r, 300))
      }
    } catch (err) {
      console.error('Skins grid export failed:', err)
      setExportError(err?.message ?? 'Export failed')
    } finally {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setExporting(false)
    }
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8,
          border: '1px solid #d1d5db',
          background: exporting ? '#f3f4f6' : '#ffffff',
          color: '#374151', fontSize: 13, fontWeight: 600,
          cursor: exporting ? 'not-allowed' : 'pointer',
        }}
      >
        {exporting ? 'Exporting…' : '📊 Scoring Summary'}
      </button>
      {exportError && <p style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{exportError}</p>}
      <div ref={containerRef} style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none', zIndex: -1 }} />
    </>
  )
}

function buildSkinsGrid({ event, course, flightPlayers, allScores, flight, orgName, orgLogoUrl }) {
  const { par_per_hole: pars, stroke_index: sis } = course
  const FONT = 'Arial, Helvetica, sans-serif'
  const ROW_H = 28

  // ── Sequential holes: H1–H9 front, H10–H18 back ─────────────────
  const frontGroup = Array.from({ length: 9 }, (_, i) => ({ hole: i + 1,  si: sis[i],      par: pars[i] }))
  const backGroup  = Array.from({ length: 9 }, (_, i) => ({ hole: i + 10, si: sis[i + 9],  par: pars[i + 9] }))

  // ── Skins engine — identical to leaderboard ──────────────────────
  const skinsResult = computeSkinsForFlight(flightPlayers, allScores, course, flight)
  const { holes: skinsHoles, playerSkins } = skinsResult
  const skinWinnerByHole = {}
  skinsHoles.forEach(r => { skinWinnerByHole[r.hole] = r.winner ?? null })

  // ── Payout ───────────────────────────────────────────────────────
  const payoutConfig   = event.payout_config ?? {}
  const skinsKey       = flight ? `skins_${flight.toLowerCase()}` : 'skins'
  const perPlayerEntry = payoutConfig[skinsKey] ?? 0
  const skinsPot       = perPlayerEntry * flightPlayers.length
  const totalSkins     = Object.values(playerSkins).reduce((a, b) => a + b, 0)
  const perSkinValue   = totalSkins > 0 ? skinsPot / totalSkins : 0

  // ── Per-player data ──────────────────────────────────────────────
  const playerData = flightPlayers.map(ep => {
    const ch = ep.course_handicap ?? 0
    const playerSis = getStrokeIndexForTee(course, ep.tee)
    const grossByHole = {}
    const netByHole   = {}
    let frontGross = 0, frontNet = 0, backGross = 0, backNet = 0
    let totalPutts = 0, hasPutts = false

    for (let h = 1; h <= 18; h++) {
      const s = allScores.find(x => x.player_id === ep.player_id && x.hole_number === h)
      if (s) {
        const gross   = s.gross_score
        const strokes = getStrokesOnHole(ch, playerSis[h - 1])
        const net     = gross - strokes
        grossByHole[h] = gross
        netByHole[h]   = net
        if (h <= 9) { frontGross += gross; frontNet += net }
        else        { backGross  += gross; backNet  += net }
        if (s.putts != null) { totalPutts += s.putts; hasPutts = true }
      }
    }
    const totalGross = frontGross + backGross
    const totalNet   = frontNet + backNet
    const skinsWon   = playerSkins[ep.player_id] ?? 0
    const winAmt     = skinsWon > 0 ? Math.round(skinsWon * perSkinValue * 100) / 100 : 0
    return { ep, grossByHole, netByHole, frontGross, frontNet, backGross, backNet, totalGross, totalNet, totalPutts: hasPutts ? totalPutts : null, skinsWon, winAmt }
  })
  playerData.sort((a, b) => (a.totalGross || 999) - (b.totalGross || 999))

  // ── DOM helpers ──────────────────────────────────────────────────
  function mkTh(text, opts = {}) {
    const th = document.createElement('th')
    th.style.cssText = `
      background:${opts.bg ?? GREEN};color:${opts.color ?? '#fff'};
      font-weight:700;font-size:${opts.fs ?? '10px'};
      text-align:${opts.align ?? 'center'};padding:4px 3px;
      border:1px solid #6a8f7a;white-space:nowrap;
    `
    th.textContent = String(text ?? '')
    if (opts.colspan) th.colSpan = opts.colspan
    if (opts.rowspan) th.rowSpan = opts.rowspan
    return th
  }

  function mkTd(text, opts = {}) {
    const td = document.createElement('td')
    td.style.cssText = `
      background:${opts.bg ?? '#fff'};color:${opts.color ?? '#111'};
      font-weight:${opts.bold ? '700' : '400'};font-size:${opts.fs ?? '11px'};
      text-align:${opts.align ?? 'center'};padding:2px 4px;
      border:1px solid #d4d4d0;height:${ROW_H}px;vertical-align:middle;white-space:nowrap;overflow:hidden;
    `
    td.textContent = String(text ?? '')
    if (opts.colspan) td.colSpan = opts.colspan
    return td
  }

  // ── Page wrapper (full width) ─────────────────────────────────────
  const wrap = el('div', {
    width: '1400px', background: '#ffffff',
    fontFamily: FONT, padding: '16px', boxSizing: 'border-box',
  })

  // ── Header bar ───────────────────────────────────────────────────
  const header = el('div', {
    background: GREEN, borderRadius: '8px', padding: '10px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px',
  })
  const hLeft = el('div', {})
  hLeft.appendChild(txt(orgName ?? 'Scorify Golf', { color: GOLD, fontSize: '16px', fontWeight: '700', display: 'block' }))
  hLeft.appendChild(txt(
    `Event #${event.event_number}${flight ? ` · Flight ${flight}` : ''} · Skins Results`,
    { color: 'rgba(255,255,255,0.85)', fontSize: '12px', display: 'block', marginTop: '3px' }
  ))
  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''
  hLeft.appendChild(txt(`${course.name ?? ''} · ${eventDate}`, { color: 'rgba(255,255,255,0.6)', fontSize: '10px', display: 'block', marginTop: '3px' }))
  header.appendChild(hLeft)
  if (orgLogoUrl) {
    const logoImg = document.createElement('img')
    logoImg.src = orgLogoUrl
    logoImg.style.cssText = `width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid ${GOLD}`
    header.appendChild(logoImg)
  }
  wrap.appendChild(header)

  // ── Table ────────────────────────────────────────────────────────
  // Columns: Name | Skins | Win$ | H1-H9 | Out | Out Net | H10-H18 | In | In Net | Grs | HC | Net | Putts
  // Count: 3 + 9 + 2 + 9 + 2 + 3 + 1 = 29
  const COL_NAME  = 180
  const COL_SKINS = 40
  const COL_WIN   = 56
  const COL_HOLE  = 26
  const COL_SUM   = 40
  const COL_HC    = 36
  const COL_PUTTS = 44

  const TOTAL_COLS = 3 + 9 + 2 + 9 + 2 + 3 + 1  // 29

  const tbl = document.createElement('table')
  tbl.style.cssText = `border-collapse:collapse;font-size:11px;font-family:${FONT};width:100%;table-layout:fixed;`

  const colgroup = document.createElement('colgroup')
  const addCol = (w) => { const c = document.createElement('col'); c.style.width = w + 'px'; colgroup.appendChild(c) }
  addCol(COL_NAME); addCol(COL_SKINS); addCol(COL_WIN)
  for (let i = 0; i < 9; i++) addCol(COL_HOLE)
  addCol(COL_SUM)                   // Out
  addCol(COL_SUM)                   // Out Net
  for (let i = 0; i < 9; i++) addCol(COL_HOLE)
  addCol(COL_SUM)                   // In
  addCol(COL_SUM)                   // In Net
  addCol(COL_SUM)                   // Grs
  addCol(COL_HC)                    // HC
  addCol(COL_SUM)                   // Net
  addCol(COL_PUTTS)                 // Putts
  tbl.appendChild(colgroup)

  // Header row
  const hr = document.createElement('tr')
  hr.appendChild(mkTh('Name',    { align: 'left', fs: '11px' }))
  hr.appendChild(mkTh('Skins'))
  hr.appendChild(mkTh('Win $'))
  frontGroup.forEach(({ hole }) => hr.appendChild(mkTh(hole, { bg: '#2D6A4F' })))
  hr.appendChild(mkTh('Out Net', { bg: '#1a3d2a' }))
  hr.appendChild(mkTh('Out Grs', { bg: '#1a3d2a' }))
  backGroup.forEach(({ hole })  => hr.appendChild(mkTh(hole, { bg: '#2D6A4F' })))
  hr.appendChild(mkTh('In Net',  { bg: '#1a3d2a' }))
  hr.appendChild(mkTh('In Grs',  { bg: '#1a3d2a' }))
  hr.appendChild(mkTh('Grs',      { bg: '#1a3d2a' }))
  hr.appendChild(mkTh('HC',       { bg: '#1a3d2a' }))
  hr.appendChild(mkTh('Net Scr',  { bg: '#1a3d2a' }))
  hr.appendChild(mkTh('Putts',    { bg: '#1a3d2a' }))
  tbl.appendChild(hr)

  // SI sub-row
  const siRow = document.createElement('tr')
  siRow.appendChild(mkTd('Flights by handicap', { bg: '#3a5a4a', color: '#cde', align: 'left', bold: true, fs: '9px' }))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  frontGroup.forEach(({ hole }) => siRow.appendChild(mkTd(sis[hole - 1], { bg: '#3a5a4a', color: '#cde', fs: '9px' })))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  backGroup.forEach(({ hole })  => siRow.appendChild(mkTd(sis[hole - 1], { bg: '#3a5a4a', color: '#cde', fs: '9px' })))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  siRow.appendChild(mkTd('', { bg: '#3a5a4a' }))
  tbl.appendChild(siRow)

  // Par row
  const parRow = document.createElement('tr')
  parRow.appendChild(mkTd('Par', { bg: '#f0f4f2', color: GREEN, align: 'left', bold: true, fs: '9px' }))
  parRow.appendChild(mkTd('', { bg: '#f0f4f2' }))
  parRow.appendChild(mkTd('', { bg: '#f0f4f2' }))
  frontGroup.forEach(({ par }) => parRow.appendChild(mkTd(par, { bg: '#f0f4f2', color: GREEN, fs: '9px' })))
  parRow.appendChild(mkTd(pars.slice(0,9).reduce((a,b)=>a+b,0), { bg: '#f0f4f2', color: GREEN, bold: true, fs: '9px' }))
  parRow.appendChild(mkTd('', { bg: '#f0f4f2' }))
  backGroup.forEach(({ par }) => parRow.appendChild(mkTd(par, { bg: '#f0f4f2', color: GREEN, fs: '9px' })))
  parRow.appendChild(mkTd(pars.slice(9).reduce((a,b)=>a+b,0), { bg: '#f0f4f2', color: GREEN, bold: true, fs: '9px' }))
  parRow.appendChild(mkTd('', { bg: '#f0f4f2' }))
  parRow.appendChild(mkTd(pars.reduce((a,b)=>a+b,0), { bg: '#f0f4f2', color: GREEN, bold: true, fs: '9px' }))
  parRow.appendChild(mkTd('', { bg: '#f0f4f2' }))
  parRow.appendChild(mkTd('', { bg: '#f0f4f2' }))
  parRow.appendChild(mkTd('', { bg: '#f0f4f2' }))
  tbl.appendChild(parRow)

  // Carryover row — shows how many skins were carrying into each hole
  const carryoverRow = document.createElement('tr')
  carryoverRow.appendChild(mkTd('Carryover', { bg: '#fef9ec', color: '#92400e', align: 'left', bold: true, fs: '9px' }))
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  const carryoverByHole = {}
  skinsHoles.forEach(r => { carryoverByHole[r.hole] = r.carryoverIn ?? 0 })
  frontGroup.forEach(({ hole }) => {
    const c = carryoverByHole[hole] ?? 0
    carryoverRow.appendChild(mkTd(c > 0 ? `+${c}` : '', { bg: c > 0 ? '#fef3c7' : '#fef9ec', color: '#92400e', bold: c > 0, fs: '9px' }))
  })
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  backGroup.forEach(({ hole }) => {
    const c = carryoverByHole[hole] ?? 0
    carryoverRow.appendChild(mkTd(c > 0 ? `+${c}` : '', { bg: c > 0 ? '#fef3c7' : '#fef9ec', color: '#92400e', bold: c > 0, fs: '9px' }))
  })
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  carryoverRow.appendChild(mkTd('', { bg: '#fef9ec' }))
  tbl.appendChild(carryoverRow)

  // Flight section header
  if (flight) {
    const flightRow = document.createElement('tr')
    const flightTd  = mkTd(`Flight ${flight}`, { bg: '#eaf1ec', bold: true, align: 'left', fs: '11px', color: GREEN })
    flightTd.colSpan = TOTAL_COLS
    flightRow.appendChild(flightTd)
    tbl.appendChild(flightRow)
  }

  // Sort by Net (totalGross - courseHandicap) ascending
  playerData.sort((a, b) => {
    const netA = (a.totalGross || 999) - (a.ep.course_handicap ?? 0)
    const netB = (b.totalGross || 999) - (b.ep.course_handicap ?? 0)
    return netA - netB
  })

  const SKIN_BG    = '#dceee6'
  const SKIN_COLOR = '#1B4332'

  playerData.forEach((pd, rowIdx) => {
    const { ep, grossByHole, frontGross, frontNet, backGross, backNet, totalGross, totalPutts, skinsWon, winAmt } = pd
    const ch    = ep.course_handicap ?? 0
    const net   = totalGross ? totalGross - ch : ''
    const name  = `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim()
    const rowBg = rowIdx % 2 === 0 ? '#ffffff' : '#f7f7f5'

    const tr = document.createElement('tr')
    tr.appendChild(mkTd(name, { bg: rowBg, align: 'left', bold: true, fs: '11px' }))
    tr.appendChild(mkTd(skinsWon > 0 ? skinsWon : '', { bg: skinsWon > 0 ? SKIN_BG : rowBg, bold: skinsWon > 0, color: skinsWon > 0 ? SKIN_COLOR : '#111' }))
    tr.appendChild(mkTd(skinsWon > 0 ? `$${winAmt.toFixed(0)}` : '', { bg: skinsWon > 0 ? '#eaf4ea' : rowBg, bold: skinsWon > 0, color: skinsWon > 0 ? SKIN_COLOR : '#111' }))

    frontGroup.forEach(({ hole }) => {
      const net  = pd.netByHole[hole]
      const won  = skinWinnerByHole[hole] === ep.player_id
      tr.appendChild(mkTd(net ?? '', { bg: won ? SKIN_BG : rowBg, bold: won, color: won ? SKIN_COLOR : '#111' }))
    })
    tr.appendChild(mkTd(frontNet || '', { bg: '#dceee6', bold: true, color: GREEN }))
    tr.appendChild(mkTd(frontGross || '', { bg: '#e8f0e8', bold: true }))

    backGroup.forEach(({ hole }) => {
      const net  = pd.netByHole[hole]
      const won  = skinWinnerByHole[hole] === ep.player_id
      tr.appendChild(mkTd(net ?? '', { bg: won ? SKIN_BG : rowBg, bold: won, color: won ? SKIN_COLOR : '#111' }))
    })
    tr.appendChild(mkTd(backNet || '', { bg: '#dceee6', bold: true, color: GREEN }))
    tr.appendChild(mkTd(backGross || '', { bg: '#e8f0e8', bold: true }))
    tr.appendChild(mkTd(totalGross || '', { bg: '#e8f0e8', bold: true }))
    tr.appendChild(mkTd(ch || '—', { bg: '#e8f0e8' }))
    tr.appendChild(mkTd(net !== '' ? net : '', { bg: '#dceee6', bold: true, color: GREEN }))
    tr.appendChild(mkTd(totalPutts !== null ? totalPutts : '—', { bg: rowBg }))

    tbl.appendChild(tr)
  })

  wrap.appendChild(tbl)

  // Footer
  const footer = el('div', { marginTop: '10px' })
  footer.appendChild(txt(
    `Hole scores shown are NET (gross minus handicap strokes). Green highlight = skin winner. Carryover row shows skins accumulated into that hole. Unresolved carryover after H18 awarded to first skin winner of the round.`,
    { fontSize: '9px', color: '#888', display: 'block' }
  ))
  footer.appendChild(txt(
    `${orgName} · ${course.name ?? ''} · ${event.event_date ?? ''}`,
    { fontSize: '9px', color: '#aaa', display: 'block', marginTop: '3px' }
  ))
  wrap.appendChild(footer)

  return wrap
}

// ─── Tournament Results Export ────────────────────────────────────
export function ExportResultsButton({ event, eventPlayers, allScores, course, sideGames, orgName, orgLogoUrl }) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const containerRef = useRef(null)

  async function handleExport() {
    setExportError(null)
    if (!course) { setExportError('No course loaded.'); return }
    setExporting(true)
    try {
      let logoDataUrl = null
      if (orgLogoUrl) {
        try {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 4000)
          const resp = await fetch(orgLogoUrl, { signal: ctrl.signal })
          clearTimeout(timer)
          const blob = await resp.blob()
          logoDataUrl = await new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result)
            reader.onerror = rej
            reader.readAsDataURL(blob)
          })
        } catch { logoDataUrl = null }
      }

      const node = containerRef.current
      if (!node) return
      node.innerHTML = ''
      const pageEl = buildResultsCard({ event, eventPlayers, allScores, course, sideGames, orgName, orgLogoUrl: logoDataUrl })
      node.appendChild(pageEl)

      await Promise.all(
        [...pageEl.querySelectorAll('img')].map(
          img => img.complete ? Promise.resolve() : new Promise(r => { img.onload = r; img.onerror = r })
        )
      )
      await new Promise(r => setTimeout(r, 100))

      const dataUrl = await toPng(pageEl, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
      })

      const link = document.createElement('a')
      const evPart = (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()
      downloadPng(dataUrl, `results_${evPart}.png`)
    } catch (err) {
      console.error('Results export failed:', err)
      setExportError(err?.message ?? 'Export failed')
    } finally {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setExporting(false)
    }
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8,
          border: '1px solid #d1d5db',
          background: exporting ? '#f3f4f6' : '#ffffff',
          color: '#374151', fontSize: 13, fontWeight: 600,
          cursor: exporting ? 'not-allowed' : 'pointer',
        }}
      >
        {exporting ? 'Exporting…' : '🏆 Export Results'}
      </button>
      {exportError && <p style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{exportError}</p>}
      <div ref={containerRef} style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none', zIndex: -1 }} />
    </>
  )
}

const RES_W      = 900
const RES_PAD    = 20
const BONE_BG    = '#f5f0e8'
const SEC_RADIUS = '10px'

function buildResultsCard({ event, eventPlayers, allScores, course, sideGames, orgName, orgLogoUrl }) {
  const FONT = 'Arial, Helvetica, sans-serif'
  const nonGuests = eventPlayers.filter(ep => !ep.is_guest)
  const sides = event.side_game_options ?? []
  const flights = [...new Set(nonGuests.map(ep => ep.flight).filter(Boolean))].sort()
  const hasFlights = flights.length > 0

  // Leaderboards
  const leaderboards = computeLeaderboards(nonGuests, allScores, course)

  // Skins
  const skinsResults = computeAllSkins(nonGuests, allScores, course)

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  const playerMap = {}
  eventPlayers.forEach(ep => { playerMap[ep.player_id] = ep })

  function playerName(pid) {
    const ep = playerMap[pid]
    if (!ep) return '—'
    return `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim() || '—'
  }

  // Compute payouts — build per-category per-player amount map
  const flightCounts = {}
  nonGuests.forEach(ep => { if (ep.flight) flightCounts[ep.flight] = (flightCounts[ep.flight] ?? 0) + 1 })
  const { byCategory } = computePayouts(event, nonGuests.length, leaderboards, sideGames, skinsResults, flightCounts)

  // catAmt[categoryKey][playerId] = amount for that specific result
  const catAmt = {}
  byCategory.forEach(cat => {
    if (cat.isSkin) {
      // key is like 'skins_a_pid123' — strip the player suffix to get base key
      const baseKey = cat.key.replace(/_[^_]+$/, '')
      if (!catAmt[baseKey]) catAmt[baseKey] = {}
      catAmt[baseKey][cat.playerId] = cat.amount
    } else if (cat.isTied && cat.playerIds?.length > 1) {
      const split = Math.floor((cat.amount / cat.playerIds.length) * 100) / 100
      if (!catAmt[cat.key]) catAmt[cat.key] = {}
      cat.playerIds.forEach(pid => { catAmt[cat.key][pid] = split })
    } else {
      if (!catAmt[cat.key]) catAmt[cat.key] = {}
      if (cat.playerId) catAmt[cat.key][cat.playerId] = cat.amount
    }
  })

  // Display name + prize for a specific payout category key
  function display(pid, categoryKey) {
    const name = playerName(pid)
    const amt = categoryKey ? catAmt[categoryKey]?.[pid] : undefined
    return amt ? `${name} ($${Number.isInteger(amt) ? amt : amt.toFixed(2)})` : name
  }

  // ── Wrapper ──────────────────────────────────────────────────────
  const wrap = el('div', {
    width: RES_W + 'px',
    background: '#ffffff',
    fontFamily: FONT,
    padding: RES_PAD + 'px',
    boxSizing: 'border-box',
  })

  // ── Header ───────────────────────────────────────────────────────
  const header = el('div', {
    background: GREEN,
    borderRadius: '8px',
    padding: '10px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  })
  const hLeft = el('div', {})
  hLeft.appendChild(txt(orgName ?? 'Scorify Golf', { color: GOLD, fontSize: '16px', fontWeight: '700', display: 'block' }))
  hLeft.appendChild(txt(`Event #${event.event_number} · Tournament Results`, { color: 'rgba(255,255,255,0.85)', fontSize: '12px', display: 'block', marginTop: '3px' }))
  hLeft.appendChild(txt(`${course.name ?? ''} · ${eventDate}`, { color: 'rgba(255,255,255,0.6)', fontSize: '10px', display: 'block', marginTop: '3px' }))
  header.appendChild(hLeft)
  if (orgLogoUrl) {
    const logoImg = document.createElement('img')
    logoImg.src = orgLogoUrl
    logoImg.style.cssText = `width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid ${GOLD}`
    header.appendChild(logoImg)
  }
  wrap.appendChild(header)

  // ── Scoring results — table layout ───────────────────────────────
  const formats = event.formats ?? []
  const formatLabels = {
    net_stroke:        '18-Hole Net',
    net_stroke_front9: 'Front 9 Net',
    net_stroke_back9:  'Back 9 Net',
    stableford:        'Stableford',
  }
  const scoringFormats = formats.filter(f => formatLabels[f])
  const payoutPlaces = event.payout_places ?? {}
  const RANK_LABELS = ['1st Place', '2nd Place', '3rd Place']

  // Shared row style constants — all sections use identical padding/font so rows align
  const ROW_BG_ALT = '#f7faf8'

  if (scoringFormats.length > 0) {
    const sec = buildSection('Scoring Results', GREEN, GOLD)
    const body = sec._body
    const RANK_SUFF = ['1st', '2nd', '3rd']

    if (hasFlights) {
      // Single unified table — one set of columns for all formats
      body.appendChild(buildAllFormatsTable(scoringFormats, formatLabels, leaderboards, flights, payoutPlaces, (pid, rank, fl, fmtPrefix) =>
        display(pid, `${fmtPrefix}_${fl.toLowerCase()}_${RANK_SUFF[rank - 1]}`)
      ))
    } else {
      // Full-field: each format is a sub-section but in a single table
      body.appendChild(buildAllFormatsTableFullField(scoringFormats, formatLabels, leaderboards, payoutPlaces, (pid, rank, fmtPrefix) =>
        display(pid, `${fmtPrefix}_${RANK_SUFF[rank - 1]}`)
      ))
    }

    wrap.appendChild(sec._card)
  }

  // ── Long Drive ───────────────────────────────────────────────────
  const ldSides = sides.filter(s => s === 'long_drive' || s.match(/^long_drive_[a-z]$/))
  if (ldSides.length > 0) {
    const sec = buildSection('Longest Drive', GREEN, GOLD)
    const body = sec._body

    const ldFlights = ldSides.map(k => k.match(/^long_drive_([a-z])$/) ? k.match(/^long_drive_([a-z])$/)[1].toUpperCase() : null)
    const ldWinners = ldSides.map((key, i) => {
      const fl = ldFlights[i]
      const g = sideGames.find(g => g.game_type === 'long_drive' && (fl ? g.flight === fl : !g.flight || g.flight === 'overall'))
      const ldKey = fl ? `long_drive_${fl.toLowerCase()}` : 'long_drive'
      return { fl, name: g?.winner_player_id ? display(g.winner_player_id, ldKey) : '—' }
    })

    if (ldFlights.some(f => f)) {
      body.appendChild(buildSideGameFlightRow(ldWinners))
    } else {
      body.appendChild(buildSingleWinnerRow(ldWinners[0]?.name ?? '—'))
    }

    wrap.appendChild(sec._card)
  }

  // ── Low Putts ────────────────────────────────────────────────────
  const lpSides = sides.filter(s => s === 'low_putts' || s.match(/^low_putts_[a-z]$/))
  if (lpSides.length > 0) {
    const sec = buildSection('Fewest Putts', GREEN, GOLD)
    const body = sec._body

    const lpFlights = lpSides.map(k => k.match(/^low_putts_([a-z])$/) ? k.match(/^low_putts_([a-z])$/)[1].toUpperCase() : null)
    const lpWinners = lpSides.map((key, i) => {
      const fl = lpFlights[i]
      const manual = sideGames.find(g => g.game_type === 'low_putts' && (fl ? g.flight === fl : true))?.winner_player_id
      const lpKey = fl ? `low_putts_${fl.toLowerCase()}` : 'low_putts'
      let name = '—'
      if (manual) { name = display(manual, lpKey) }
      else if (!fl && leaderboards.putts?.length > 0) {
        const top = leaderboards.putts[0]
        name = leaderboards.putts.filter(p => p.rank === top.rank).map(p => display(p.player_id, lpKey)).join(', ')
      }
      return { fl, name }
    })

    if (lpFlights.some(f => f)) {
      body.appendChild(buildSideGameFlightRow(lpWinners))
    } else {
      body.appendChild(buildSingleWinnerRow(lpWinners[0]?.name ?? '—'))
    }

    wrap.appendChild(sec._card)
  }

  // ── CTP ──────────────────────────────────────────────────────────
  const ctpHoles = Object.keys(event.payout_config ?? {})
    .filter(k => k.startsWith('ctp_'))
    .map(k => parseInt(k.replace('ctp_', ''), 10))
    .sort((a, b) => a - b)
  if (sides.includes('ctp') && ctpHoles.length > 0) {
    const sec = buildSection('Closest to Pin (Greenies)', GREEN, GOLD)
    const body = sec._body
    const ctpData = ctpHoles.map(h => {
      const g = sideGames.find(g => g.game_type === 'ctp' && g.hole_number === h)
      return { label: `Hole ${h}`, name: g?.winner_player_id ? display(g.winner_player_id, `ctp_${h}`) : '—' }
    })
    body.appendChild(buildCtpGrid(ctpData))
    wrap.appendChild(sec._card)
  }

  // ── Skins ────────────────────────────────────────────────────────
  const skinsSides = sides.filter(s => s === 'skins' || s.match(/^skins_[a-z]$/))
  if (skinsSides.length > 0) {
    const sec = buildSection('Skins', GREEN, GOLD)
    const body = sec._body

    const skinFlights = skinsSides
      .map(k => k.match(/^skins_([a-z])$/) ? k.match(/^skins_([a-z])$/)[1].toUpperCase() : null)
      .filter(Boolean)

    if (skinFlights.length > 1) {
      body.appendChild(buildMultiFlightSkins(skinFlights, skinsResults, (pid, fl) =>
        display(pid, fl ? `skins_${fl.toLowerCase()}` : 'skins')
      ))
    } else {
      skinsSides.forEach(key => {
        const fl = key.match(/^skins_([a-z])$/) ? key.match(/^skins_([a-z])$/)[1].toUpperCase() : null
        const result = fl ? skinsResults?.[fl] : (skinsResults?.[''] ?? Object.values(skinsResults ?? {})[0])
        if (!result) return
        const { playerSkins } = result
        const skinWinners = Object.entries(playerSkins).filter(([, n]) => n > 0).sort(([, a], [, b]) => b - a)
        if (skinWinners.length === 0) {
          const noSkins = el('div', { padding: '10px 14px', color: '#999', fontSize: '12px' })
          noSkins.textContent = 'No skins won'
          body.appendChild(noSkins)
        } else {
          body.appendChild(buildFullFieldGrid(
            skinWinners.map(([pid, count]) => ({ player_id: pid, _suffix: ` · ${count} skin${count !== 1 ? 's' : ''}` })),
            skinWinners.length, pid => display(pid, key),
            GREEN, ROW_BG_ALT, true
          ))
        }
      })
    }

    wrap.appendChild(sec._card)
  }

  // ── Footer ───────────────────────────────────────────────────────
  const footer = el('div', { marginTop: '12px', textAlign: 'center' })
  footer.appendChild(txt(`${orgName ?? 'Scorify Golf'} · ${course.name ?? ''} · ${eventDate}`, {
    fontSize: '10px', color: '#aaa',
  }))
  wrap.appendChild(footer)

  return wrap
}

function buildSection(title, headerBg, headerColor) {
  const card = el('div', {
    background: '#ffffff',
    borderRadius: SEC_RADIUS,
    overflow: 'hidden',
    marginBottom: '12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
    border: '1px solid #d4e0d4',
  })
  const hdr = el('div', {
    background: headerBg,
    padding: '9px 14px',
    display: 'flex',
    alignItems: 'center',
  })
  hdr.appendChild(txt(title, { color: headerColor, fontSize: '13px', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }))
  card.appendChild(hdr)
  const body = el('div', {})
  card.appendChild(body)
  card._body = body
  card._card = card
  return card
}

// Shared row constants used by all layout helpers
const R_PAD   = '10px 14px'   // all data rows same padding
const R_FS    = '13px'        // player name font size
const R_LABEL = '10px'        // flight / place label font size
const R_ODD   = '#f7faf8'     // alternating row tint
const R_EVEN  = '#ffffff'
const R_DIV   = '1px solid #e4ede4'  // row divider

/** Returns [outNet, inNet, putts] for a leaderboard entry based on scoring format */
function getScoreVals(fmt, entry) {
  if (!entry) return [null, null, null]
  switch (fmt) {
    case 'net_stroke':        return [entry.netF9 ?? null, entry.netB9 ?? null, entry.totalPutts ?? null]
    case 'net_stroke_front9': return [entry.netF9 ?? null, null, null]
    case 'net_stroke_back9':  return [null, entry.netB9 ?? null, null]
    default:                  return [null, null, null]
  }
}

/** Single unified scoring table — all formats share one set of columns so widths stay locked */
function buildAllFormatsTable(scoringFormats, formatLabels, leaderboards, flights, payoutPlaces, displayFn) {
  const RANK_LABELS = ['1st Place', '2nd Place', '3rd Place']
  const leaderKeyMap = { net_stroke: 'full', net_stroke_front9: 'front9', net_stroke_back9: 'back9' }
  const fmtPrefixMap = { net_stroke: '18_net', net_stroke_front9: 'f9', net_stroke_back9: 'b9' }

  const SCORE_LABELS = ['Out', 'In']
  const colsPerFlight = 1 + SCORE_LABELS.length  // player + Out + In
  const totalCols = 1 + flights.length * colsPerFlight

  const tbl = document.createElement('table')
  tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;'

  // Fixed colgroup — fill 100% width: result col + player+scores per flight
  const cg = document.createElement('colgroup')
  const resultPct = 12
  const remaining = 100 - resultPct
  const scoreColPct = flights.length === 1 ? 10 : 8
  const playerPct = Math.floor((remaining / flights.length) - SCORE_LABELS.length * scoreColPct)
  const resultCol = document.createElement('col'); resultCol.style.width = resultPct + '%'; cg.appendChild(resultCol)
  flights.forEach(() => {
    const pc = document.createElement('col'); pc.style.width = playerPct + '%'; cg.appendChild(pc)
    SCORE_LABELS.forEach(() => {
      const sc = document.createElement('col'); sc.style.width = scoreColPct + '%'; cg.appendChild(sc)
    })
  })
  tbl.appendChild(cg)

  // 2-row header — Row 1: Result (rowspan=2) + Flight spans; Row 2: Player | Out | In | Putts per flight
  const thead = document.createElement('thead')
  const HDR_BG = '#e4ede4'
  const HDR_STYLE = `padding:7px 14px;text-align:left;background:${HDR_BG};color:${GREEN};font-size:${R_LABEL};font-weight:800;letter-spacing:0.04em;text-transform:uppercase;`

  const hr1 = document.createElement('tr')
  const thResult = document.createElement('th')
  thResult.rowSpan = 2
  thResult.style.cssText = HDR_STYLE + `border-bottom:${R_DIV};vertical-align:bottom;`
  thResult.textContent = 'Result'
  hr1.appendChild(thResult)
  flights.forEach(fl => {
    const thFl = document.createElement('th')
    thFl.colSpan = colsPerFlight
    thFl.style.cssText = HDR_STYLE + `border-bottom:1px solid #d4e0d4;border-left:2px solid #c8d8c8;`
    thFl.textContent = `Flight ${fl}`
    hr1.appendChild(thFl)
  })
  thead.appendChild(hr1)

  const hr2 = document.createElement('tr')
  flights.forEach(() => {
    ;['Player', ...SCORE_LABELS].forEach((label, i) => {
      const th = document.createElement('th')
      th.style.cssText = `padding:4px 14px;text-align:${i === 0 ? 'left' : 'center'};background:${HDR_BG};color:#6b7280;font-size:9px;font-weight:700;border-bottom:${R_DIV};letter-spacing:0.04em;text-transform:uppercase;${i === 0 ? 'border-left:2px solid #c8d8c8;' : ''}`
      th.textContent = label
      hr2.appendChild(th)
    })
  })
  thead.appendChild(hr2)
  tbl.appendChild(thead)

  const tbody = document.createElement('tbody')

  scoringFormats.forEach((fmt, fmtIdx) => {
    const lb = leaderboards[leaderKeyMap[fmt]] ?? {}
    const places = Math.min(payoutPlaces[fmt] ?? 3, 3)
    const fmtPrefix = fmtPrefixMap[fmt] ?? '18_net'

    // Format label row
    const fmtTr = document.createElement('tr')
    const fmtTd = document.createElement('td')
    fmtTd.colSpan = totalCols
    fmtTd.style.cssText = `padding:7px 14px;background:rgba(27,67,50,0.06);border-top:${fmtIdx > 0 ? '2px solid #d0ddd0' : 'none'};border-bottom:${R_DIV};font-size:11px;font-weight:800;color:${GREEN};text-transform:uppercase;letter-spacing:0.07em;`
    fmtTd.textContent = formatLabels[fmt]
    fmtTr.appendChild(fmtTd)
    tbody.appendChild(fmtTr)

    // Place rows — each tied player gets their own row, no divider within a tie group
    for (let rank = 1; rank <= places; rank++) {
      const rowBg = rank % 2 === 0 ? R_ODD : R_EVEN
      // How many rows needed for this rank (max across all flights)
      const maxTied = Math.max(...flights.map(fl => (lb[fl] ?? []).filter(p => p.rank === rank).length || 1))

      for (let tiedIdx = 0; tiedIdx < maxTied; tiedIdx++) {
        const isLastInGroup = tiedIdx === maxTied - 1
        const borderBottom = isLastInGroup ? R_DIV : 'none'
        const tr = document.createElement('tr')

        // Result label — only on first row of each rank group
        const tdLabel = document.createElement('td')
        tdLabel.style.cssText = `padding:${R_PAD};font-weight:700;font-size:12px;color:#374151;background:${rowBg};border-bottom:${borderBottom};vertical-align:top;`
        tdLabel.textContent = tiedIdx === 0 ? (RANK_LABELS[rank - 1] ?? `${rank}th Place`) : ''
        tr.appendChild(tdLabel)

        flights.forEach(fl => {
          const list = lb[fl] ?? []
          const tied = list.filter(p => p.rank === rank)
          const player = tied[tiedIdx] ?? null
          const entry  = tied[0] ?? null  // scores from 1st tied player (they share the same score)

          const tdPlayer = document.createElement('td')
          tdPlayer.style.cssText = `padding:${R_PAD};font-size:${R_FS};font-weight:700;color:${player ? '#111' : '#ccc'};background:${rowBg};border-bottom:${borderBottom};overflow:hidden;border-left:2px solid #d0ddd0;`
          tdPlayer.textContent = player ? displayFn(player.player_id, rank, fl, fmtPrefix) : (tiedIdx === 0 ? '—' : '')
          tr.appendChild(tdPlayer)

          const scoreVals = getScoreVals(fmt, tiedIdx === 0 ? entry : null).slice(0, 2)
          scoreVals.forEach(val => {
            const tdScore = document.createElement('td')
            tdScore.style.cssText = `padding:${R_PAD};font-size:12px;color:${val !== null ? '#374151' : '#d1d5db'};background:${rowBg};border-bottom:${borderBottom};text-align:center;font-weight:600;`
            tdScore.textContent = val !== null ? String(val) : (tiedIdx === 0 ? '—' : '')
            tr.appendChild(tdScore)
          })
        })
        tbody.appendChild(tr)
      }
    }
  })

  tbl.appendChild(tbody)
  return tbl
}

/** Full-field (no flights): Result | Player | Out | In | Putts */
function buildAllFormatsTableFullField(scoringFormats, formatLabels, leaderboards, payoutPlaces, displayFn) {
  const RANK_LABELS = ['1st Place', '2nd Place', '3rd Place']
  const leaderKeyMap = { net_stroke: 'full', net_stroke_front9: 'front9', net_stroke_back9: 'back9' }
  const fmtPrefixMap = { net_stroke: '18_net', net_stroke_front9: 'f9', net_stroke_back9: 'b9' }

  const tbl = document.createElement('table')
  tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;'

  // 4-column layout: Result | Player | Out | In
  const cg = document.createElement('colgroup')
  ;[18, 52, 15, 15].forEach(pct => {
    const c = document.createElement('col'); c.style.width = pct + '%'; cg.appendChild(c)
  })
  tbl.appendChild(cg)

  // Header row
  const thead = document.createElement('thead')
  const hr = document.createElement('tr')
  ;['Result', 'Player', 'Out', 'In'].forEach((h, i) => {
    const th = document.createElement('th')
    th.style.cssText = `padding:7px 14px;text-align:${i <= 1 ? 'left' : 'center'};background:#e4ede4;color:${GREEN};font-size:${R_LABEL};font-weight:800;border-bottom:${R_DIV};letter-spacing:0.04em;text-transform:uppercase;`
    th.textContent = h
    hr.appendChild(th)
  })
  thead.appendChild(hr)
  tbl.appendChild(thead)

  const tbody = document.createElement('tbody')

  scoringFormats.forEach((fmt, fmtIdx) => {
    const lb = leaderboards[leaderKeyMap[fmt]] ?? {}
    const places = Math.min(payoutPlaces[fmt] ?? 3, 3)
    const fmtPrefix = fmtPrefixMap[fmt] ?? '18_net'
    const list = lb.A ?? lb[Object.keys(lb)[0]] ?? []
    const items = list.filter(p => p.rank <= places)

    // Format label spanning all 5 cols
    const fmtTr = document.createElement('tr')
    const fmtTd = document.createElement('td')
    fmtTd.colSpan = 4
    fmtTd.style.cssText = `padding:7px 14px;background:rgba(27,67,50,0.06);border-top:${fmtIdx > 0 ? '2px solid #d0ddd0' : 'none'};border-bottom:${R_DIV};font-size:11px;font-weight:800;color:${GREEN};text-transform:uppercase;letter-spacing:0.07em;`
    fmtTd.textContent = formatLabels[fmt]
    fmtTr.appendChild(fmtTd)
    tbody.appendChild(fmtTr)

    // Group items by rank so tied players each get their own row
    const rankGroups = {}
    items.forEach(item => { if (!rankGroups[item.rank]) rankGroups[item.rank] = []; rankGroups[item.rank].push(item) })
    const ranks = [...new Set(items.map(i => i.rank))].sort((a, b) => a - b)

    ranks.forEach((rank, rankIdx) => {
      const tied = rankGroups[rank]
      tied.forEach((item, tiedIdx) => {
        const tr = document.createElement('tr')
        const rowBg = rankIdx % 2 === 0 ? R_ODD : R_EVEN

        const tdRank = document.createElement('td')
        tdRank.style.cssText = `padding:${R_PAD};font-size:12px;font-weight:700;color:#374151;background:${rowBg};border-bottom:${tiedIdx === tied.length - 1 ? R_DIV : 'none'};`
        tdRank.textContent = tiedIdx === 0 ? (RANK_LABELS[rank - 1] ?? `${rank}th Place`) : ''

        const tdName = document.createElement('td')
        tdName.style.cssText = `padding:${R_PAD};font-size:${R_FS};font-weight:700;color:#111;background:${rowBg};border-bottom:${tiedIdx === tied.length - 1 ? R_DIV : 'none'};`
        tdName.textContent = displayFn(item.player_id, item.rank, fmtPrefix)

        tr.appendChild(tdRank)
        tr.appendChild(tdName)

        const scoreVals = getScoreVals(fmt, item).slice(0, 2)
        scoreVals.forEach(val => {
          const tdScore = document.createElement('td')
          tdScore.style.cssText = `padding:${R_PAD};font-size:12px;color:${val !== null ? '#374151' : '#d1d5db'};background:${rowBg};border-bottom:${tiedIdx === tied.length - 1 ? R_DIV : 'none'};text-align:center;font-weight:600;`
          tdScore.textContent = val !== null ? String(val) : '—'
          tr.appendChild(tdScore)
        })

        tbody.appendChild(tr)
      })
    })
  })

  tbl.appendChild(tbody)
  return tbl
}

/** Full-field: 2-across grid — rank badge + name */
function buildFullFieldGrid(list, places, displayFn, accentColor = GREEN, bgColor = R_ODD, rawList = false) {
  const RANK_LABELS = ['1st Place', '2nd Place', '3rd Place', '4th Place', '5th Place', '6th Place']
  const grid = el('div', { display: 'grid', gridTemplateColumns: '1fr 1fr' })

  const items = rawList
    ? list.slice(0, Math.min(places, list.length))
    : list.filter(p => p.rank <= places).slice(0, places)
  const padded = [...items]
  if (padded.length % 2 !== 0) padded.push(null)

  padded.forEach((item, i) => {
    const cellBg = Math.floor(i / 2) % 2 === 0 ? bgColor : R_EVEN
    const cell = el('div', {
      padding: R_PAD,
      background: cellBg,
      borderBottom: R_DIV,
      borderRight: i % 2 === 0 ? R_DIV : 'none',
      display: 'flex', alignItems: 'center', gap: '8px',
    })
    if (!item) { grid.appendChild(cell); return }

    const rank = rawList ? i + 1 : item.rank
    if (!rawList) {
      const badge = el('span', {
        background: accentColor, color: '#fff',
        fontSize: '9px', fontWeight: '800',
        padding: '2px 7px', borderRadius: '20px',
        whiteSpace: 'nowrap', flexShrink: '0',
      })
      badge.textContent = RANK_LABELS[rank - 1] ?? `${rank}th`
      cell.appendChild(badge)
    }
    const nameEl = el('span', { fontSize: R_FS, fontWeight: '700', color: '#111' })
    nameEl.textContent = displayFn(item.player_id, item.rank ?? rank) + (item._suffix ?? '')
    cell.appendChild(nameEl)
    grid.appendChild(cell)
  })
  return grid
}

/** Side game with per-flight columns: Flight A | Flight B | ... */
function buildSideGameFlightRow(winners) {
  const row = el('div', {
    display: 'grid',
    gridTemplateColumns: winners.map(() => '1fr').join(' '),
  })
  winners.forEach(({ fl, name }, i) => {
    const cell = el('div', {
      padding: R_PAD,
      background: i % 2 === 0 ? R_ODD : R_EVEN,
      borderRight: i < winners.length - 1 ? R_DIV : 'none',
      borderBottom: R_DIV,
    })
    if (fl) {
      cell.appendChild(txt(`Flight ${fl}`, {
        display: 'block', fontSize: R_LABEL, fontWeight: '800',
        color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px',
      }))
    }
    cell.appendChild(txt(name, { display: 'block', fontSize: R_FS, fontWeight: '700', color: '#111' }))
    row.appendChild(cell)
  })
  return row
}

/** Single winner row (full-field, no flights) */
function buildSingleWinnerRow(name) {
  const row = el('div', { padding: R_PAD, background: R_ODD, borderBottom: R_DIV })
  row.appendChild(txt(name, { fontSize: R_FS, fontWeight: '700', color: '#111' }))
  return row
}

/** 2-across grid for CTP holes */
function buildCtpGrid(ctpData) {
  const grid = el('div', {
    display: 'grid',
    gridTemplateColumns: ctpData.length === 1 ? '1fr' : '1fr 1fr',
  })
  const padded = [...ctpData]
  if (padded.length % 2 !== 0) padded.push(null)
  padded.forEach((item, i) => {
    const cellBg = Math.floor(i / 2) % 2 === 0 ? R_ODD : R_EVEN
    const cell = el('div', {
      padding: R_PAD,
      background: cellBg,
      borderBottom: R_DIV,
      borderRight: i % 2 === 0 ? R_DIV : 'none',
    })
    if (!item) { grid.appendChild(cell); return }
    cell.appendChild(txt(item.label, {
      display: 'block', fontSize: R_LABEL, fontWeight: '800',
      color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px',
    }))
    cell.appendChild(txt(item.name, { display: 'block', fontSize: R_FS, fontWeight: '700', color: '#111' }))
    grid.appendChild(cell)
  })
  return grid
}

/** Multi-flight skins: one column per flight */
function buildMultiFlightSkins(skinFlights, skinsResults, displayFn) {
  const grid = el('div', {
    display: 'grid',
    gridTemplateColumns: skinFlights.map(() => '1fr').join(' '),
  })
  skinFlights.forEach((fl, i) => {
    const result = skinsResults?.[fl]
    const cell = el('div', {
      padding: R_PAD,
      background: i % 2 === 0 ? R_ODD : R_EVEN,
      borderRight: i < skinFlights.length - 1 ? R_DIV : 'none',
      borderBottom: R_DIV,
    })
    cell.appendChild(txt(`Flight ${fl}`, {
      display: 'block', fontSize: R_LABEL, fontWeight: '800',
      color: GREEN, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px',
    }))
    if (!result) {
      cell.appendChild(txt('—', { fontSize: '12px', color: '#bbb' }))
    } else {
      const { playerSkins } = result
      const winners = Object.entries(playerSkins).filter(([, n]) => n > 0).sort(([, a], [, b]) => b - a)
      if (winners.length === 0) {
        cell.appendChild(txt('No skins won', { fontSize: '12px', color: '#bbb' }))
      } else {
        winners.forEach(([pid, count]) => {
          const line = el('div', { fontSize: '12px', fontWeight: '700', color: '#111', marginBottom: '2px' })
          line.textContent = `${displayFn(pid, fl)} · ${count} skin${count !== 1 ? 's' : ''}`
          cell.appendChild(line)
        })
      }
    }
    grid.appendChild(cell)
  })
  return grid
}

function buildResultRow(name, label, accentColor = GREEN, rowBg = R_ODD) {
  const row = el('div', {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: R_PAD, background: rowBg, borderBottom: R_DIV,
  })
  row.appendChild(txt(name, { fontSize: R_FS, fontWeight: '700', color: '#111' }))
  const badge = el('span', {
    background: accentColor, color: '#fff',
    fontSize: R_LABEL, fontWeight: '800',
    padding: '2px 8px', borderRadius: '20px',
    letterSpacing: '0.03em', whiteSpace: 'nowrap',
  })
  badge.textContent = label
  row.appendChild(badge)
  return row
}

// ─── Helpers ─────────────────────────────────────────────────────
function el(tag, styles = {}) {
  const e = document.createElement(tag)
  Object.assign(e.style, styles)
  return e
}

function txt(content, styles = {}) {
  const s = document.createElement('span')
  Object.assign(s.style, styles)
  s.textContent = content
  return s
}

/** Compute tee time string for a group (mirrors Schedule.jsx logic) */
function computeTeeTime(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  const totalMins = h * 60 + m + (groupNum - 1) * intervalMins
  const hh = Math.floor(totalMins / 60) % 24
  const mm  = totalMins % 60
  const ampm = hh >= 12 ? 'PM' : 'AM'
  const hour12 = hh % 12 || 12
  return `${hour12}:${mm.toString().padStart(2, '0')} ${ampm}`
}

/** Convert hex color to rgba with given alpha (0-1) */
function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

// ═══════════════════════════════════════════════════════════════════
// ExportTeamPlayButton — Team Play Results PNG
// ═══════════════════════════════════════════════════════════════════

export function ExportTeamPlayButton({ event, eventPlayers, allScores, course, tglTeams, tglMembers, tglSelections, orgName, orgLogoUrl }) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const containerRef = useRef(null)

  async function handleExport() {
    setExportError(null)
    if (!tglTeams?.length) { setExportError('No teams configured.'); return }
    setExporting(true)
    try {
      let logoDataUrl = null
      if (orgLogoUrl) {
        try {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 4000)
          const resp = await fetch(orgLogoUrl, { signal: ctrl.signal })
          clearTimeout(timer)
          const blob = await resp.blob()
          logoDataUrl = await new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result)
            reader.onerror = rej
            reader.readAsDataURL(blob)
          })
        } catch { logoDataUrl = null }
      }

      const node = containerRef.current
      if (!node) return
      node.innerHTML = ''
      const pageEl = buildTeamPlayCard({ event, eventPlayers, allScores, course, tglTeams, tglMembers, tglSelections, orgName, orgLogoUrl: logoDataUrl })
      node.appendChild(pageEl)

      await new Promise(r => setTimeout(r, 100))

      const dataUrl = await toPng(pageEl, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#ffffff',
      })

      const link = document.createElement('a')
      const evPart = (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()
      downloadPng(dataUrl, `team_play_${evPart}.png`)
    } catch (err) {
      console.error('Team Play export failed:', err)
      setExportError(err?.message ?? 'Export failed')
    } finally {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setExporting(false)
    }
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8,
          border: '1px solid #d1d5db',
          background: exporting ? '#f3f4f6' : '#ffffff',
          color: '#111827', fontSize: 13, fontWeight: 600,
          cursor: exporting ? 'not-allowed' : 'pointer',
        }}
      >
        {exporting ? 'Exporting…' : '🏌 Team Play'}
      </button>
      {exportError && <p style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{exportError}</p>}
      <div ref={containerRef} style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none', zIndex: -1 }} />
    </>
  )
}

function buildTeamPlayCard({ event, eventPlayers, allScores, course, tglTeams, tglMembers, tglSelections, orgName, orgLogoUrl }) {
  const FONT = 'Arial, Helvetica, sans-serif'
  const W = 900
  const PAD_CARD = 28
  const BONE = '#f5f0e8'

  // Compute TGL results same way TGLManager does
  const epMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
  const attachPlayer = r => ({ ...r, player: epMap[r.player_id]?.player ?? null })

  let teamResults = []
  if (allScores.length && course) {
    try {
      const lb = computeLeaderboards(eventPlayers, allScores, course)
      const rankedA = (lb.full?.A ?? []).map(attachPlayer)
      const rankedB = (lb.full?.B ?? []).map(attachPlayer)
      const hasFlights = eventPlayers.some(ep => ep.flight === 'A' || ep.flight === 'B')
      const enrolledA = hasFlights ? eventPlayers.filter(ep => ep.flight === 'A').length : eventPlayers.length
      const enrolledB = eventPlayers.filter(ep => ep.flight === 'B').length
      const pointsA = rankedA.length ? assignTGLPoints(rankedA, Math.max(rankedA.length, enrolledA)) : {}
      const pointsB = rankedB.length ? assignTGLPoints(rankedB, Math.max(rankedB.length, enrolledB)) : {}
      const combinedPoints = { ...pointsA, ...pointsB }
      const allRanked = [...rankedA, ...rankedB]
      const results = computeTGLEventResults(allRanked, tglSelections, tglTeams, tglMembers, combinedPoints)
      teamResults = results.teamResults
    } catch { /* no scores yet */ }
  }

  function playerName(pid) {
    const ep = epMap[pid]
    if (!ep) return '—'
    return `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim() || '—'
  }

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  // ── Outer wrapper ────────────────────────────────────────────────
  const wrap = el('div', {
    width: `${W}px`, fontFamily: FONT,
    background: '#ffffff', padding: `${PAD_CARD}px`,
    boxSizing: 'border-box',
  })

  // ── Header ───────────────────────────────────────────────────────
  const hdr = el('div', {
    background: GREEN, borderRadius: '8px', padding: '10px 16px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '16px',
  })
  const hdrText = el('div', {})
  hdrText.appendChild(txt(orgName ?? event.league?.name ?? '', {
    display: 'block', fontSize: '16px', fontWeight: '700', color: GOLD,
  }))
  hdrText.appendChild(txt(`Event #${event.event_number} · Team Play Results`, {
    display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.85)', marginTop: '3px',
  }))
  hdrText.appendChild(txt(`${course?.name ?? ''} · ${eventDate}`, {
    display: 'block', fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '3px',
  }))
  hdr.appendChild(hdrText)
  if (orgLogoUrl) {
    const logo = document.createElement('img')
    logo.src = orgLogoUrl
    logo.style.cssText = `width:52px;height:52px;border-radius:50%;object-fit:cover;border:2px solid ${GOLD}`
    hdr.appendChild(logo)
  }
  wrap.appendChild(hdr)

  // ── Teams ─────────────────────────────────────────────────────────
  if (teamResults.length === 0) {
    const empty = el('div', { padding: '32px', textAlign: 'center', color: '#9ca3af', fontSize: '14px' })
    empty.textContent = 'No scores available yet'
    wrap.appendChild(empty)
  } else {
    teamResults.forEach((tr, i) => {
      const isFirst = i === 0
      const teamCard = el('div', {
        background: isFirst ? hexWithAlpha(GREEN, 0.06) : '#ffffff',
        border: `1px solid ${isFirst ? GREEN : '#e5e7eb'}`,
        borderRadius: '10px',
        marginBottom: '12px',
        overflow: 'hidden',
      })

      // Team header row
      const teamHdr = el('div', {
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: isFirst ? GREEN : '#f9fafb',
        borderBottom: `1px solid ${isFirst ? GOLD : '#e5e7eb'}`,
      })
      const rankBadge = el('span', {
        background: isFirst ? GOLD : '#e5e7eb',
        color: isFirst ? '#1a1a1a' : '#374151',
        fontSize: '10px', fontWeight: '800',
        padding: '2px 8px', borderRadius: '20px',
        marginRight: '10px', flexShrink: '0',
      })
      rankBadge.textContent = `#${tr.rank}`
      const teamNameEl = el('span', {
        fontSize: '15px', fontWeight: '800',
        color: isFirst ? '#ffffff' : GREEN,
        flex: '1',
      })
      teamNameEl.textContent = tr.team.name
      const teamPtsEl = el('span', {
        fontSize: '18px', fontWeight: '800',
        color: isFirst ? GOLD : GREEN,
      })
      teamPtsEl.textContent = `${tr.teamPoints % 1 === 0 ? tr.teamPoints : tr.teamPoints.toFixed(1)} pts`
      teamHdr.appendChild(rankBadge)
      teamHdr.appendChild(teamNameEl)
      teamHdr.appendChild(teamPtsEl)
      teamCard.appendChild(teamHdr)

      // Player rows
      const playerGrid = el('div', {
        display: 'grid',
        gridTemplateColumns: tr.selectedPlayers.length > 1 ? '1fr 1fr' : '1fr',
      })
      tr.selectedPlayers.forEach((sp, pi) => {
        const playerRow = el('div', {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          background: pi % 2 === 0 ? '#ffffff' : '#f9fafb',
          borderRight: pi % 2 === 0 && tr.selectedPlayers.length > 1 ? `1px solid #e5e7eb` : 'none',
        })
        const pName = el('span', { fontSize: '13px', fontWeight: '600', color: '#111827' })
        pName.textContent = playerName(sp.player_id)
        const pMeta = el('div', { textAlign: 'right' })
        const pRank = el('span', { fontSize: '11px', color: '#6b7280', display: 'block' })
        pRank.textContent = sp.rank ? `Rank #${sp.rank}` : '—'
        const pPts = el('span', { fontSize: '13px', fontWeight: '700', color: GREEN, display: 'block' })
        pPts.textContent = `${sp.points % 1 === 0 ? sp.points : sp.points.toFixed(1)} pts`
        pMeta.appendChild(pRank)
        pMeta.appendChild(pPts)
        playerRow.appendChild(pName)
        playerRow.appendChild(pMeta)
        playerGrid.appendChild(playerRow)
      })
      teamCard.appendChild(playerGrid)
      wrap.appendChild(teamCard)
    })
  }

  // ── Footer ───────────────────────────────────────────────────────
  const footer = el('div', { marginTop: '16px', textAlign: 'center' })
  footer.appendChild(txt('Powered by Scorify Golf', {
    fontSize: '10px', color: '#9ca3af', letterSpacing: '0.05em',
  }))
  wrap.appendChild(footer)

  return wrap
}

// ═══════════════════════════════════════════════════════════════════
// ExportHandicapButton — USGA Adjusted Scores PNG
// ═══════════════════════════════════════════════════════════════════

export function ExportHandicapButton({ event, eventPlayers, allScores, course, orgName, orgLogoUrl }) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const containerRef = useRef(null)

  async function handleExport() {
    setExportError(null)
    if (!course) { setExportError('No course loaded.'); return }
    setExporting(true)
    try {
      let logoDataUrl = null
      if (orgLogoUrl) {
        try {
          const ctrl = new AbortController()
          const timer = setTimeout(() => ctrl.abort(), 4000)
          const resp = await fetch(orgLogoUrl, { signal: ctrl.signal })
          clearTimeout(timer)
          const blob = await resp.blob()
          logoDataUrl = await new Promise((res, rej) => {
            const reader = new FileReader()
            reader.onload = () => res(reader.result)
            reader.onerror = rej
            reader.readAsDataURL(blob)
          })
        } catch { logoDataUrl = null }
      }

      const node = containerRef.current
      if (!node) return
      node.innerHTML = ''
      const pageEl = buildHandicapCard({ event, eventPlayers, allScores, course, orgName, orgLogoUrl: logoDataUrl })
      node.appendChild(pageEl)

      await new Promise(r => setTimeout(r, 100))

      const dataUrl = await toPng(pageEl, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: '#f5f0e8',
      })

      const link = document.createElement('a')
      const evPart = (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()
      downloadPng(dataUrl, `handicap_entry_${evPart}.png`)
    } catch (err) {
      console.error('Handicap export failed:', err)
      setExportError(err?.message ?? 'Export failed')
    } finally {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setExporting(false)
    }
  }

  return (
    <>
      <button
        onClick={handleExport}
        disabled={exporting}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8,
          border: '1px solid #d1d5db',
          background: exporting ? '#f3f4f6' : '#ffffff',
          color: '#111827', fontSize: 13, fontWeight: 600,
          cursor: exporting ? 'not-allowed' : 'pointer',
        }}
      >
        {exporting ? 'Exporting…' : '📋 Handicap Entry'}
      </button>
      {exportError && <p style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{exportError}</p>}
      <div ref={containerRef} style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none', zIndex: -1 }} />
    </>
  )
}

function buildHandicapCard({ event, eventPlayers, allScores, course, orgName, orgLogoUrl }) {
  const FONT = 'Arial, Helvetica, sans-serif'
  const BONE = '#f5f0e8'
  const CAP_BG = '#fef9c3'  // yellow
  const CAP_COLOR = '#dc2626' // red

  const holes = course.holes ?? []
  const par = holes.map(h => h.par ?? 0)
  const si  = holes.map(h => h.stroke_index ?? h.handicap ?? 0)

  // Score map: player_id → { [hole_number]: gross }
  const scoreMap = {}
  for (const s of allScores) {
    if (!scoreMap[s.player_id]) scoreMap[s.player_id] = {}
    scoreMap[s.player_id][s.hole_number] = s.gross_score ?? s.score ?? null
  }

  const players = eventPlayers
    .filter(ep => !ep.is_guest)
    .sort((a, b) => {
      const fa = (a.flight ?? '').localeCompare(b.flight ?? '')
      if (fa !== 0) return fa
      return (a.adjusted_handicap_index ?? 999) - (b.adjusted_handicap_index ?? 999)
    })

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  // Table layout — wide enough to fit 18 hole cols
  const W = 1300
  const PAD_CARD = 24
  const TH_BG = GREEN
  const TH_COLOR = '#ffffff'
  const FIXED_COL = 44  // CH, Adj F9, Adj B9, Adj Total, Adjustments
  const HOLE_W = 34

  const wrap = el('div', {
    width: `${W}px`, fontFamily: FONT,
    background: BONE, padding: `${PAD_CARD}px`,
    boxSizing: 'border-box',
  })

  // ── Header ───────────────────────────────────────────────────────
  const hdr = el('div', {
    display: 'flex', alignItems: 'center', gap: '16px',
    marginBottom: '20px', paddingBottom: '16px',
    borderBottom: `3px solid ${GOLD}`,
  })
  if (orgLogoUrl) {
    const logo = document.createElement('img')
    logo.src = orgLogoUrl
    Object.assign(logo.style, { width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover', flexShrink: '0' })
    hdr.appendChild(logo)
  }
  const hdrText = el('div', { flex: '1' })
  hdrText.appendChild(txt(orgName ?? event.league?.name ?? '', {
    display: 'block', fontSize: '12px', fontWeight: '700',
    color: GOLD, textTransform: 'uppercase', letterSpacing: '0.06em',
  }))
  hdrText.appendChild(txt(event.name ?? `Event #${event.event_number}`, {
    display: 'block', fontSize: '20px', fontWeight: '800', color: GREEN, lineHeight: '1.15',
  }))
  hdrText.appendChild(txt(`Handicap Entry · Adjusted Scores · ${eventDate}`, {
    display: 'block', fontSize: '11px', color: '#6b7280', marginTop: '2px',
  }))
  hdr.appendChild(hdrText)
  wrap.appendChild(hdr)

  // ── Table ─────────────────────────────────────────────────────────
  const tbl = document.createElement('table')
  Object.assign(tbl.style, {
    width: '100%', borderCollapse: 'collapse', fontSize: '11px', tableLayout: 'fixed',
  })

  // colgroup
  const cg = document.createElement('colgroup')
  // Player col
  const cPlayer = document.createElement('col')
  cPlayer.style.width = '130px'
  cg.appendChild(cPlayer)
  // Flight
  const cFlight = document.createElement('col')
  cFlight.style.width = '38px'
  cg.appendChild(cFlight)
  // CH
  const cCH = document.createElement('col')
  cCH.style.width = `${FIXED_COL}px`
  cg.appendChild(cCH)
  // H1-H18
  for (let h = 0; h < 18; h++) {
    const c = document.createElement('col')
    c.style.width = `${HOLE_W}px`
    cg.appendChild(c)
  }
  // Adj F9, B9, Total
  for (let i = 0; i < 3; i++) {
    const c = document.createElement('col')
    c.style.width = `${FIXED_COL + 4}px`
    cg.appendChild(c)
  }
  // Adjustments
  const cAdj = document.createElement('col')
  cAdj.style.width = '110px'
  cg.appendChild(cAdj)
  tbl.appendChild(cg)

  const thead = document.createElement('thead')

  function thCell(text, styles = {}) {
    const td = document.createElement('th')
    Object.assign(td.style, {
      background: TH_BG, color: TH_COLOR,
      padding: '5px 3px', fontWeight: '700',
      textAlign: 'center', fontSize: '10px',
      border: '1px solid #145230',
      ...styles,
    })
    td.textContent = text
    return td
  }

  // Row 1: header labels
  const hRow = document.createElement('tr')
  hRow.appendChild(thCell('Player', { textAlign: 'left', padding: '5px 6px' }))
  hRow.appendChild(thCell('Flt'))
  hRow.appendChild(thCell('CH'))
  for (let h = 1; h <= 18; h++) hRow.appendChild(thCell(String(h)))
  hRow.appendChild(thCell('F9'))
  hRow.appendChild(thCell('B9'))
  hRow.appendChild(thCell('Tot'))
  hRow.appendChild(thCell('Adjustments', { textAlign: 'left', padding: '5px 6px' }))
  thead.appendChild(hRow)

  // Row 2: Par
  const parRow = document.createElement('tr')
  parRow.appendChild(thCell('Par', { textAlign: 'left', padding: '5px 6px', background: hexWithAlpha(GREEN, 0.7) }))
  parRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.7) }))
  parRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.7) }))
  par.forEach(p => parRow.appendChild(thCell(String(p), { background: hexWithAlpha(GREEN, 0.7) })))
  parRow.appendChild(thCell(String(par.slice(0, 9).reduce((a, b) => a + b, 0)), { background: hexWithAlpha(GREEN, 0.7) }))
  parRow.appendChild(thCell(String(par.slice(9).reduce((a, b) => a + b, 0)), { background: hexWithAlpha(GREEN, 0.7) }))
  parRow.appendChild(thCell(String(par.reduce((a, b) => a + b, 0)), { background: hexWithAlpha(GREEN, 0.7) }))
  parRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.7) }))
  thead.appendChild(parRow)

  // Row 3: SI
  const siRow = document.createElement('tr')
  siRow.appendChild(thCell('S.I.', { textAlign: 'left', padding: '5px 6px', background: hexWithAlpha(GREEN, 0.5) }))
  siRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.5) }))
  siRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.5) }))
  si.forEach(s => siRow.appendChild(thCell(String(s), { background: hexWithAlpha(GREEN, 0.5) })))
  siRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.5) }))
  siRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.5) }))
  siRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.5) }))
  siRow.appendChild(thCell('', { background: hexWithAlpha(GREEN, 0.5) }))
  thead.appendChild(siRow)

  tbl.appendChild(thead)
  const tbody = document.createElement('tbody')

  players.forEach((ep, rowIdx) => {
    const ch = ep.course_handicap ?? ep.adjusted_handicap_index ?? 0
    const scores = scoreMap[ep.player_id] ?? {}
    const pName = `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim() || '—'
    const flight = ep.flight ?? '—'
    const rowBg = rowIdx % 2 === 0 ? '#ffffff' : '#f9fafb'

    const adjScores = []
    const cappedHoles = [] // { holeNum, gross, adj }

    for (let h = 0; h < 18; h++) {
      const gross = scores[h + 1] ?? null
      if (gross === null) { adjScores.push(null); continue }
      const strokes = getStrokesOnHole(ch, si[h])
      const cap = par[h] + 2 + strokes
      const adj = Math.min(gross, cap)
      adjScores.push(adj)
      if (adj < gross) cappedHoles.push({ holeNum: h + 1, gross, adj })
    }

    const adjF9  = adjScores.slice(0, 9).reduce((sum, v) => sum + (v ?? 0), 0)
    const adjB9  = adjScores.slice(9).reduce((sum, v) => sum + (v ?? 0), 0)
    const adjTot = adjF9 + adjB9
    const adjNotes = cappedHoles.map(c => `H${c.holeNum}:${c.gross}→${c.adj}`).join(', ')

    const tr = document.createElement('tr')

    function td(text, styles = {}) {
      const cell = document.createElement('td')
      Object.assign(cell.style, {
        padding: '4px 3px', textAlign: 'center',
        border: '1px solid #e5e7eb',
        background: rowBg,
        fontSize: '11px', color: '#111827',
        ...styles,
      })
      cell.textContent = text
      return cell
    }

    tr.appendChild(td(pName, { textAlign: 'left', padding: '4px 6px', fontWeight: '600' }))
    tr.appendChild(td(flight))
    tr.appendChild(td(String(ch), { fontWeight: '700', color: GREEN }))

    adjScores.forEach((adj, h) => {
      const gross = scores[h + 1] ?? null
      const isCapped = gross !== null && adj !== null && adj < gross
      tr.appendChild(td(adj !== null ? String(adj) : '—', {
        background: isCapped ? CAP_BG : rowBg,
        color: isCapped ? CAP_COLOR : '#111827',
        fontWeight: isCapped ? '700' : '400',
      }))
    })

    const hasAllF9 = adjScores.slice(0, 9).every(v => v !== null)
    const hasAllB9 = adjScores.slice(9).every(v => v !== null)
    tr.appendChild(td(hasAllF9 ? String(adjF9) : '—', { fontWeight: '700', background: hexWithAlpha(GREEN, 0.07) }))
    tr.appendChild(td(hasAllB9 ? String(adjB9) : '—', { fontWeight: '700', background: hexWithAlpha(GREEN, 0.07) }))
    tr.appendChild(td(hasAllF9 && hasAllB9 ? String(adjTot) : '—', { fontWeight: '800', color: GREEN, background: hexWithAlpha(GREEN, 0.1) }))
    tr.appendChild(td(adjNotes || '—', { textAlign: 'left', padding: '4px 6px', fontSize: '10px', color: '#6b7280' }))

    tbody.appendChild(tr)
  })

  tbl.appendChild(tbody)
  wrap.appendChild(tbl)

  // ── Legend + Footer ──────────────────────────────────────────────
  const legend = el('div', { marginTop: '12px', display: 'flex', gap: '20px', alignItems: 'center' })
  const capSwatch = el('span', {
    display: 'inline-block', width: '14px', height: '14px',
    background: CAP_BG, border: `1px solid ${CAP_COLOR}`,
    borderRadius: '3px', verticalAlign: 'middle', marginRight: '5px',
  })
  const capLegend = el('span', { fontSize: '10px', color: '#6b7280' })
  capLegend.textContent = 'Capped score (USGA ESC adjustment applied)'
  legend.appendChild(capSwatch)
  legend.appendChild(capLegend)

  const spacer = el('div', { flex: '1' })
  legend.appendChild(spacer)
  legend.appendChild(txt('Powered by Scorify Golf', { fontSize: '10px', color: '#9ca3af' }))
  wrap.appendChild(legend)

  return wrap
}
