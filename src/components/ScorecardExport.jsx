/**
 * ScorecardExport — Landscape 11" × 8.5" PNG, two cards stacked top/bottom per group.
 *
 * Columns: Label | H1-9 | OUT | INIT | H10-18 | IN | TOT | HCP | NET
 * Rows:    Hole · Par · S.I. · Tees · Player×4
 */

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'

// ─── Constants ────────────────────────────────────────────────────
const GREEN   = '#1B4332'
const GOLD    = '#C9A84C'
const GRAY_BG = '#f5f5f3'
const BORDER  = '#c8c8c8'

// Page: landscape 11×8.5 @ base 1100×850 → 3x = 3300×2550px (300dpi)
const PAGE_W  = 1100
const PAGE_H  = 850
const PAD     = 18   // outer page padding
const GAP     = 10   // gap between two cards
const CARD_W  = PAGE_W - PAD * 2
const CARD_H  = Math.floor((PAGE_H - PAD * 2 - GAP) / 2)

// Column widths (must sum close to CARD_W)
const COL_LABEL = 64
const COL_HOLE  = 38   // hole cells 1-9 and 10-18
const COL_SUMM  = 42   // OUT / IN / TOT
const COL_INIT  = 34   // INIT (between OUT and hole 10)
const COL_HCP   = 36
const COL_NET   = 36
// 64 + 18×38 + 3×42 + 34 + 36 + 36 = 64+684+126+34+36+36 = 980  (≤ CARD_W ✓)

const CELL_H    = 26   // row height px

// ─── Main Export Button ───────────────────────────────────────────
export function ExportScorecardsButton({ event, eventPlayers, course }) {
  const [exporting, setExporting] = useState(false)
  const containerRef = useRef(null)

  const groupNums = [...new Set(
    eventPlayers.map(ep => ep.group_number).filter(Boolean)
  )].sort((a, b) => a - b)

  const groupCodes   = event.group_codes ?? {}
  const scorecardBase = `${window.location.origin}/scorecard/${event.id}`

  async function handleExport() {
    if (!course || groupNums.length === 0) return
    setExporting(true)
    try {
      for (const g of groupNums) {
        const players = eventPlayers
          .filter(ep => ep.group_number === g && !ep.is_guest)
          .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))

        const code    = groupCodes[g] ?? ''
        const qrUrl   = code ? `${scorecardBase}?code=${code}` : scorecardBase
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 140, margin: 1,
          color: { dark: GREEN, light: '#ffffff' },
        })

        const node = containerRef.current
        if (!node) continue
        node.innerHTML = ''

        const pageEl = buildPage({ event, course, groupNum: g, players, code, qrDataUrl })
        node.appendChild(pageEl)

        await new Promise(r => setTimeout(r, 100))

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

// ─── Page builder (two cards stacked, landscape) ──────────────────
function buildPage({ event, course, groupNum, players, code, qrDataUrl }) {
  const page = mkEl('div', {
    width: PAGE_W + 'px', height: PAGE_H + 'px',
    background: '#ffffff',
    display: 'flex', flexDirection: 'column',
    gap: GAP + 'px',
    padding: PAD + 'px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
  })
  page.appendChild(buildCard({ event, course, groupNum, players, code, qrDataUrl }))
  page.appendChild(buildCard({ event, course, groupNum, players, code, qrDataUrl }))
  return page
}

