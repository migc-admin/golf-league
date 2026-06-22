/**
 * ScorecardExport — Landscape 11"×8.5" PNG, two cards stacked per page.
 *
 * All data columns (holes + OUT/INIT/IN/TOT/HCP/NET/PUTTS) are equal width.
 * Rows: Hole · Tee×N (yardage) · Par · S.I. · Player×4
 */

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'
import { getStrokesOnHole } from '../lib/engines/scoring'

// ─── Layout constants ─────────────────────────────────────────────
const PAGE_W    = 1100
const PAGE_H    = 850
const PAD       = 18
const GAP       = 10
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
export function ExportScorecardsButton({ event, eventPlayers, course }) {
  const [exporting, setExporting] = useState(false)
  const containerRef = useRef(null)

  const groupNums = [...new Set(
    eventPlayers.map(ep => ep.group_number).filter(Boolean)
  )].sort((a, b) => a - b)

  const groupCodes    = event.group_codes ?? {}
  const scorecardBase = `${window.location.origin}/scorecard/${event.id}`

  async function handleExport() {
    if (!course || groupNums.length === 0) return
    setExporting(true)
    try {
      for (const g of groupNums) {
        const players = eventPlayers
          .filter(ep => ep.group_number === g && !ep.is_guest)
          .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))

        const code      = groupCodes[g] ?? ''
        const qrUrl     = code ? `${scorecardBase}?code=${code}` : scorecardBase
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 140, margin: 1,
          color: { dark: GREEN, light: '#ffffff' },
        })

        const node = containerRef.current
        if (!node) continue
        node.innerHTML = ''

        const pageEl = buildPage({ event, course, groupNum: g, players, code, qrDataUrl })
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
        link.download = `scorecard-group-${g}.png`
        link.href = dataUrl
        link.click()
        await new Promise(r => setTimeout(r, 250))
      }
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
        {exporting ? '⏳ Exporting…' : '🖨 Export Scorecards'}
      </button>
      <div
        ref={containerRef}
        style={{ position: 'fixed', top: -99999, left: -99999, pointerEvents: 'none', zIndex: -1 }}
      />
    </>
  )
}

// ─── Page: two cards stacked ──────────────────────────────────────
function buildPage({ event, course, groupNum, players, code, qrDataUrl }) {
  const page = el('div', {
    width: PAGE_W + 'px', height: PAGE_H + 'px',
    background: '#ffffff',
    display: 'flex', flexDirection: 'column',
    gap: GAP + 'px',
    padding: PAD + 'px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
  })
  const opts = { event, course, groupNum, players, code, qrDataUrl }
  page.appendChild(buildCard(opts))
  page.appendChild(buildCard(opts))
  return page
}

// ─── Card ─────────────────────────────────────────────────────────
function buildCard({ event, course, groupNum, players, code, qrDataUrl }) {
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

  // Per-flight tee labels: [{ flight: 'A', tee: 'Blue' }, { flight: 'B', tee: 'White' }]
  const flightTeeMap = {}
  players.forEach(p => {
    if (p.flight) flightTeeMap[p.flight] = p.tee ?? null
  })
  // Lines like "Flight A - Blue Tees" or just "Flight A" if no tee
  const flightTeeLines = Object.keys(flightTeeMap).sort().map(f => {
    const t = flightTeeMap[f]
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
  hLeft.appendChild(txt("Mulligan's Island Golf Club", {
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

  const teeTime = computeTeeTime(event.start_time, event.tee_time_interval_mins ?? 10, groupNum)

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
  card.appendChild(buildTable({ parPerHole, strokeIndex, teesToShow, players }))

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
  card.appendChild(footer)

  return card
}

// ─── Score table ─────────────────────────────────────────────────
function buildTable({ parPerHole, strokeIndex, teesToShow, players }) {
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
    } = rowDef

    const tr = document.createElement('tr')
    tr.appendChild(mkLabel(label, { bg: labelBg, color: labelColor, fontSize: labelFontSize }))

    // H1-9
    ;(h1to9 ?? Array(9).fill('')).forEach(v =>
      tr.appendChild(mkTd(v, { bg: holeBg, color: holeColor, bold: holeBold }))
    )
    // OUT
    tr.appendChild(mkTd(out ?? '', { bg: summBg, color: summColor, bold: true }))
    // INIT
    tr.appendChild(typeof initCell === 'object' && initCell !== null
      ? (() => { const c = mkInitCell(initCell.val ?? ''); return c })()
      : mkInitCell(initCell ?? '')
    )
    // H10-18
    ;(h10to18 ?? Array(9).fill('')).forEach(v =>
      tr.appendChild(mkTd(v, { bg: holeBg, color: holeColor, bold: holeBold }))
    )
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

    // H1-9 with stroke dots
    for (let h = 1; h <= 9; h++) {
      const strokes = (ep && ch !== null) ? getStrokesOnHole(ch, strokeIndex[h - 1]) : 0
      tr.appendChild(mkScoreCell(strokes))
    }
    // OUT
    tr.appendChild(mkTd('', { bg: 'transparent', color: '#374151', bold: true }))
    // INIT
    tr.appendChild(mkInitCell(initials))
    // H10-18 with stroke dots
    for (let h = 10; h <= 18; h++) {
      const strokes = (ep && ch !== null) ? getStrokesOnHole(ch, strokeIndex[h - 1]) : 0
      tr.appendChild(mkScoreCell(strokes))
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
