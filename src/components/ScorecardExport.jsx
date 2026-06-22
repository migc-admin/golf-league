/**
 * ScorecardExport
 *
 * Renders a hidden scorecard layout (2 identical cards per group, side-by-side)
 * and exports each group as a PNG using html-to-image.
 *
 * Layout per page:
 *   ┌───────────────────┬───────────────────┐
 *   │   Scorecard (1)   │   Scorecard (2)   │
 *   └───────────────────┴───────────────────┘
 *
 * Each card contains:
 *   - Header: club logo area, event name, date, course
 *   - Group number + player names
 *   - 18-hole grid: Hole / Par / SI / player columns (F9 + OUT, B9 + IN + TOT)
 *   - Footer: QR code + Access Code
 */

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import QRCode from 'qrcode'

// ─── Main Export Button ───────────────────────────────────────────
export function ExportScorecardsButton({ event, eventPlayers, course }) {
  const [exporting, setExporting] = useState(false)
  const containerRef = useRef(null)

  const groupNums = [...new Set(
    eventPlayers.map(ep => ep.group_number).filter(Boolean)
  )].sort((a, b) => a - b)

  const groupCodes = event.group_codes ?? {}
  const scorecardBase = `${window.location.origin}/scorecard/${event.id}`

  async function handleExport() {
    if (!course || groupNums.length === 0) return
    setExporting(true)

    try {
      for (const g of groupNums) {
        const players = eventPlayers
          .filter(ep => ep.group_number === g && !ep.is_guest)
          .sort((a, b) => (a.group_order ?? 0) - (b.group_order ?? 0))

        const code  = groupCodes[g] ?? ''
        const qrUrl = code
          ? `${scorecardBase}?code=${code}`
          : scorecardBase

        // Build QR data URL
        const qrDataUrl = await QRCode.toDataURL(qrUrl, {
          width: 160,
          margin: 1,
          color: { dark: '#1B4332', light: '#ffffff' },
        })

        // Render the page node
        const node = containerRef.current
        if (!node) continue

        // Inject props via dataset so we can read them inside the render helper
        node.innerHTML = ''
        const pageEl = renderPageToDOM({ event, course, groupNum: g, players, code, qrDataUrl })
        node.appendChild(pageEl)

        // Wait for fonts/images
        await new Promise(r => setTimeout(r, 80))

        const dataUrl = await toPng(pageEl, {
          pixelRatio: 3,
          cacheBust: true,
          backgroundColor: '#ffffff',
        })

        const link = document.createElement('a')
        link.download = `scorecard-group-${g}.png`
        link.href = dataUrl
        link.click()

        // Small gap between downloads
        await new Promise(r => setTimeout(r, 200))
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
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 14px',
          borderRadius: 8,
          border: '1px solid #d1d5db',
          background: exporting ? '#f3f4f6' : '#ffffff',
          color: '#374151',
          fontSize: 13,
          fontWeight: 600,
          cursor: exporting || groupNums.length === 0 ? 'not-allowed' : 'pointer',
          opacity: groupNums.length === 0 ? 0.5 : 1,
        }}
      >
        {exporting ? '⏳ Exporting…' : '🖨 Export Scorecards'}
      </button>
      {/* Hidden render container — positioned off-screen */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: -99999,
          left: -99999,
          pointerEvents: 'none',
          zIndex: -1,
        }}
      />
    </>
  )
}