// ─── Single card ──────────────────────────────────────────────────
function buildCard({ event, course, groupNum, players, code, qrDataUrl }) {
  const parPerHole  = course.par_per_hole  ?? []
  const strokeIndex = course.stroke_index  ?? []

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      })
    : ''

  // Tees used in this group (unique, sorted)
  const tees = [...new Set(players.map(ep => ep.tee).filter(Boolean))].join(' / ') || '—'

  const card = mkEl('div', {
    width: CARD_W + 'px',
    height: CARD_H + 'px',
    border: '2px solid ' + GREEN,
    borderRadius: '7px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    flexShrink: '0',
  })

  // ── Header ──────────────────────────────────────────────────────
  const header = mkEl('div', {
    background: GREEN,
    padding: '6px 12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: '0',
  })
  const hLeft = mkEl('div')
  hLeft.appendChild(mkTxt("Mulligan's Island Golf Club", {
    display: 'block', color: GOLD,
    fontSize: '14px', fontWeight: '700', letterSpacing: '0.02em',
  }))
  hLeft.appendChild(mkTxt(event.name ?? `Event #${event.event_number}`, {
    display: 'block', color: '#ffffff', fontSize: '11px', marginTop: '1px',
  }))
  hLeft.appendChild(mkTxt(`${course.name ?? ''} · ${eventDate}`, {
    display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '9px', marginTop: '1px',
  }))
  header.appendChild(hLeft)

  const badge = mkEl('div', {
    background: GOLD, color: '#1a1a1a',
    fontWeight: '800', fontSize: '17px',
    borderRadius: '5px', padding: '3px 10px',
    whiteSpace: 'nowrap',
  })
  badge.textContent = `Group ${groupNum}`
  header.appendChild(badge)
  card.appendChild(header)

  // ── Score table ──────────────────────────────────────────────────
  card.appendChild(buildTable({ parPerHole, strokeIndex, players, tees }))

  // ── Footer ───────────────────────────────────────────────────────
  const footer = mkEl('div', {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '6px 10px',
    background: GRAY_BG,
    borderTop: '2px solid ' + GREEN,
    flexShrink: '0',
  })
  if (qrDataUrl) {
    const img = mkEl('img', { width: '64px', height: '64px', flexShrink: '0' })
    img.src = qrDataUrl
    footer.appendChild(img)
  }
  const ftxt = mkEl('div')
  ftxt.appendChild(mkTxt('Scan to enter scores', {
    display: 'block', fontSize: '9px', color: '#6b7280', marginBottom: '2px',
  }))
  if (code) {
    const codeRow = mkEl('div', { display: 'flex', alignItems: 'center', gap: '5px' })
    codeRow.appendChild(mkTxt('Access Code:', { fontSize: '10px', color: '#374151' }))
    codeRow.appendChild(mkTxt(code, {
      fontSize: '19px', fontWeight: '800', color: GREEN,
      letterSpacing: '0.14em', fontFamily: 'monospace',
    }))
    ftxt.appendChild(codeRow)
  }
  footer.appendChild(ftxt)
  card.appendChild(footer)

  return card
}

