/**
 * ScorecardExport — Landscape 11"×8.5" PNG, two cards stacked per page.
 *
 * Column layout (balanced so INIT is the exact center fold line):
 *   LEFT HALF:  Label(138) | H1-9(9×36) | OUT(42)       = 504px
 *   FOLD:       INIT(56)                                  =  56px
 *   RIGHT HALF: H10-18(9×36) | IN(42) | TOT(42) | HCP(32) | NET(32) | PUTTS(32) = 504px
 *   TOTAL:      1064px
 *
 * Rows: Hole · Tee×N (yardage) · Par · S.I. · Player×4
 */

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'

// ─── Layout constants ─────────────────────────────────────────────
const PAGE_W    = 1100
const PAGE_H    = 850
const PAD       = 18
const GAP       = 10
const CARD_W    = PAGE_W - PAD * 2   // 1064
const CARD_H    = Math.floor((PAGE_H - PAD * 2 - GAP) / 2)

// Column widths — left and right halves are exactly equal (504px each)
const COL_LABEL = 138
const COL_HOLE  = 36
const COL_SUMM  = 42   // OUT / IN / TOT
const COL_INIT  = 56   // fold indicator
const COL_HCP   = 32
const COL_NET   = 32
const COL_PUTTS = 32

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
  const logoUrl       = `${window.location.origin}/logo.png`

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

        const pageEl = buildPage({ event, course, groupNum: g, players, code, qrDataUrl, logoUrl })
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
function buildPage({ event, course, groupNum, players, code, qrDataUrl, logoUrl }) {
  const page = el('div', {
    width: PAGE_W + 'px', height: PAGE_H + 'px',
    background: '#ffffff',
    display: 'flex', flexDirection: 'column',
    gap: GAP + 'px',
    padding: PAD + 'px',
    boxSizing: 'border-box',
    fontFamily: 'Arial, Helvetica, sans-serif',
  })
  const opts = { event, course, groupNum, players, code, qrDataUrl, logoUrl }
  page.appendChild(buildCard(opts))
  page.appendChild(buildCard(opts))
  return page
}

// ─── Card ─────────────────────────────────────────────────────────
function buildCard({ event, course, groupNum, players, code, qrDataUrl, logoUrl }) {
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
  const groupTees = courseTees.filter(t => playerTeeNames.includes(t.name))
  // Fall back: if no tee assignments, show all course tees
  const teesToShow = groupTees.length > 0 ? groupTees : courseTees

  // Flight + tee label for header (e.g. "Flight A · Blue Tees")
  const flights    = [...new Set(players.map(p => p.flight).filter(Boolean))].sort()
  const teeNames   = [...new Set(players.map(p => p.tee).filter(Boolean))]
  const flightStr  = flights.length > 0 ? `Flight ${flights.join('/')}` : ''
  const teeStr     = teeNames.length > 0 ? `${teeNames.join('/')} Tees` : ''
  const subBadge   = [flightStr, teeStr].filter(Boolean).join(' · ')

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
    gap: '8px',
  })

  // Logo
  const logo = document.createElement('img')
  logo.src = logoUrl
  logo.style.cssText = 'height: 42px; width: auto; objectFit: contain; flexShrink: 0;'
  header.appendChild(logo)

  // Center text
  const hCenter = el('div', { flex: '1', padding: '0 6px' })
  hCenter.appendChild(txt('Mulligan\'s Island Golf Club', {
    display: 'block', color: GOLD,
    fontSize: '13px', fontWeight: '700', letterSpacing: '0.02em',
  }))
  hCenter.appendChild(txt(event.name ?? `Event #${event.event_number}`, {
    display: 'block', color: '#ffffff', fontSize: '10px', marginTop: '1px',
  }))
  hCenter.appendChild(txt(`${course.name ?? ''} · ${eventDate}`, {
    display: 'block', color: 'rgba(255,255,255,0.6)', fontSize: '9px', marginTop: '1px',
  }))
  header.appendChild(hCenter)

  // Right: sub-badge + group badge
  const hRight = el('div', { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' })
  if (subBadge) {
    hRight.appendChild(txt(subBadge, {
      color: 'rgba(255,255,255,0.8)', fontSize: '9px', fontWeight: '600',
      whiteSpace: 'nowrap',
    }))
  }
  const groupBadge = el('div', {
    background: GOLD, color: '#1a1a1a',
    fontWeight: '800', fontSize: '16px',
    borderRadius: '5px', padding: '2px 10px',
    whiteSpace: 'nowrap',
  })
  groupBadge.textContent = `Group ${groupNum}`
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

  // Colgroup
  const cg = document.createElement('colgroup')
  const colDefs = [
    COL_LABEL,
    ...Array(9).fill(COL_HOLE),
    COL_SUMM,
    COL_INIT,
    ...Array(9).fill(COL_HOLE),
    COL_SUMM, COL_SUMM,
    COL_HCP, COL_NET, COL_PUTTS,
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
      leftBorder = null, rightBorder = null,
    } = opts
    const td = document.createElement('td')
    const borderStr = `1px solid ${BORDER}`
    td.style.cssText = `
      height: ${CELL_H}px;
      text-align: ${align};
      vertical-align: middle;
      background: ${bg};
      color: ${color};
      font-weight: ${bold ? '700' : '400'};
      font-size: ${fontSize};
      border: ${border ? borderStr : 'none'};
      ${leftBorder  ? `border-left:  ${leftBorder};`  : ''}
      ${rightBorder ? `border-right: ${rightBorder};` : ''}
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

  // INIT fold-line cell
  function mkInitCell(content, opts = {}) {
    return mkTd(content, {
      bg: '#e8f0e8', color: GREEN, bold: true, fontSize: '9px',
      leftBorder:  '2px dashed #aacaaa',
      rightBorder: '2px dashed #aacaaa',
      ...opts,
    })
  }

  // ── Helper: build a full row ─────────────────────────────────────
  function addRow(rowDef) {
    const {
      label, labelBg = GRAY_BG, labelColor = '#374151',
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
    tr.appendChild(mkLabel(label, { bg: labelBg, color: labelColor }))

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
      labelBg: teeBg, labelColor: '#1a1a1a',
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

    addRow({
      label: nameLabel,
      labelBg: 'transparent', labelColor: ep ? '#111827' : '#b0b0b0',
      h1to9:   Array(9).fill(''),
      out:     '',
      initCell: initials,
      h10to18: Array(9).fill(''),
      inVal: '', tot: '',
      hcp:   ch !== null ? ch : '',
      net:   '', putts: '',
      holeBg: 'transparent',
      summBg: 'transparent', summColor: '#374151',
    })
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

/** Convert hex color to rgba with given alpha (0-1) */
function hexWithAlpha(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}
