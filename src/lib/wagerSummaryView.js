/**
 * View-model for the wager results page (By bettor | By pool) and the printable Wager Payout
 * Summary. Pure functions: no React, no Supabase, no new betting math.
 *
 * Everything is shaped from the results model (`buildResultsModel`), which itself comes from the
 * settlement the board and the Excel export already use. The only figures worked out here are sums
 * and differences of numbers that model already holds (a bettor's total payout, the tie-out
 * difference), kept to the cent.
 */

import { money, netText, netOf, matchesQuery } from './wagerResultsView'

const cents = n => Math.round(Number(n) * 100) / 100
const lastName = full => {
  const parts = String(full ?? '').trim().split(/\s+/)
  return parts[parts.length - 1] || ''
}

/** One row per winning bettor across every pool, biggest payout first. */
export function bettorRows(model) {
  const byName = new Map()
  const add = (name, chipLabel, r) => {
    const row = byName.get(name) ?? { name, chips: [], staked: 0, payout: 0 }
    row.chips.push({ label: chipLabel, payout: r.payout })
    row.staked = cents(row.staked + r.stake)
    row.payout = cents(row.payout + r.payout)
    byName.set(name, row)
  }
  for (const p of model.panels) for (const r of p.rows) add(r.name, p.key === 'win' ? 'WIN' : 'PLACE', r)
  for (const m of model.matches) for (const r of m.rows) add(r.name, `M${m.number}`, r)
  return [...byName.values()]
    .map(r => ({ ...r, net: netOf(r.payout, r.staked) }))
    .sort((a, b) => b.payout - a.payout || a.name.localeCompare(b.name))
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

/** Same rows, filtered by the "Find your name" search. */
export function filterBettorRows(rows, query) {
  return rows.filter(r => matchesQuery(r.name, query))
}

function poolCards(model) {
  const sum = rows => cents(rows.reduce((t, r) => t + r.payout, 0))
  const cards = []
  for (const p of model.panels) {
    cards.push({
      key: p.key, kind: p.key === 'win' ? 'Win' : 'Place', title: p.key === 'win' ? 'Win pool' : 'Place pool',
      pool: p.pool, pill: p.pill, note: p.note, winnerText: p.winnerText, rows: p.rows, paid: sum(p.rows),
    })
  }
  for (const m of model.matches) {
    cards.push({
      key: `m${m.id ?? m.number}`, kind: 'Match', title: `Match ${m.number} · ${m.a} vs ${m.b}`,
      shortTitle: `Match ${m.number} · ${lastName(m.a)} vs ${lastName(m.b)}`,
      pool: m.pool, pill: m.pill, note: m.note ?? m.resultLine, winnerText: m.winnerText, rows: m.rows, paid: sum(m.rows),
    })
  }
  return cards
}

function tieStatus(card) {
  const diff = cents(card.pool - card.paid)
  if (Math.abs(diff) < 0.005) return { kind: 'ties', label: 'Ties' }
  if (card.rows.length === 0) return { kind: 'club', label: 'To club' }
  return { kind: 'off', label: `Off by ${money(Math.abs(diff))}`, diff }
}

/** Pool cards for the "By pool" view (unfiltered). */
export function poolView(model) {
  return poolCards(model)
}

/** "By pool" cards with only the matching bettors' rows; pools left with none are dropped while searching. */
export function filterPoolCards(cards, query) {
  if (!String(query ?? '').trim()) return cards
  return cards
    .map(c => ({ ...c, rows: c.rows.filter(r => matchesQuery(r.name, query)) }))
    .filter(c => c.rows.length > 0)
}

/** Key for the chips: WIN, PLACE (when those pools exist) and each decided match ("M3" = Match 3: Paguyo vs Lopez). */
export function legendOf(cards) {
  return cards.map(c => {
    if (c.kind === 'Win') return { label: 'WIN', text: 'Win pool' }
    if (c.kind === 'Place') return { label: 'PLACE', text: 'Place pool' }
    const n = c.shortTitle.match(/^Match (\d+)/)?.[1]
    return { label: `M${n}`, text: c.shortTitle.replace(/^Match \d+ · /, '') }
  })
}

/**
 * Everything the results page tiles and the printable summary need.
 * @returns {{ tiles, bettors, totals, tieOut, final }}
 */
export function buildSummary(model) {
  const bettors = bettorRows(model)
  const cards = poolCards(model)
  const winningRows = cards.reduce((n, c) => n + c.rows.length, 0)
  const paid = cents(cards.reduce((t, c) => t + c.paid, 0))
  const pot = cents(model.pools.total)
  const diff = cents(pot - paid)
  const clubAmt = cents(cards.filter(c => tieStatus(c).kind === 'club').reduce((t, c) => t + c.pool, 0))
  const unexplained = cents(diff - clubAmt)
  const ties = Math.abs(unexplained) < 0.005
  const top = bettors.reduce((best, r) => (!best || r.net > best.net ? r : best), null)

  const tieOut = cards.map(c => ({
    key: c.key, pool: c.shortTitle ?? c.title, winner: c.winnerText, winningBets: c.rows.length,
    poolSize: c.pool, paidOut: c.paid, status: tieStatus(c),
  }))

  return {
    final: model.final,
    tiles: {
      pot: { value: pot, breakdown: `Win ${money(model.pools.win)} · Place ${money(model.pools.place)} · Match ${money(model.pools.match)}` },
      paid: {
        value: paid, ties,
        helper: ties
          ? (clubAmt > 0 ? `Ties to the pot · ${money(clubAmt)} rolls to the club` : `Ties to the pot · ${money(0)} difference`)
          : `Off by ${money(Math.abs(unexplained))}`,
      },
      settled: { value: model.betCount, helper: `${winningRows} winning · ${Math.max(0, model.betCount - winningRows)} losing`, winning: winningRows, losing: Math.max(0, model.betCount - winningRows) },
      top: top ? { name: top.name, helper: `${money(top.payout)} paid · ${netText(top.net)}` } : null,
    },
    bettors,
    totals: {
      winners: bettors.length,
      staked: cents(bettors.reduce((t, r) => t + r.staked, 0)),
      payout: cents(bettors.reduce((t, r) => t + r.payout, 0)),
      net: cents(bettors.reduce((t, r) => t + r.net, 0)),
    },
    tieOut,
    tieTotals: {
      winningBets: tieOut.reduce((n, r) => n + r.winningBets, 0),
      poolSize: cents(tieOut.reduce((t, r) => t + r.poolSize, 0)),
      paidOut: cents(tieOut.reduce((t, r) => t + r.paidOut, 0)),
      status: ties ? { kind: 'ties', label: 'Ties' } : { kind: 'off', label: `Off by ${money(Math.abs(unexplained))}` },
    },
    losingStakes: cents(model.pools.total - bettors.reduce((t, r) => t + r.staked, 0)),
    legend: legendOf(cards),
  }
}
