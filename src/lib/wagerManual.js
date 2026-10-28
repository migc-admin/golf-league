/**
 * Builds the database row for a bet an admin enters by hand (a bet taken in person).
 * The row has exactly the same shape the public wager page inserts, so it flows through the
 * board, settlement, the Excel export and the PNG with no special cases.
 *
 *   WIN   → pick_1st = player      PLACE → pick_2nd = player
 *   MATCH → match_pairing_id + pick_match (the player picked to win that match)
 */
export function buildManualWagerRow({ eventId, bettor, kind, playerId, matchId, matchPick, amount, method }) {
  const name = String(bettor ?? '').trim()
  if (!name) return { error: 'Enter the bettor’s name.' }
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt <= 0) return { error: 'Enter an amount greater than $0.' }
  const base = { event_id: eventId, bettor_name: name, amount: Math.round(amt * 100) / 100, payment_method: method || null }

  if (kind === 'match') {
    if (!matchId || !matchPick) return { error: 'Choose a match and the player picked to win it.' }
    return { row: { ...base, match_pairing_id: matchId, pick_match: matchPick } }
  }
  if (kind !== 'win' && kind !== 'place') return { error: 'Choose WIN, PLACE or MATCH.' }
  if (!playerId) return { error: 'Choose a player.' }
  return { row: { ...base, pick_1st: kind === 'win' ? playerId : null, pick_2nd: kind === 'place' ? playerId : null } }
}
