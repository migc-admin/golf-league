/**
 * Excel export of every wager placed on an event, for tracking who has paid and
 * who is owed what.
 *
 * Sheets
 *   Summary    — event info and money totals (live formulas)
 *   All Bets   — one row per bet, including removed bets; you fill in "Payment
 *                Received?" and "Payout Sent?" (Yes/No) as money moves
 *   By Bettor  — one row per bettor: staked, collected, still to collect, payout
 *                owed, payout sent, still to pay out (live formulas off All Bets)
 *   Pools      — WIN, PLACE and each match: money in, payouts, what the club keeps
 *
 * Totals are Excel formulas, so they update as you mark rows in "All Bets".
 * Cached values are also written so previews that do not recalculate still show numbers.
 *
 * ExcelJS is passed in (loaded lazily by the caller) so this file stays testable.
 */

const GREEN = 'FF1B4332'
const GOLD  = 'FFC9A84C'
const MONEY = '$#,##0.00'
const WHEN  = 'm/d/yyyy h:mm AM/PM'

const typeOf = w => (w.match_pairing_id ? 'MATCH' : w.pick_1st ? 'WIN' : 'PLACE')
const money  = n => Math.round(n * 100) / 100
const cap    = s => (s ? s[0].toUpperCase() + s.slice(1) : '')

// Excel stores date-times without a timezone. ExcelJS writes the UTC clock reading,
// so shift the local clock reading into UTC fields to make Excel show the viewer's local time.
const localForExcel = d => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()))

function styleHeader(row) {
  row.eachCell(c => {
    c.font = { bold: true, color: { argb: GOLD } }
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } }
    c.alignment = { vertical: 'middle', wrapText: true }
  })
  row.height = 22
}

/**
 * @param {Object}   ExcelJS     the exceljs module
 * @param {Object}   d
 * @param {Object}   d.event     { name, event_date, status }
 * @param {Array}    d.wagers    every wager row for the event (including removed)
 * @param {Array}    d.pairings  match_pairings rows
 * @param {Function} d.nameOf    player id -> "First Last"
 * @param {Object}   d.outcomes  wager id -> { result, payout, provisional } (active bets only)
 * @param {Object}   d.settlement  result of computeWagerSettlement (for pool notes)
 * @param {Date}     [d.exportedAt]
 */
