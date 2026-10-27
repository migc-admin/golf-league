import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { computeWagerSettlement, wagerOutcomes } from './wagerSettlement'
import { buildWagerWorkbook, wagerExportFilename, wagerPngFilename } from './wagerExport'

const course = { stroke_index: Array.from({ length: 18 }, (_, i) => i + 1), par_per_hole: Array.from({ length: 18 }, () => 4) }
const ep = id => ({ player_id: id, course_handicap: 0, tee: null, flight: 'A', group_number: 1, player: { first_name: id, last_name: '' } })
const flat = (id, gross) => Array.from({ length: 18 }, (_, i) => ({ player_id: id, hole_number: i + 1, gross_score: gross }))
const players = [ep('p1'), ep('p2'), ep('p3'), ep('p4')]
const scores = [...flat('p1', 4), ...flat('p2', 5), ...flat('p3', 5), ...flat('p4', 6)]
const pairings = [{ id: 'm1', match_number: 1, player_a_id: 'p1', player_b_id: 'p4' }]
const W = (id, bettor, amount, extra) => ({
  id, bettor_name: bettor, amount: String(amount), created_at: `2026-10-2${id.length}T15:00:00Z`, deleted_at: null,
  pick_1st: null, pick_2nd: null, match_pairing_id: null, pick_match: null, payment_method: null, ...extra,
})
const wagers = [
  W('a', 'Alex', 10, { pick_1st: 'p1', payment_method: 'venmo' }),
  W('bb', ' alex ', 20, { pick_2nd: 'p1', payment_method: 'cash' }),   // same bettor, stray spaces/case
  W('ccc', 'Blair', 30, { pick_1st: 'p4' }),
  W('dddd', 'Blair', 10, { match_pairing_id: 'm1', pick_match: 'p1' }),
  W('eeeee', 'Casey', 5, { pick_1st: 'p2', deleted_at: '2026-10-22T16:00:00Z' }), // removed
]
const active = wagers.filter(w => !w.deleted_at)
const settlement = computeWagerSettlement({ active, players, scores, pairings, course })
const nameOf = id => (id ? `Player ${id}` : '')
const event = { name: 'Playoffs - Round 1', event_date: '2026-10-25', status: 'complete' }

async function roundTrip(extra = {}) {
  const wb = buildWagerWorkbook(ExcelJS, {
    event, wagers, pairings, nameOf, settlement,
    outcomes: wagerOutcomes(settlement, active, event.status), exportedAt: new Date('2026-10-22T20:00:00Z'), ...extra,
  })
  const buf = await wb.xlsx.writeBuffer()
  const back = new ExcelJS.Workbook()
  await back.xlsx.load(buf)
  return back
}

describe('wager Excel export', () => {
  it('has the four sheets', async () => {
    const wb = await roundTrip()
    expect(wb.worksheets.map(s => s.name)).toEqual(['Summary', 'All Bets', 'By Bettor', 'Pools'])
  })

  it('lists every bet, including removed ones, with type, selection, method and status', async () => {
    const ws = (await roundTrip()).getWorksheet('All Bets')
    expect(ws.rowCount).toBe(1 + wagers.length)
    // (column keys are not stored in the file, so read by column number: C bettor, D type, E selection, G amount, H method, M status)
    const rows = ws.getRows(2, wagers.length).map(r => ({
      bettor: r.getCell(3).value, type: r.getCell(4).value, selection: r.getCell(5).value,
      amount: r.getCell(7).value, method: r.getCell(8).value, status: r.getCell(13).value,
    }))
    expect(rows[0]).toMatchObject({ type: 'WIN', selection: 'Player p1', method: 'Venmo', status: 'Active', amount: 10 })
    expect(rows[1]).toMatchObject({ type: 'PLACE', method: 'Cash' })
    expect(rows[3]).toMatchObject({ type: 'MATCH', selection: 'Player p1' })
    expect(rows[4]).toMatchObject({ status: 'Removed', amount: 5 })
    expect(ws.getCell('F5').value).toContain('Match 1: Player p1 vs Player p4')
    expect(rows.map(r => r.bettor)).toEqual(['Alex', 'Alex', 'Blair', 'Blair', 'Casey'])   // " alex " folded into Alex
  })

  it('puts payouts on winning bets and zero on losing and removed bets', async () => {
    const ws = (await roundTrip()).getWorksheet('All Bets')
    const payout = r => ws.getRow(r).getCell(11).value
    expect(payout(2)).toBe(40)      // WIN pool is $10 + $30; Alex is the only winner, so takes all $40
    expect(payout(3)).toBe(20)      // PLACE: only backer of 1st place; stake back, no profit to share
    expect(payout(4)).toBe(0)       // Blair's WIN on the 4th-place finisher
    expect(payout(5)).toBe(10)      // MATCH: Blair backed the winner; pool is just her stake
    expect(payout(6)).toBe(0)       // removed bet
  })

  it('groups bettors case-insensitively and trims names', async () => {
    const ws = (await roundTrip()).getWorksheet('By Bettor')
    const names = ws.getRows(2, 2).map(r => r.getCell(1).value)
    expect(names).toEqual(['Alex', 'Blair'])        // " alex " merged into Alex; Casey (removed only) excluded
    expect(ws.getCell('B2').value.result).toBe(2)   // Alex has two active bets
  })

  it('writes live formulas for the tracking columns', async () => {
    const wb = await roundTrip()
    const summary = wb.getWorksheet('Summary')
    const formulas = []
    summary.eachRow(r => { const v = r.getCell(2).value; if (v && v.formula) formulas.push(v.formula) })
    expect(formulas.some(f => f.includes('SUMIFS') && f.includes('"Yes"'))).toBe(true)
    // "Still to collect" must reference the staked and collected rows, whatever row they landed on
    const still = formulas.find(f => /^B\d+-B\d+$/.test(f))
    expect(still).toBeTruthy()
    const bb = wb.getWorksheet('By Bettor')
    expect(bb.getCell('C2').value.formula).toContain("'All Bets'!")
  })

  it('adds a provisional note only when the event is not complete', async () => {
    const done = (await roundTrip()).getWorksheet('Summary')
    const live = (await roundTrip({ event: { ...event, status: 'active' } })).getWorksheet('Summary')
    const text = ws => { const t = []; ws.eachRow(r => t.push(String(r.getCell(2).value ?? ''))); return t.join('|') }
    expect(text(done)).not.toContain('provisional')
    expect(text(live)).toContain('provisional')
  })

  it('has one Pools row per pool with bets', async () => {
    const ws = (await roundTrip()).getWorksheet('Pools')
    expect(ws.getRows(2, ws.rowCount - 1).map(r => r.getCell(1).value)).toEqual(['WIN', 'PLACE', 'Match 1: Player p1 vs Player p4'])
  })

  it('builds a readable filename', () => {
    expect(wagerExportFilename(event, new Date('2026-10-22T12:00:00Z'))).toBe('wagers-playoffs-round-1-2026-10-22.xlsx')
  })
})

describe('wagerPngFilename', () => {
  it('names the share image after the event and date', () => {
    expect(wagerPngFilename({ name: 'Playoffs – Round 1' }, new Date('2026-10-25T12:00:00Z')))
      .toBe('wager-results-playoffs-round-1-2026-10-25.png')
  })
})
