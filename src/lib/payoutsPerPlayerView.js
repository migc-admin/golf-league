/**
 * Payouts per player as plain data for the PNG. The money comes straight from computePayouts
 * (via computePayoutSummary); this only shortens each prize label into a chip and works out the tiles.
 */
import { money, playerFullName, shortDateText } from './resultsView'

/** "Skins — Flight A (14 skins)" -> "Skins ×14"; "18-Hole Net — Flight A, 3rd (Tied — split 2 ways)" -> "18-hole 3rd · tie". */
export function chipLabel(category) {
  const tie = /\(Tied/i.test(category)
  let c = String(category).replace(/\s*\(Tied[^)]*\)/i, '').trim()
  const skins = c.match(/^(Super Skins|Skins).*\((\d+) skins?\)/i)
  if (skins) return `${skins[1] === 'Skins' ? 'Skins' : 'Super skins'} ×${skins[2]}`
  const rank = c.match(/(1st|2nd|3rd)\s*$/)?.[1]
  let label
  if (/^18-Hole Net/i.test(c)) label = `18-hole ${rank ?? ''}`
  else if (/^Front 9 Net/i.test(c)) label = `Front 9 ${rank ?? ''}`
  else if (/^Back 9 Net/i.test(c)) label = `Back 9 ${rank ?? ''}`
  else if (/^Low Gross/i.test(c)) label = `Low gross ${rank ?? ''}`
  else if (/^Gross Front 9/i.test(c)) label = `Gross front 9 ${rank ?? ''}`
  else if (/^Gross Back 9/i.test(c)) label = `Gross back 9 ${rank ?? ''}`
  else if (/^Stableford (Net|Gross)/i.test(c)) label = `Stableford${/Gross/i.test(c) ? ' gross' : ''} ${rank ?? ''}`
  else if (/^Closest to Pin/i.test(c)) label = `CTP #${c.match(/Hole (\d+)/)?.[1] ?? ''}`
  else if (/^Super CTP/i.test(c)) label = `Super CTP #${c.match(/Hole (\d+)/)?.[1] ?? ''}`
  else if (/^Long Drive/i.test(c)) label = 'Long drive'
  else if (/^Low Putts/i.test(c)) label = 'Low putts'
  else if (/^Blind Partners/i.test(c)) label = 'Blind partners'
  else if (/^Nassau/i.test(c)) label = c.replace(/\s*—\s*/, ' · ')
  else label = c.replace(/\s*\(Full Field\)/i, '').replace(/\s*—\s*/g, ' · ')
  label = label.trim()
  return tie ? `${label} · tie` : label
}

/**
 * @param {Object} p
 * @param {Object} p.event
 * @param {Array}  p.eventPlayers
 * @param {Array}  p.players  computePlayerPayouts rows: { playerId, name, total, items }
 * @param {number} p.totalPot computePayouts' totalPot (entry fees plus buy-in pots)
 */
export function payoutsPerPlayerView({ event, eventPlayers, players, totalPot, buyInPotTotal = 0 }) {
  const nonGuests = eventPlayers.filter(ep => !ep.is_guest)
  const flightOf = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep.flight ?? null]))
  const paid = players.filter(p => p.total > 0)
  const paidOut = paid.reduce((s, p) => s + p.total, 0)
  const diff = Math.round((totalPot - paidOut) * 100) / 100

  const rows = players.map((p, i) => ({
    rank: i + 1,
    name: p.name,
    flight: flightOf[p.playerId] ?? null,
    chips: p.items
      .map(it => ({ label: chipLabel(it.category), amount: it.amount }))
      .sort((a, b) => b.amount - a.amount),
    total: p.total,
  }))

  const paidIds = new Set(paid.map(p => p.playerId))
  const noPayout = nonGuests.filter(ep => !paidIds.has(ep.player_id)).map(playerFullName).sort((a, b) => a.localeCompare(b))
  const flights = [...new Set(nonGuests.map(ep => ep.flight).filter(Boolean))].sort()
  const paidByFlight = flights.map(f => `Flight ${f} ${paid.filter(p => flightOf[p.playerId] === f).length}`).join(' · ')
  const top = players[0]
  const fee = Number(event.entry_fee)
  const breakdown = event.payout_basis === 'fixed' && event.payout_fixed_total
    ? 'Fixed pot'
    : `${nonGuests.length} players × $${Number.isInteger(fee) ? fee : fee.toFixed(2)}${buyInPotTotal > 0 ? ` + ${money(buyInPotTotal)} buy-ins` : ''}`

  return {
    eventName: event.name ?? (event.event_number ? `Event #${event.event_number}` : 'Event'),
    courseName: event.course?.name ?? '',
    dateShort: shortDateText(event.event_date),
    tiles: [
      { label: 'Total pot', value: money(totalPot), helper: breakdown },
      { label: 'Paid out', value: money(paidOut), helper: diff === 0 ? '✓ Ties to the pot' : `Off by ${money(Math.abs(diff))}`, tone: diff === 0 ? 'good' : 'warn' },
      { label: 'Players paid', value: `${paid.length} of ${nonGuests.length}`, helper: paidByFlight || null },
      { label: 'Top earner', value: top?.name ?? '—', helper: top ? `${money(top.total)} · ${top.items.length} prize${top.items.length === 1 ? '' : 's'}` : null },
    ],
    rows,
    totals: { paid: paid.length, noPayout, paidOut },
  }
}
