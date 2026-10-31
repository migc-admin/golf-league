/**
 * ScorecardExport — Landscape 11"×8.5" PNG, two cards stacked per page.
 *
 * All data columns (holes + OUT/INIT/IN/TOT/HCP/NET/PUTTS) are equal width.
 * Rows: Hole · Tee×N (yardage) · Par · S.I. · Player×4
 */

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
import { getStrokesOnHole, getStrokeIndexForTee } from '../lib/engines/scoring'
import { buildPairings, matchCH } from '../lib/engines/matchPoints'
import { supabase } from '../lib/supabase'
import { ActionButton } from './ui/Button'

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
      <ActionButton icon="download" onClick={handleExport} loading={exporting} disabled={groupNums.length === 0}>
        {exporting ? 'Exporting…' : 'Download'}
      </ActionButton>
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
    fontFamily: 'Manrope, sans-serif',
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
      letterSpacing: '0.14em', fontFamily: 'Manrope, sans-serif',
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
    font-family: Manrope, sans-serif;
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

// ═══════════════════════════════════════════════════════════════════
// ExportMatchPlayCardsButton — blank match play tracking cards (PNG)
// One page per GROUP (all matchups sharing a group_number are combined
// onto a single card), printed twice (top/bottom) — mirrors the Tee
// Sheet's "2 copies per page" pattern, just at the group level instead
// of the pairing level, to avoid excess printouts.
// ═══════════════════════════════════════════════════════════════════
export function ExportMatchPlayCardsButton({ event, eventPlayers, course }) {
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(null)
  const containerRef = useRef(null)

  async function handleExport() {
    setExportError(null)
    if (!course) { setExportError('No course loaded — cannot export.'); return }
    setExporting(true)
    try {
      const { data: storedPairings } = await supabase
        .from('match_pairings')
        .select('*')
        .eq('event_id', event.id)
        .order('match_number')

      const playerMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
      const groupMap = {} // groupNumber -> [{ playerA, playerB, matchNumber }]
      let n = 1
      if (storedPairings && storedPairings.length > 0) {
        for (const p of storedPairings) {
          const playerA = playerMap[p.player_a_id]
          const playerB = playerMap[p.player_b_id]
          if (!playerA || !playerB) continue
          const g = playerA.group_number ?? playerB.group_number ?? 0
          if (!groupMap[g]) groupMap[g] = []
          groupMap[g].push({ playerA, playerB, matchNumber: p.match_number ?? n })
          n++
        }
      } else {
        const groups = {}
        for (const ep of eventPlayers) {
          const g = ep.group_number ?? 0
          if (!groups[g]) groups[g] = []
          groups[g].push(ep)
        }
        for (const [g, members] of Object.entries(groups)) {
          for (const { playerA, playerB } of buildPairings(members)) {
            if (!groupMap[g]) groupMap[g] = []
            groupMap[g].push({ playerA, playerB, matchNumber: n++ })
          }
        }
      }

      const groupEntries = Object.entries(groupMap)
      if (groupEntries.length === 0) {
        setExportError('No match play pairings found — assign groups or set up pairings first.')
        setExporting(false)
        return
      }

      for (const [groupNumber, pairs] of groupEntries) {
        const node = containerRef.current
        if (!node) continue
        node.innerHTML = ''

        const pageEl = buildMatchPage({ event, course, groupNumber, pairs })
        node.appendChild(pageEl)

        await new Promise(r => setTimeout(r, 80))

        const dataUrl = await toPng(pageEl, {
          pixelRatio: 3,
          cacheBust: true,
          backgroundColor: '#ffffff',
          width: PAGE_W,
          height: PAGE_H,
        })

        const leaguePart = (event.league?.name ?? 'league').replace(/[^a-z0-9]/gi, '_').toLowerCase()
        const eventPart  = (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()
        downloadPng(dataUrl, `matchplay_${leaguePart}_${eventPart}_group${groupNumber}.png`)
        await new Promise(r => setTimeout(r, 250))
      }
    } catch (err) {
      console.error('Match play card export failed:', err)
      setExportError(err?.message ?? 'Export failed — check console for details.')
    } finally {
      if (containerRef.current) containerRef.current.innerHTML = ''
      setExporting(false)
    }
  }

  return (
    <>
      <ActionButton icon="download" onClick={handleExport} loading={exporting}>
        {exporting ? 'Exporting…' : 'Download'}
      </ActionButton>
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

// ─── Page: same group card printed twice (top/bottom), like the Tee Sheet ──
function buildMatchPage({ event, course, groupNumber, pairs }) {
  const page = el('div', {
    width: PAGE_W + 'px', height: PAGE_H + 'px',
    background: '#ffffff',
    display: 'flex', flexDirection: 'column',
    padding: PAD + 'px',
    boxSizing: 'border-box',
    fontFamily: 'Manrope, sans-serif',
  })
  const opts = { event, course, groupNumber, pairs }
  page.appendChild(buildMatchCard(opts))
  page.appendChild(buildCutLine())
  page.appendChild(buildMatchCard(opts))
  return page
}

// ─── Card: HOLE/PAR/S.I. (shared) + all of the group's matchups stacked ──
// Kept intentionally sparse — full event/course/org details already live
// on the primary Tee Sheet card, so this one only carries what's unique
// to match play tracking.
function buildMatchCard({ course, groupNumber, pairs }) {
  const parPerHole  = course.par_per_hole  ?? []
  const strokeIndex = course.stroke_index  ?? []

  const matches = pairs.map(pair => {
    const chA = matchCH(pair.playerA) ?? 0
    const chB = matchCH(pair.playerB) ?? 0
    const baseline = Math.min(chA, chB)
    const relA = Math.max(0, chA - baseline)
    const relB = Math.max(0, chB - baseline)
    const nameA = `${pair.playerA.player?.first_name ?? ''} ${pair.playerA.player?.last_name ?? ''}`.trim()
    const nameB = `${pair.playerB.player?.first_name ?? ''} ${pair.playerB.player?.last_name ?? ''}`.trim()
    return { matchNumber: pair.matchNumber, nameA, nameB, chA, chB, relA, relB }
  })

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

  // ── Header — one line, minimal ───────────────────────────────────
  const header = el('div', {
    background: GREEN,
    padding: '5px 10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: '0',
  })
  header.appendChild(txt(`Group ${groupNumber} \u00b7 Match Play`, {
    color: GOLD, fontSize: '13px', fontWeight: '700', letterSpacing: '0.02em',
  }))
  header.appendChild(txt(
    matches.length > 1 ? `${matches.length} Matches` : `Match ${matches[0]?.matchNumber ?? 1}`,
    { color: '#ffffff', fontSize: '10px', fontWeight: '600' }
  ))
  card.appendChild(header)

  // ── Score table — shared HOLE/PAR/S.I. + one block per matchup ──
  card.appendChild(buildMatchTable({ parPerHole, strokeIndex, matches }))

  // ── Footer — short legend only ───────────────────────────────────
  const footer = el('div', {
    padding: '3px 10px',
    background: GRAY_BG,
    borderTop: '2px solid ' + GREEN,
    flexShrink: '0',
  })
  footer.appendChild(txt(
    'RESULT: winner\u2019s initial each hole (\u2014 = halve).  STATUS: running score (e.g. 2\u2191, AS, 1\u2193, Dormie 2).',
    { fontSize: '9px', color: '#6b7280' }
  ))
  card.appendChild(footer)

  return card
}

// ─── Match play score table — HOLE/PAR/S.I. (shared) + per-matchup blocks
// of 2 player rows + RESULT + STATUS. Each subsequent matchup is set off
// with a thicker top border so it reads as a distinct block. ──
function buildMatchTable({ parPerHole, strokeIndex, matches }) {
  const tbl = document.createElement('table')
  tbl.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
    font-family: Manrope, sans-serif;
    flex: 1;
  `

  // Colgroup — label + 18 holes + OUT/IN/TOT/Holes Won
  const cg = document.createElement('colgroup')
  const colDefs = [
    COL_LABEL,
    ...Array(9).fill(COL_HOLE),   // H1-9
    COL_HOLE,                      // OUT
    ...Array(9).fill(COL_HOLE),   // H10-18
    COL_HOLE, COL_HOLE,            // IN, TOT
    COL_HOLE + 20,                  // Holes Won (wider to fit the label)
  ]
  colDefs.forEach(w => {
    const c = document.createElement('col')
    c.style.width = w + 'px'
    cg.appendChild(c)
  })
  tbl.appendChild(cg)

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

  function mkLabel(content, opts = {}) {
    const td = mkTd(content, { bg: GRAY_BG, color: '#374151', bold: true, align: 'left', fontSize: '9px', ...opts })
    td.style.paddingLeft = '5px'
    return td
  }

  // Blank writable cell (RESULT / STATUS rows) — dashed border hints "write here"
  function mkWriteCell(opts = {}) {
    const td = mkTd('', { bg: '#fffdf5', ...opts })
    td.style.border = `1px dashed ${BORDER}`
    return td
  }

  // Score cell with optional match play stroke dots (relative handicap)
  function mkScoreCell(strokes) {
    const td = mkTd('', { bg: 'transparent' })
    td.style.position = 'relative'
    if (strokes > 0) {
      const dotWrap = document.createElement('span')
      dotWrap.style.cssText = 'position: absolute; top: 2px; right: 2px; display: flex; gap: 1px; align-items: center;'
      for (let i = 0; i < Math.min(strokes, 2); i++) {
        const dot = document.createElement('span')
        dot.style.cssText = 'display: inline-block; width: 4px; height: 4px; border-radius: 50%; background: #9a5b13;'
        dotWrap.appendChild(dot)
      }
      td.appendChild(dotWrap)
    }
    return td
  }

  // ── HOLE header row ────────────────────────────────────────────
  const headerRow = document.createElement('tr')
  headerRow.appendChild(mkLabel('HOLE', { bg: GREEN, color: '#ffffff' }))
  for (let h = 1; h <= 9; h++) headerRow.appendChild(mkTd(h, { bg: GREEN, color: '#ffffff', bold: true }))
  headerRow.appendChild(mkTd('OUT', { bg: GOLD, color: '#1a1a1a', bold: true }))
  for (let h = 10; h <= 18; h++) headerRow.appendChild(mkTd(h, { bg: GREEN, color: '#ffffff', bold: true }))
  headerRow.appendChild(mkTd('IN',  { bg: GOLD, color: '#1a1a1a', bold: true }))
  headerRow.appendChild(mkTd('TOT', { bg: GOLD, color: '#1a1a1a', bold: true }))
  headerRow.appendChild(mkTd('Holes Won',  { bg: GOLD, color: '#1a1a1a', bold: true, fontSize: '8px' }))
  tbl.appendChild(headerRow)

  // ── PAR row ────────────────────────────────────────────────────
  const fPar = parPerHole.slice(0, 9).reduce((a, b) => a + b, 0)
  const bPar = parPerHole.slice(9, 18).reduce((a, b) => a + b, 0)
  const parRow = document.createElement('tr')
  parRow.appendChild(mkLabel('PAR'))
  parPerHole.slice(0, 9).forEach(v => parRow.appendChild(mkTd(v, { bg: GRAY_BG, color: '#374151', bold: true })))
  parRow.appendChild(mkTd(fPar, { bg: '#e0e0dc', bold: true }))
  parPerHole.slice(9, 18).forEach(v => parRow.appendChild(mkTd(v, { bg: GRAY_BG, color: '#374151', bold: true })))
  parRow.appendChild(mkTd(bPar,        { bg: '#e0e0dc', bold: true }))
  parRow.appendChild(mkTd(fPar + bPar, { bg: '#e0e0dc', bold: true }))
  parRow.appendChild(mkTd('', { bg: '#e0e0dc' }))
  tbl.appendChild(parRow)

  // ── S.I. row ───────────────────────────────────────────────────
  const siRow = document.createElement('tr')
  siRow.appendChild(mkLabel('S.I.', { bg: '#efefed', color: '#6b7280' }))
  strokeIndex.slice(0, 9).forEach(v => siRow.appendChild(mkTd(v, { bg: '#efefed', color: '#6b7280' })))
  siRow.appendChild(mkTd('', { bg: '#efefed' }))
  strokeIndex.slice(9, 18).forEach(v => siRow.appendChild(mkTd(v, { bg: '#efefed', color: '#6b7280' })))
  siRow.appendChild(mkTd('', { bg: '#efefed' }))
  siRow.appendChild(mkTd('', { bg: '#efefed' }))
  siRow.appendChild(mkTd('', { bg: '#efefed' }))
  tbl.appendChild(siRow)

  // ── One block per matchup: 2 player rows + RESULT + STATUS ────────
  matches.forEach((m, idx) => {
    const divider = idx > 0 ? `2px solid ${GREEN}` : null

    ;[{ name: m.nameA, ch: m.chA, rel: m.relA }, { name: m.nameB, ch: m.chB, rel: m.relB }].forEach((p, pi) => {
      const tr = document.createElement('tr')
      const cells = []
      // Only the player getting strokes (rel > 0) shows the stroke count in parens —
      // the lower-handicap player in the pairing plays off scratch, so no parens.
      const nameLabel = p.rel > 0 ? `${p.name || 'Player'} (${p.rel})` : (p.name || 'Player')
      cells.push(mkLabel(nameLabel, { bg: 'transparent', color: '#111827' }))
      for (let h = 1; h <= 9; h++) cells.push(mkScoreCell(getStrokesOnHole(p.rel, strokeIndex[h - 1])))
      cells.push(mkTd('', { bg: 'transparent', bold: true }))
      for (let h = 10; h <= 18; h++) cells.push(mkScoreCell(getStrokesOnHole(p.rel, strokeIndex[h - 1])))
      cells.push(mkTd('', { bg: 'transparent', bold: true }))
      cells.push(mkTd('', { bg: 'transparent', bold: true }))
      cells.push(mkWriteCell({ color: '#9a5b13', bold: true }))
      if (divider && pi === 0) cells.forEach(c => { c.style.borderTop = divider })
      cells.forEach(c => tr.appendChild(c))
      tbl.appendChild(tr)
    })

    // HOLE RESULT row — blank cell per hole to mark the winner's initial
    const resultRow = document.createElement('tr')
    resultRow.appendChild(mkLabel('HOLE RESULT', { bg: '#fef3e2', color: '#9a5b13' }))
    for (let h = 1; h <= 9; h++) resultRow.appendChild(mkWriteCell())
    resultRow.appendChild(mkTd('', { bg: '#fef3e2' }))
    for (let h = 10; h <= 18; h++) resultRow.appendChild(mkWriteCell())
    resultRow.appendChild(mkTd('', { bg: '#fef3e2' }))
    resultRow.appendChild(mkTd('', { bg: '#fef3e2' }))
    resultRow.appendChild(mkTd('', { bg: '#fef3e2' }))
    tbl.appendChild(resultRow)

    // MATCH STATUS row — blank cell per hole to track the running match score
    const statusRow = document.createElement('tr')
    statusRow.appendChild(mkLabel('MATCH STATUS', { bg: GRAY_BG, color: '#374151' }))
    for (let h = 1; h <= 9; h++) statusRow.appendChild(mkWriteCell())
    statusRow.appendChild(mkTd('', { bg: '#e8e8e4' }))
    for (let h = 10; h <= 18; h++) statusRow.appendChild(mkWriteCell())
    statusRow.appendChild(mkTd('', { bg: '#e8e8e4' }))
    statusRow.appendChild(mkTd('', { bg: '#e8e8e4' }))
    statusRow.appendChild(mkTd('', { bg: '#e8e8e4' }))
    tbl.appendChild(statusRow)
  })

  return tbl
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
      <ActionButton icon="download" onClick={handleExport} loading={exporting}>
        {exporting ? 'Exporting…' : 'Download'}
      </ActionButton>
      {exportError && <p style={{ marginTop: 6, fontSize: 12, color: '#dc2626' }}>{exportError}</p>}
      <div ref={containerRef} style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none', zIndex: -1 }} />
    </>
  )
}

function buildHandicapCard({ event, eventPlayers, allScores, course, orgName, orgLogoUrl }) {
  const FONT = 'Manrope, sans-serif'
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