// ─── Score table ─────────────────────────────────────────────────
function buildTable({ parPerHole, strokeIndex, players, tees }) {
  const tbl = mkEl('table', {
    width: '100%',
    borderCollapse: 'collapse',
    tableLayout: 'fixed',
    fontSize: '10px',
    fontFamily: 'Arial, Helvetica, sans-serif',
    flex: '1',
  })

  // ── Col widths ──────────────────────────────────────────────────
  const colgroup = document.createElement('colgroup')
  const colDefs = [
    { w: COL_LABEL },                      // label
    ...Array(9).fill({ w: COL_HOLE }),     // H1-9
    { w: COL_SUMM },                       // OUT
    { w: COL_INIT },                       // INIT
    ...Array(9).fill({ w: COL_HOLE }),     // H10-18
    { w: COL_SUMM },                       // IN
    { w: COL_SUMM },                       // TOT
    { w: COL_HCP  },                       // HCP
    { w: COL_NET  },                       // NET
  ]
  colDefs.forEach(c => {
    const col = document.createElement('col')
    col.style.width = c.w + 'px'
    colgroup.appendChild(col)
  })
  tbl.appendChild(colgroup)

  function mkCell(txt, opts = {}) {
    const {
      bg = '#ffffff', color = '#111827', bold = false,
      align = 'center', border = true, small = false,
    } = opts
    const td = document.createElement('td')
    td.style.cssText = `
      height: ${CELL_H}px;
      text-align: ${align};
      vertical-align: middle;
      background: ${bg};
      color: ${color};
      font-weight: ${bold ? '700' : '400'};
      font-size: ${small ? '8px' : '10px'};
      ${border ? `border: 1px solid ${BORDER};` : ''}
      padding: 0 2px;
      white-space: nowrap;
      overflow: hidden;
      box-sizing: border-box;
    `
    td.textContent = String(txt ?? '')
    return td
  }

  function mkLabelCell(txt, opts = {}) {
    const td = mkCell(txt, { bg: GRAY_BG, color: '#374151', bold: true, align: 'left', ...opts })
    td.style.paddingLeft = '5px'
    td.style.fontSize = '9px'
    return td
  }

  // ── Row: Hole numbers ────────────────────────────────────────────
  const holeRow = document.createElement('tr')
  holeRow.appendChild(mkLabelCell('Hole', { bg: GREEN, color: '#ffffff' }))
  for (let h = 1; h <= 9; h++) {
    holeRow.appendChild(mkCell(h, { bg: GREEN, color: '#ffffff', bold: true }))
  }
  holeRow.appendChild(mkCell('OUT', { bg: GOLD, color: '#1a1a1a', bold: true }))
  holeRow.appendChild(mkCell('INIT', { bg: GREEN, color: '#ffffff', bold: true, small: true }))
  for (let h = 10; h <= 18; h++) {
    holeRow.appendChild(mkCell(h, { bg: GREEN, color: '#ffffff', bold: true }))
  }
  holeRow.appendChild(mkCell('IN',  { bg: GOLD, color: '#1a1a1a', bold: true }))
  holeRow.appendChild(mkCell('TOT', { bg: GOLD, color: '#1a1a1a', bold: true }))
  holeRow.appendChild(mkCell('HCP', { bg: GREEN, color: '#ffffff', bold: true, small: true }))
  holeRow.appendChild(mkCell('NET', { bg: GREEN, color: '#ffffff', bold: true, small: true }))
  tbl.appendChild(holeRow)

  // ── Row: Par ─────────────────────────────────────────────────────
  const parRow = document.createElement('tr')
  parRow.appendChild(mkLabelCell('Par'))
  const frontPar = parPerHole.slice(0, 9).reduce((a, b) => a + b, 0)
  const backPar  = parPerHole.slice(9).reduce((a, b) => a + b, 0)
  for (let h = 1; h <= 9; h++) {
    parRow.appendChild(mkCell(parPerHole[h-1] ?? '', { bg: GRAY_BG, color: '#374151', bold: true }))
  }
  parRow.appendChild(mkCell(frontPar, { bg: '#e8e8e4', color: '#1a1a1a', bold: true }))
  parRow.appendChild(mkCell('',       { bg: GRAY_BG }))
  for (let h = 10; h <= 18; h++) {
    parRow.appendChild(mkCell(parPerHole[h-1] ?? '', { bg: GRAY_BG, color: '#374151', bold: true }))
  }
  parRow.appendChild(mkCell(backPar,           { bg: '#e8e8e4', color: '#1a1a1a', bold: true }))
  parRow.appendChild(mkCell(frontPar + backPar, { bg: '#e8e8e4', color: '#1a1a1a', bold: true }))
  parRow.appendChild(mkCell('', { bg: GRAY_BG }))
  parRow.appendChild(mkCell('', { bg: GRAY_BG }))
  tbl.appendChild(parRow)

  // ── Row: Stroke Index ────────────────────────────────────────────
  const siRow = document.createElement('tr')
  siRow.appendChild(mkLabelCell('S.I.'))
  for (let h = 1; h <= 9; h++) {
    siRow.appendChild(mkCell(strokeIndex[h-1] ?? '', { bg: '#f0f0ee', color: '#6b7280' }))
  }
  siRow.appendChild(mkCell('', { bg: '#f0f0ee' }))
  siRow.appendChild(mkCell('', { bg: '#f0f0ee' }))
  for (let h = 10; h <= 18; h++) {
    siRow.appendChild(mkCell(strokeIndex[h-1] ?? '', { bg: '#f0f0ee', color: '#6b7280' }))
  }
  siRow.appendChild(mkCell('', { bg: '#f0f0ee' }))
  siRow.appendChild(mkCell('', { bg: '#f0f0ee' }))
  siRow.appendChild(mkCell('', { bg: '#f0f0ee' }))
  siRow.appendChild(mkCell('', { bg: '#f0f0ee' }))
  tbl.appendChild(siRow)

  // ── Row: Tees ────────────────────────────────────────────────────
  const teesRow = document.createElement('tr')
  const teesLabel = mkLabelCell('Tees')
  teesRow.appendChild(teesLabel)
  // Span all remaining columns with tee info
  const teesTd = document.createElement('td')
  teesTd.colSpan = 24
  teesTd.style.cssText = `
    height: ${CELL_H}px;
    text-align: left;
    vertical-align: middle;
    background: ${GRAY_BG};
    color: #374151;
    font-size: 9px;
    font-weight: 600;
    border: 1px solid ${BORDER};
    padding: 0 6px;
    box-sizing: border-box;
  `
  teesTd.textContent = tees
  teesRow.appendChild(teesTd)
  tbl.appendChild(teesRow)

  // ── Player rows ──────────────────────────────────────────────────
  const slots = [...players]
  while (slots.length < 4) slots.push(null)

  slots.slice(0, 4).forEach((ep, i) => {
    const firstName = ep?.player?.first_name ?? ''
    const lastName  = ep?.player?.last_name  ?? ''
    const flight    = ep?.flight ?? null
    const ch        = ep?.course_handicap ?? null
    const isGuest   = ep?.is_guest

    // "F. Last (A)" or "F. Last" or "Player N"
    let nameLabel = ''
    if (ep) {
      const abbr = firstName ? `${firstName[0]}. ${lastName}` : lastName
      nameLabel = flight && !isGuest ? `${abbr} (${flight})` : abbr
    } else {
      nameLabel = `Player ${i + 1}`
    }

    // Initials: first letter of first + first letter of last
    const initials = ep
      ? `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase()
      : ''

    const rowBg    = ep ? '#ffffff' : '#fafafa'
    const nameColor = ep ? '#111827' : '#b0b0b0'

    const tr = document.createElement('tr')
    const labelTd = mkLabelCell(nameLabel, { bg: rowBg, color: nameColor })
    labelTd.style.fontSize = '9px'
    tr.appendChild(labelTd)

    // Holes 1-9 (empty score boxes)
    for (let h = 1; h <= 9; h++) {
      tr.appendChild(mkCell('', { bg: rowBg }))
    }
    // OUT summary (empty)
    tr.appendChild(mkCell('', { bg: '#f5f5f3' }))
    // INIT
    tr.appendChild(mkCell(initials, { bg: '#eef4ee', color: GREEN, bold: true, small: true }))
    // Holes 10-18 (empty score boxes)
    for (let h = 10; h <= 18; h++) {
      tr.appendChild(mkCell('', { bg: rowBg }))
    }
    // IN summary (empty)
    tr.appendChild(mkCell('', { bg: '#f5f5f3' }))
    // TOT (empty)
    tr.appendChild(mkCell('', { bg: '#f5f5f3' }))
    // HCP
    tr.appendChild(mkCell(ch !== null ? ch : '', { bg: '#eef4ee', color: GREEN, bold: true }))
    // NET (empty)
    tr.appendChild(mkCell('', { bg: '#f0f8f0' }))

    tbl.appendChild(tr)
  })

  return tbl
}

// ─── Helpers ─────────────────────────────────────────────────────
function mkEl(tag, styles = {}) {
  const e = document.createElement(tag)
  Object.assign(e.style, styles)
  return e
}

function mkTxt(content, styles = {}) {
  const s = document.createElement('span')
  Object.assign(s.style, styles)
  s.textContent = content
  return s
}
