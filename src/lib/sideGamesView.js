/**
 * What the Side Games "Winner Entry" page shows: which fields exist and who can be picked.
 *
 * Pure functions (no React, no Supabase). They only read the event, its roster and the saved
 * `side_games` rows; how winners are stored is unchanged.
 *
 * Rules (from the event's own setup, never hard-coded):
 *   Long Drive        one field per flight when the game is set up "by flight", or a single
 *                     "Overall" field for the entire field. A flight's list holds only that
 *                     flight's players.
 *   Closest to Pin    one field per hole you designated in Payout Config (ctp_3, ctp_8 …), in hole
 *                     order. Everyone can win any hole. If CTP is set up per flight, each hole has a
 *                     field per flight instead.
 *   Everyone listed   is registered in this event and is NOT a guest (guests cannot win side games),
 *                     sorted alphabetically by first name and shown as "First Last".
 */

const upper = s => String(s).toUpperCase()

/** Flight letters the event defines: A, B, … from num_flights (2 when it uses flights). */
export function eventFlightLetters(event) {
  const n = event?.num_flights ?? (event?.use_flights ? 2 : 0)
  return Array.from({ length: n }, (_, i) => String.fromCharCode(65 + i))
}

const firstLast = ep => `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim().toLowerCase()

/** Players who can win a side game: in this event, not guests, sorted alphabetically by first name. */
export function eligiblePlayers(eventPlayers) {
  return (eventPlayers ?? []).filter(ep => !ep.is_guest).sort((a, b) => firstLast(a).localeCompare(firstLast(b)))
}

export function playerLabel(ep) {
  return `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim()
}

/** Saved value for a field, read exactly as the page always has: '' (none), 'NO_WINNER', or a player id. */
export function winnerValue(sideGames, gameType, holeNumber, flight) {
  const record = (sideGames ?? []).find(g =>
    g.game_type === gameType
    && g.hole_number === (holeNumber ?? null)
    && (flight ? g.flight === flight : true))
  if (!record) return ''
  return record.winner_player_id ?? 'NO_WINNER'
}

/** Letters used by a per-flight game, e.g. long_drive_a / long_drive_b → ['A','B']. */
function suffixLetters(sides, base) {
  const rx = new RegExp(`^${base}_([a-z])$`)
  return sides.map(s => s.match(rx)?.[1]).filter(Boolean).map(upper)
}

/** CTP holes designated in Payout Config, in hole order, with the course's par for each. */
export function ctpHoles(event, course) {
  return Object.keys(event?.payout_config ?? {})
    .filter(k => /^ctp_\d+$/.test(k))
    .map(k => parseInt(k.slice(4), 10))
    .sort((a, b) => a - b)
    .map(hole => ({ hole, par: course?.par_per_hole?.[hole - 1] ?? 3 }))
}

/**
 * The whole page's fields.
 * Returns {
 *   longDrive: null | { fields: [{ key, label, flight, gameType, hole, players, disabled, value }] },
 *   ctp:       null | { holes: [{ hole, par, fields: [...] }] },
 *   noFlight:  number of players left out of flight lists because they have no flight,
 *   rosterCount / eligibleCount: everyone in the event / everyone who can win (non-guests),
 *   total, entered
 * }
 */
export function buildSideGamesPlan({ event, eventPlayers, sideGames, course }) {
  const sides = event?.side_game_options ?? []
  const players = eligiblePlayers(eventPlayers)
  const eventFlights = eventFlightLetters(event)

  const flightField = (gameType, hole, letter, keyPrefix) => {
    const list = players.filter(ep => ep.flight === letter)
    return {
      key: `${keyPrefix}-${letter}`, label: `Flight ${letter}`, flight: letter, gameType, hole,
      players: list, disabled: list.length === 0, value: winnerValue(sideGames, gameType, hole, letter),
    }
  }
  const overallField = (gameType, hole, keyPrefix, label) => ({
    key: `${keyPrefix}-overall`, label, flight: 'overall', gameType, hole,
    players, disabled: players.length === 0, value: winnerValue(sideGames, gameType, hole, 'overall'),
  })

  // Long Drive
  const ldLetters = suffixLetters(sides, 'long_drive')
  let longDrive = null
  if (ldLetters.length > 0) {
    const letters = [...new Set([...eventFlights, ...ldLetters])].sort()
    longDrive = { fields: letters.map(l => flightField('long_drive', null, l, 'ld')) }
  } else if (sides.includes('long_drive')) {
    longDrive = { fields: [overallField('long_drive', null, 'ld', 'Overall')] }
  }

  // Closest to Pin
  let ctp = null
  const holes = ctpHoles(event, course)
  if (sides.some(s => s === 'ctp' || /^ctp_[a-z]$/.test(s)) && holes.length > 0) {
    const ctpLetters = suffixLetters(sides, 'ctp')
    const letters = ctpLetters.length > 0 ? [...new Set([...eventFlights, ...ctpLetters])].sort() : []
    ctp = {
      holes: holes.map(h => ({
        ...h,
        fields: letters.length > 0
          ? letters.map(l => flightField('ctp', h.hole, l, `ctp${h.hole}`))
          // Entire field: any player in the event can win any hole (the same player may win several).
          : [overallField('ctp', h.hole, `ctp${h.hole}`, `Hole ${h.hole}`)],
      })),
    }
  }

  const allFields = [...(longDrive?.fields ?? []), ...(ctp?.holes.flatMap(h => h.fields) ?? [])]
  const usesFlights = allFields.some(f => f.flight !== 'overall')
  return {
    longDrive,
    ctp,
    noFlight: usesFlights ? players.filter(ep => !ep.flight).length : 0,
    rosterCount: (eventPlayers ?? []).length,
    eligibleCount: players.length,
    total: allFields.length,
    entered: allFields.filter(f => f.value !== '').length,
  }
}

/**
 * The plan with some field values replaced (by field key) — used to show a choice straight away
 * while it is being saved. Recounts how many fields are entered.
 */
export function withOverrides(plan, overrides) {
  if (!overrides || Object.keys(overrides).length === 0) return plan
  const apply = f => (f.key in overrides ? { ...f, value: overrides[f.key] } : f)
  const longDrive = plan.longDrive && { ...plan.longDrive, fields: plan.longDrive.fields.map(apply) }
  const ctp = plan.ctp && { ...plan.ctp, holes: plan.ctp.holes.map(h => ({ ...h, fields: h.fields.map(apply) })) }
  const all = [...(longDrive?.fields ?? []), ...(ctp?.holes.flatMap(h => h.fields) ?? [])]
  return { ...plan, longDrive, ctp, entered: all.filter(f => f.value !== '').length }
}