export function buildWagerWorkbook(ExcelJS, d) {
  const { event, pairings, nameOf, outcomes, settlement } = d
  const exportedAt = d.exportedAt ?? new Date()
  const final = event.status === 'complete'
  const matchById = Object.fromEntries(pairings.map(m => [m.id, m]))
  const matchLabel = id => {
    const m = matchById[id]
    return m ? `Match ${m.match_number}: ${nameOf(m.player_a_id)} vs ${nameOf(m.player_b_id)}` : ''
  }

  // ── Rows for "All Bets" ──────────────────────────────────────────────────
  const wagers = [...d.wagers].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const displayName = new Map() // lowercase trimmed name -> first spelling seen
  const bettorName = raw => {
    const trimmed = raw.trim().replace(/\s+/g, ' ')
    const key = trimmed.toLowerCase()
    if (!displayName.has(key)) displayName.set(key, trimmed)
    return displayName.get(key)
  }
  const rows = wagers.map((w, i) => {
    const removed = !!w.deleted_at
    const o = removed ? null : outcomes[w.id]
    return {
      n: i + 1,
      placed: localForExcel(new Date(w.created_at)),
      bettor: bettorName(w.bettor_name),
      type: typeOf(w),
      selection: nameOf(w.pick_match ?? w.pick_1st ?? w.pick_2nd),
      match: w.match_pairing_id ? matchLabel(w.match_pairing_id) : '',
      amount: money(parseFloat(w.amount)),
      method: w.payment_method ? cap(w.payment_method) : '',
      received: '',
      result: removed ? 'Removed' : o ? `${o.result}${o.provisional ? ' (provisional)' : ''}` : 'Pending',
      payout: removed || !o ? 0 : money(o.payout),
      sent: '',
      status: removed ? 'Removed' : 'Active',
      notes: '',
    }
  })
  const active = rows.filter(r => r.status === 'Active')
  const last = Math.max(rows.length + 1, 2)
  const R = col => `'All Bets'!$${col}$2:$${col}$${last}`
  const sum = (filter, field) => money(active.filter(filter).reduce((s, r) => s + r[field], 0))

  const wb = new ExcelJS.Workbook()
  wb.creator = 'Scorify Golf'
  wb.created = exportedAt

  // ── Summary ──────────────────────────────────────────────────────────────
  const sm = wb.addWorksheet('Summary')
  sm.columns = [{ width: 34 }, { width: 22 }, { width: 60 }]
  const dateText = event.event_date
    ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    : ''
  const title = sm.addRow([`${event.name ?? 'Event'} — Wagers`])
  title.font = { bold: true, size: 14, color: { argb: GREEN } }
  sm.addRow(['Event date', dateText])
  sm.addRow(['Event status', cap(event.status ?? '')])
  sm.addRow(['Exported', localForExcel(exportedAt)]).getCell(2).numFmt = WHEN
  if (!final) {
    const w = sm.addRow(['Note', 'Event is not complete: WIN and PLACE results are provisional and can still change.'])
    w.getCell(2).font = { italic: true, color: { argb: 'FFB45309' } }
  }
  sm.addRow([])
  styleHeader(sm.addRow(['Money', 'Amount', 'How it is calculated']))
  const top = sm.rowCount            // header row; first money row is top + 1
  const at = k => `B${top + k}`      // k-th money row (1-based)
  const staked = sum(() => true, 'amount')
  const owedAll = sum(() => true, 'payout')
  const totals = [
    ['Bets (active)', { formula: `COUNTIFS(${R('M')},"Active")`, result: active.length }, 'Removed bets are excluded from every total', '0'],
    ['Total staked', { formula: `SUMIFS(${R('G')},${R('M')},"Active")`, result: staked }, 'All active bets', MONEY],
    ['Collected so far', { formula: `SUMIFS(${R('G')},${R('M')},"Active",${R('I')},"Yes")`, result: 0 }, 'Bets where "Payment Received?" = Yes', MONEY],
    ['Still to collect', { formula: `${at(2)}-${at(3)}`, result: staked }, 'Total staked minus collected', MONEY],
    ['Payouts owed to bettors', { formula: `SUMIFS(${R('K')},${R('M')},"Active")`, result: owedAll }, final ? 'From final results' : 'Provisional until the event is complete', MONEY],
    ['Payouts sent', { formula: `SUMIFS(${R('K')},${R('M')},"Active",${R('L')},"Yes")`, result: 0 }, 'Bets where "Payout Sent?" = Yes', MONEY],
    ['Payouts still to send', { formula: `${at(5)}-${at(6)}`, result: owedAll }, 'Payouts owed minus sent', MONEY],
    ['Club keeps', { formula: `${at(2)}-${at(5)}`, result: money(staked - owedAll) }, 'Total staked minus payouts owed (unclaimed pools and rounding). Only meaningful once results are final', MONEY],
  ]
  for (const [label, value, how, fmt] of totals) {
    const r = sm.addRow([label, value, how])
    r.getCell(2).numFmt = fmt
    r.getCell(3).font = { color: { argb: 'FF6B7280' } }
  }

  // ── All Bets ─────────────────────────────────────────────────────────────
  const ab = wb.addWorksheet('All Bets', { views: [{ state: 'frozen', ySplit: 1 }] })
  ab.columns = [
    { header: '#',                    key: 'n',        width: 5 },
    { header: 'Placed',               key: 'placed',   width: 19 },
    { header: 'Bettor',               key: 'bettor',   width: 22 },
    { header: 'Bet Type',             key: 'type',     width: 10 },
    { header: 'Selection',            key: 'selection',width: 22 },
    { header: 'Match',                key: 'match',    width: 34 },
    { header: 'Amount',               key: 'amount',   width: 11 },
    { header: 'Payment Method',       key: 'method',   width: 15 },
    { header: 'Payment Received?',    key: 'received', width: 18 },
    { header: 'Result',               key: 'result',   width: 20 },
    { header: 'Payout Owed',          key: 'payout',   width: 13 },
    { header: 'Payout Sent?',         key: 'sent',     width: 14 },
    { header: 'Status',               key: 'status',   width: 10 },
    { header: 'Notes',                key: 'notes',    width: 30 },
  ]
  styleHeader(ab.getRow(1))
  rows.forEach(r => {
    const row = ab.addRow(r)
    row.getCell('placed').numFmt = WHEN
    row.getCell('amount').numFmt = MONEY
    row.getCell('payout').numFmt = MONEY
    row.getCell('received').dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] }
    row.getCell('sent').dataValidation = { type: 'list', allowBlank: true, formulae: ['"Yes,No"'] }
    if (r.status === 'Removed') row.font = { color: { argb: 'FF9CA3AF' }, italic: true }
    else if (r.method === '') row.getCell('method').font = { color: { argb: 'FF9CA3AF' } }
  })
  ab.autoFilter = { from: 'A1', to: `N${last}` }

  // ── By Bettor ────────────────────────────────────────────────────────────
  const bb = wb.addWorksheet('By Bettor', { views: [{ state: 'frozen', ySplit: 1 }] })
  bb.columns = [
    { header: 'Bettor',              width: 24 },
    { header: 'Bets',                width: 7 },
    { header: 'Total Staked',        width: 14 },
    { header: 'Venmo',               width: 12 },
    { header: 'Cash',                width: 12 },
    { header: 'Method Not Set',      width: 15 },
    { header: 'Collected',           width: 13 },
    { header: 'Still to Collect',    width: 15 },
    { header: 'Payout Owed',         width: 13 },
    { header: 'Payout Sent',         width: 13 },
    { header: 'Still to Pay Out',    width: 15 },
    { header: 'Net (Payout - Stake)', width: 18 },
    { header: 'Notes',               width: 28 },
  ]
  styleHeader(bb.getRow(1))
  const bettors = [...new Set(active.map(r => r.bettor))].sort((a, b) => a.localeCompare(b))
  const colTotals = { count: 0, staked: 0, venmo: 0, cash: 0, unset: 0, owed: 0 }
  bettors.forEach((name, i) => {
    const n = i + 2
    const mine = r => r.bettor.toLowerCase() === name.toLowerCase()
    const staked = sum(mine, 'amount')
    const byMethod = m => money(active.filter(r => mine(r) && r.method === m).reduce((s, r) => s + r.amount, 0))
    const owed = sum(mine, 'payout')
    colTotals.count += active.filter(mine).length
    colTotals.staked += staked; colTotals.venmo += byMethod('Venmo'); colTotals.cash += byMethod('Cash')
    colTotals.unset += money(staked - byMethod('Venmo') - byMethod('Cash')); colTotals.owed += owed
    const cond = `${R('C')},$A${n},${R('M')},"Active"`
    const row = bb.addRow([
      name,
      { formula: `COUNTIFS(${cond})`, result: active.filter(mine).length },
      { formula: `SUMIFS(${R('G')},${cond})`, result: staked },
      { formula: `SUMIFS(${R('G')},${cond},${R('H')},"Venmo")`, result: byMethod('Venmo') },
      { formula: `SUMIFS(${R('G')},${cond},${R('H')},"Cash")`, result: byMethod('Cash') },
      { formula: `C${n}-D${n}-E${n}`, result: money(staked - byMethod('Venmo') - byMethod('Cash')) },
      { formula: `SUMIFS(${R('G')},${cond},${R('I')},"Yes")`, result: 0 },
      { formula: `C${n}-G${n}`, result: staked },
      { formula: `SUMIFS(${R('K')},${cond})`, result: owed },
      { formula: `SUMIFS(${R('K')},${cond},${R('L')},"Yes")`, result: 0 },
      { formula: `I${n}-J${n}`, result: owed },
      { formula: `I${n}-C${n}`, result: money(owed - staked) },
      '',
    ])
    for (let c = 3; c <= 12; c++) row.getCell(c).numFmt = MONEY
  })
  const lastB = bettors.length + 1
  if (bettors.length) {
    const tot = bb.addRow([
      'TOTAL',
      { formula: `SUM(B2:B${lastB})`, result: colTotals.count },
      ...[
        ['C', colTotals.staked], ['D', colTotals.venmo], ['E', colTotals.cash], ['F', colTotals.unset],
        ['G', 0], ['H', colTotals.staked], ['I', colTotals.owed], ['J', 0], ['K', colTotals.owed],
        ['L', colTotals.owed - colTotals.staked],
      ].map(([col, result]) => ({ formula: `SUM(${col}2:${col}${lastB})`, result: money(result) })),
    ])
    tot.font = { bold: true }
    for (let c = 3; c <= 12; c++) tot.getCell(c).numFmt = MONEY
    tot.eachCell(c => { c.border = { top: { style: 'thin' } } })
  }

  // ── Pools ────────────────────────────────────────────────────────────────
  const pl = wb.addWorksheet('Pools', { views: [{ state: 'frozen', ySplit: 1 }] })
  pl.columns = [
    { header: 'Pool',          width: 40 },
    { header: 'Bets',          width: 7 },
    { header: 'Money In',      width: 13 },
    { header: 'Payouts Owed',  width: 14 },
    { header: 'Club Keeps (once final)', width: 16 },
    { header: 'Result',        width: 70 },
  ]
  styleHeader(pl.getRow(1))
  const poolRow = (label, typeCrit, matchCrit, filter, note) => {
    const n = pl.rowCount + 1
    const crit = `${R('D')},"${typeCrit}",${R('M')},"Active"${matchCrit ? `,${R('F')},"${matchCrit.replace(/"/g, '""')}"` : ''}`
    const sel = filter
    const row = pl.addRow([
      label,
      { formula: `COUNTIFS(${crit})`, result: active.filter(sel).length },
      { formula: `SUMIFS(${R('G')},${crit})`, result: sum(sel, 'amount') },
      { formula: `SUMIFS(${R('K')},${crit})`, result: sum(sel, 'payout') },
      { formula: `C${n}-D${n}`, result: money(sum(sel, 'amount') - sum(sel, 'payout')) },
      note,
    ])
    for (let c = 3; c <= 5; c++) row.getCell(c).numFmt = MONEY
    row.getCell(6).alignment = { wrapText: true, vertical: 'top' }
  }
  const { winResults, placeResults, matchCards } = settlement
  const prov = final ? '' : ' (provisional)'
  const winNote = !winResults ? 'No scores yet'
    : winResults.matched ? `1st place net ${winResults.net}${prov}`
    : `1st place net ${winResults.net}: nobody bet on ${winResults.topPlayers.map(nameOf).join(', ')}, so the pool rolls to the club${prov}`
  const placeNote = !placeResults ? 'No scores yet'
    : !placeResults.matched ? `Nobody bet on ${placeResults.topPlayers.map(nameOf).join(', ')}, so the pool rolls to the club${prov}`
    : `1st net ${placeResults.net}${placeResults.twoWayTie ? ' (tied for 1st)' : `, 2nd net ${placeResults.net2}`}${placeResults.halfRollsToClub ? '; half of the profit rolls to the club' : ''}${prov}`
  poolRow('WIN', 'WIN', null, r => r.type === 'WIN', winNote)
  poolRow('PLACE', 'PLACE', null, r => r.type === 'PLACE', placeNote)
  for (const c of matchCards) {
    if (c.bets.length === 0) continue
    const label = matchLabel(c.match.id)
    const status = c.result ? c.result.matchStatus : 'Not started'
    const outcome = !c.settlement ? `${status} (in progress)`
      : c.settlement.type === 'refund' ? `${status}: match halved, all stakes refunded`
      : c.settlement.type === 'club' ? `${nameOf(c.settlement.winnerPid)} won (${status}): nobody bet on the winner, pool rolls to the club`
      : `${nameOf(c.settlement.winnerPid)} won (${status})`
    poolRow(label, 'MATCH', label, r => r.type === 'MATCH' && r.match === label, outcome)
  }

  return wb
}

export async function downloadWorkbook(workbook, filename) {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function wagerExportFilename(event, date = new Date()) {
  const slug = (event.name ?? 'event').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `wagers-${slug}-${date.toISOString().slice(0, 10)}.xlsx`
}