// ─── DOM Builder (no React, plain DOM so html-to-image captures cleanly) ─────
function renderPageToDOM({ event, course, groupNum, players, code, qrDataUrl }) {
  const parPerHole    = course.par_per_hole    ?? []
  const strokeIndex   = course.stroke_index    ?? []
  const frontPar      = parPerHole.slice(0, 9).reduce((a, b) => a + b, 0)
  const backPar       = parPerHole.slice(9).reduce((a, b) => a + b, 0)
  const totalPar      = frontPar + backPar

  const eventDate = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      })
    : ''

  // ── Styles ──────────────────────────────────────────────────────
  const PAGE_W   = 1400   // px — two cards side by side
  const CARD_W   = 660
  const GOLD     = '#C9A84C'
  const GREEN    = '#1B4332'
  const GRAY_BG  = '#f8f8f6'
  const BORDER   = '#d1d5db'
  const CELL_H   = 28

  function el(tag, styles = {}, attrs = {}) {
    const e = document.createElement(tag)
    Object.assign(e.style, styles)
    Object.entries(attrs).forEach(([k, v]) => { e[k] = v })
    return e
  }

  function text(content, styles = {}) {
    const span = el('span', styles)
    span.textContent = content
    return span
  }

  // ── Single scorecard card ────────────────────────────────────────
  function buildCard() {
    const card = el('div', {
      width: CARD_W + 'px',
      background: '#ffffff',
      border: '2px solid ' + GREEN,
      borderRadius: '8px',
      overflow: 'hidden',
      fontFamily: '"Arial", "Helvetica Neue", sans-serif',
      boxSizing: 'border-box',
    })

    // Header
    const header = el('div', {
      background: GREEN,
      padding: '10px 14px 8px',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    })
    const headerLeft = el('div')
    headerLeft.appendChild(text("Mulligan's Island Golf Club", {
      display: 'block',
      color: GOLD,
      fontSize: '15px',
      fontWeight: '700',
      letterSpacing: '0.02em',
    }))
    headerLeft.appendChild(text(event.name ?? `Event #${event.event_number}`, {
      display: 'block',
      color: '#ffffff',
      fontSize: '12px',
      marginTop: '2px',
    }))
    headerLeft.appendChild(text(`${course.name ?? ''} · ${eventDate}`, {
      display: 'block',
      color: 'rgba(255,255,255,0.65)',
      fontSize: '10px',
      marginTop: '2px',
    }))
    header.appendChild(headerLeft)

    const groupBadge = el('div', {
      background: GOLD,
      color: '#1a1a1a',
      fontWeight: '800',
      fontSize: '18px',
      borderRadius: '6px',
      padding: '4px 10px',
      whiteSpace: 'nowrap',
      alignSelf: 'center',
    })
    groupBadge.textContent = `Group ${groupNum}`
    header.appendChild(groupBadge)
    card.appendChild(header)

    // Players row
    const playersBar = el('div', {
      background: GRAY_BG,
      borderBottom: '1px solid ' + BORDER,
      padding: '6px 14px',
      display: 'flex',
      flexWrap: 'wrap',
      gap: '4px 16px',
    })
    players.forEach((ep, i) => {
      const name = `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim()
      const chip = el('span', {
        fontSize: '11px',
        color: '#1f2937',
        fontWeight: '600',
      })
      chip.textContent = `${i + 1}. ${name}`
      playersBar.appendChild(chip)
    })
    // Fill empty player slots up to 4
    for (let i = players.length; i < 4; i++) {
      const chip = el('span', {
        fontSize: '11px',
        color: '#9ca3af',
        fontWeight: '400',
      })
      chip.textContent = `${i + 1}. ___________________`
      playersBar.appendChild(chip)
    }
    card.appendChild(playersBar)

    // Score table
    card.appendChild(buildScoreTable(parPerHole, strokeIndex, players, frontPar, backPar, totalPar, CELL_H, BORDER, GREEN, GOLD, GRAY_BG))

    // Footer: QR + code
    const footer = el('div', {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '8px 14px',
      background: GRAY_BG,
      borderTop: '2px solid ' + GREEN,
    })

    if (qrDataUrl) {
      const qrImg = el('img', { width: '72px', height: '72px', flexShrink: '0' })
      qrImg.src = qrDataUrl
      footer.appendChild(qrImg)
    }

    const footerText = el('div')
    footerText.appendChild(text('Scan to enter scores', {
      display: 'block',
      fontSize: '10px',
      color: '#6b7280',
      marginBottom: '2px',
    }))
    if (code) {
      const codeRow = el('div', { display: 'flex', alignItems: 'center', gap: '6px' })
      codeRow.appendChild(text('Access Code:', {
        fontSize: '11px',
        color: '#374151',
      }))
      codeRow.appendChild(text(code, {
        fontSize: '20px',
        fontWeight: '800',
        color: GREEN,
        letterSpacing: '0.12em',
        fontFamily: 'monospace',
      }))
      footerText.appendChild(codeRow)
    } else {
      footerText.appendChild(text('No code set — generate codes in Scoring Access', {
        fontSize: '10px',
        color: '#9ca3af',
        fontStyle: 'italic',
      }))
    }

    footer.appendChild(footerText)
    card.appendChild(footer)

    return card
  }

  // ── Page wrapper: two cards side by side ─────────────────────────
  const page = el('div', {
    width: PAGE_W + 'px',
    display: 'flex',
    gap: '16px',
    padding: '20px',
    background: '#ffffff',
    boxSizing: 'border-box',
  })
  page.appendChild(buildCard())
  page.appendChild(buildCard())
  return page
}

// ─── Score Table ─────────────────────────────────────────────────
function buildScoreTable(parPerHole, strokeIndex, players, frontPar, backPar, totalPar, CELL_H, BORDER, GREEN, GOLD, GRAY_BG) {
  const wrap = document.createElement('div')
  wrap.style.cssText = `overflow:hidden; border-bottom: 1px solid ${BORDER};`

  // Columns: label | 1-9 | OUT | 10-18 | IN | TOT = 1 + 9 + 1 + 9 + 1 + 1 = 22
  const LABEL_W = 56   // px
  const CARD_INNER = 632  // card width minus border/padding
  const EXTRA_COLS = 3  // OUT + IN + TOT
  const cellW = Math.floor((CARD_INNER - LABEL_W) / (18 + EXTRA_COLS))

  const tbl = document.createElement('table')
  tbl.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    font-size: 10px;
    font-family: Arial, Helvetica, sans-serif;
  `

  function cell(txt, { bg = '#ffffff', color = '#111827', bold = false, w = cellW } = {}) {
    const td = document.createElement('td')
    td.style.cssText = `
      height: ${CELL_H}px;
      width: ${w}px;
      text-align: center;
      vertical-align: middle;
      background: ${bg};
      color: ${color};
      font-weight: ${bold ? '700' : '400'};
      border: 1px solid ${BORDER};
      padding: 0;
      white-space: nowrap;
      overflow: hidden;
      box-sizing: border-box;
    `
    td.textContent = txt
    return td
  }

  function labelCell(txt, { bg = GRAY_BG, color = '#374151' } = {}) {
    const td = cell(txt, { bg, color, bold: true, w: LABEL_W })
    td.style.textAlign = 'left'
    td.style.paddingLeft = '5px'
    td.style.fontSize = '9px'
    return td
  }

  function addRow({ label, labelBg = GRAY_BG, labelColor = '#374151', values, valueBg = '#ffffff', valueColor = '#111827', valueBold = false, summaryBg = GRAY_BG, summaryColor = '#374151' }) {
    const tr = document.createElement('tr')
    tr.appendChild(labelCell(label, { bg: labelBg, color: labelColor }))

    // Holes 1–9
    for (let h = 1; h <= 9; h++) {
      const v = values[h - 1]
      tr.appendChild(cell(v != null ? String(v) : '', { bg: valueBg, color: valueColor, bold: valueBold }))
    }
    // OUT
    const outVal = values.slice(0, 9).reduce((s, v) => s + (Number(v) || 0), 0)
    tr.appendChild(cell(outVal || '', { bg: summaryBg, color: summaryColor, bold: true }))

    // Holes 10–18
    for (let h = 10; h <= 18; h++) {
      const v = values[h - 1]
      tr.appendChild(cell(v != null ? String(v) : '', { bg: valueBg, color: valueColor, bold: valueBold }))
    }
    // IN
    const inVal = values.slice(9, 18).reduce((s, v) => s + (Number(v) || 0), 0)
    tr.appendChild(cell(inVal || '', { bg: summaryBg, color: summaryColor, bold: true }))

    // TOT
    const tot = outVal + inVal
    tr.appendChild(cell(tot || '', { bg: summaryBg, color: summaryColor, bold: true }))

    tbl.appendChild(tr)
  }

  // Hole numbers row
  addRow({
    label: 'Hole',
    labelBg: GREEN, labelColor: '#ffffff',
    values: Array.from({ length: 18 }, (_, i) => i + 1),
    valueBg: GREEN, valueColor: '#ffffff', valueBold: true,
    summaryBg: GOLD, summaryColor: '#1a1a1a',
  })

  // Par row
  addRow({
    label: 'Par',
    values: parPerHole,
    valueBg: GRAY_BG, valueColor: '#374151',
    summaryBg: GRAY_BG,
  })

  // Stroke Index row
  addRow({
    label: 'Stroke Idx',
    values: strokeIndex,
    valueBg: '#f0f0f0', valueColor: '#6b7280',
    summaryBg: '#f0f0f0', summaryColor: '#9ca3af',
  })

  // Player score rows (up to 4)
  const allPlayers = [...players]
  while (allPlayers.length < 4) allPlayers.push(null)

  allPlayers.slice(0, 4).forEach((ep, i) => {
    const name = ep?.player
      ? `${ep.player.first_name?.[0] ?? ''}. ${ep.player.last_name ?? ''}`
      : `Player ${i + 1}`
    const nameColor = ep ? '#111827' : '#9ca3af'
    addRow({
      label: name,
      labelBg: '#ffffff', labelColor: nameColor,
      values: new Array(18).fill(null),
      valueBg: '#ffffff', valueColor: '#111827',
      summaryBg: GRAY_BG,
    })
  })

  wrap.appendChild(tbl)
  return wrap
}
