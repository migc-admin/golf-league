/**
 * Display helpers for the Payout page. Pure functions (no React, no Supabase).
 *
 * Nothing here changes a payout: amounts, tie-splitting and rounding all come from
 * `computePayouts` and the saved `payout_config`, exactly as before. These helpers only
 * decide how those numbers are grouped, labelled and summed up for the screen.
 */

const cents = n => Math.round(Number(n) * 100) / 100

export function money(n) {
  const v = Number(n)
  return `$${(Number.isFinite(v) ? v : 0).toFixed(2)}`
}

// ── Reading a config key ───────────────────────────────────────────────────

const RANKED = {
  '18_net':    '18-Hole Net',
  '18_gross':  'Low Gross',
  f9:          'Front 9 Net',
  b9:          'Back 9 Net',
  gf9:         'Gross Front 9',
  gb9:         'Gross Back 9',
  stf_net:     'Stableford Net',
  stf_gross:   'Stableford Gross',
}
const STANDALONE = {
  skins:          { label: 'Skins',          prize: 'Skins pool' },
  super_skins:    { label: 'Super Skins',    prize: 'Skins pool' },
  long_drive:     { label: 'Long drive',     prize: 'Winner' },
  low_putts:      { label: 'Low putts',      prize: 'Winner' },
  blind_partners: { label: 'Blind Partners', prize: 'Pool' },
}
const NASSAU = { f9: 'Front 9', b9: 'Back 9', '18': 'Full 18' }

// Order the groups appear in, wherever they show up.
const FAMILY_ORDER = ['18_net', '18_gross', 'f9', 'b9', 'gf9', 'gb9', 'stf_net', 'stf_gross', 'skins', 'super_skins',
  'long_drive', 'low_putts', 'blind_partners', 'ctp', 'super_ctp', 'nassau_net', 'nassau_gross']
const PRIZE_ORDER = { '1st': 1, '2nd': 2, '3rd': 3 }

/**
 * { key, family, familyLabel, flight: 'A'|null, prize, order, rank?, hole? } for any payout key.
 * Unknown keys still get a sensible entry so nothing in a saved config is ever dropped.
 */
export function parseKey(key) {
  let m = key.match(/^(18_net|18_gross|f9|b9|gf9|gb9|stf_net|stf_gross)(?:_([a-z]))?_(1st|2nd|3rd)$/)
  if (m) return { key, family: m[1], familyLabel: RANKED[m[1]], flight: m[2]?.toUpperCase() ?? null, prize: m[3], rank: PRIZE_ORDER[m[3]], order: PRIZE_ORDER[m[3]] }

  m = key.match(/^(skins|super_skins|long_drive|low_putts|blind_partners)(?:_([a-z]))?$/)
  if (m) return { key, family: m[1], familyLabel: STANDALONE[m[1]].label, flight: m[2]?.toUpperCase() ?? null, prize: STANDALONE[m[1]].prize, order: 1 }

  m = key.match(/^ctp_(\d+)$/)
  if (m) return { key, family: 'ctp', familyLabel: 'Closest to pin', flight: null, prize: `Hole ${m[1]}`, hole: Number(m[1]), order: Number(m[1]) }

  m = key.match(/^super_ctp_(?:([a-z])_)?(\d+)$/)
  if (m) return { key, family: 'super_ctp', familyLabel: 'Super CTP', flight: m[1]?.toUpperCase() ?? null, prize: `Hole ${m[2]}`, hole: Number(m[2]), order: Number(m[2]) }

  m = key.match(/^nassau_(net|gross)_(f9|b9|18)$/)
  if (m) return { key, family: `nassau_${m[1]}`, familyLabel: `Nassau (${m[1] === 'net' ? 'Net' : 'Gross'})`, flight: null, prize: NASSAU[m[2]], order: ['f9', 'b9', '18'].indexOf(m[2]) }

  return { key, family: key, familyLabel: key, flight: null, prize: 'Prize', order: 99 }
}

const familyRank = f => { const i = FAMILY_ORDER.indexOf(f); return i === -1 ? 99 : i }
const byFamilyThenOrder = (a, b) => familyRank(a.family) - familyRank(b.family) || a.order - b.order

// ── Setup tab: the flight table and the full-field table ───────────────────

/**
 * The "Flight prizes" table: for every family that has per-flight keys, rows by prize with one
 * key per flight. Built from the keys actually in the config — nothing is hard-coded.
 * @returns [{ family, label, rows: [{ prize, cells: { A: key | null, B: key | null } }] }]
 */
export function buildFlightTable(keys, flightLetters) {
  const parsed = keys.map(parseKey).filter(p => p.flight)
  const groups = new Map()
  for (const p of parsed.sort(byFamilyThenOrder)) {
    if (!groups.has(p.family)) groups.set(p.family, { family: p.family, label: p.familyLabel, rows: new Map() })
    const g = groups.get(p.family)
    const rowKey = `${p.prize}|${p.hole ?? ''}`
    if (!g.rows.has(rowKey)) g.rows.set(rowKey, { prize: p.prize, cells: Object.fromEntries(flightLetters.map(l => [l, null])) })
    if (p.flight in g.rows.get(rowKey).cells) g.rows.get(rowKey).cells[p.flight] = p.key
  }
  return [...groups.values()].map(g => ({ ...g, rows: [...g.rows.values()] }))
}

/** Keys that belong to the full field (no flight): everything the flight table doesn't hold. */
export function fullFieldKeys(keys) {
  return keys.map(parseKey).filter(p => !p.flight).sort(byFamilyThenOrder).map(p => p.key)
}

/**
 * The Closest-to-pin rows for the full-field table. When every hole has the same amount it is ONE
 * combined row ("Closest to pin · each hole"); otherwise one row per hole.
 */
export function ctpRows(config, keys) {
  const holes = keys.map(parseKey).filter(p => p.family === 'ctp').sort((a, b) => a.hole - b.hole)
  if (holes.length === 0) return []
  const amounts = holes.map(h => Number(config[h.key]) || 0)
  const same = amounts.every(a => a === amounts[0])
  if (holes.length > 1 && same) {
    return [{ combined: true, keys: holes.map(h => h.key), holes: holes.map(h => h.hole), amount: amounts[0] }]
  }
  return holes.map(h => ({ combined: false, keys: [h.key], holes: [h.hole], amount: Number(config[h.key]) || 0 }))
}

/** True when every flight has the same dollar amount for every prize (so one set of inputs will do). */
export function sameAmounts(config, flightTable) {
  return flightTable.every(g => g.rows.every(r => {
    const vals = Object.values(r.cells).filter(Boolean).map(k => Number(config[k]) || 0)
    return vals.every(v => v === vals[0])
  }))
}

/** A copy of the config with every flight's amount set to `fromLetter`'s. Same keys, same shape. */
export function mirrorFlights(config, flightTable, fromLetter = 'A') {
  const next = { ...config }
  for (const g of flightTable) for (const r of g.rows) {
    const source = r.cells[fromLetter]
    if (!source) continue
    for (const [letter, key] of Object.entries(r.cells)) if (key && letter !== fromLetter) next[key] = Number(config[source]) || 0
  }
  return next
}

// ── Totals and the allocation bar ──────────────────────────────────────────

/** Allocated vs pot: status 'balanced' | 'over' | 'under', the percent, and the dollar gap. */
export function allocation(pot, allocated) {
  const p = Number(pot) || 0
  const a = Number(allocated) || 0
  const diff = cents(a - p)
  return {
    status: Math.abs(diff) < 0.005 ? 'balanced' : diff > 0 ? 'over' : 'under',
    percent: p > 0 ? Math.round((a / p) * 100) : 0,
    gap: Math.abs(diff),
    text: Math.abs(diff) < 0.005 ? 'Balanced' : `${diff > 0 ? 'Over' : 'Under'} by ${money(Math.abs(diff))}`,
  }
}

/** Dollars in each stacked-bar segment: per-flight keys by flight, everything else is the full field. */
export function allocationSegments(config, multiplierOf) {
  const seg = { flightA: 0, flightB: 0, field: 0, other: 0 }
  for (const [key, val] of Object.entries(config)) {
    const total = (Number(val) || 0) * multiplierOf(key)
    const fl = parseKey(key).flight
    if (fl === 'A') seg.flightA += total
    else if (fl === 'B') seg.flightB += total
    else if (fl) seg.other += total
    else seg.field += total
  }
  return seg
}

// ── Results tab ────────────────────────────────────────────────────────────

/** Prizes that were shared because of a tie. */
export function tiedPrizeCount(byCategory) {
  return byCategory.filter(c => c.isTied).length
}

/** Players with at least one prize, and how many per flight. */
export function paidSummary(byPlayer, eventPlayers) {
  const flightOf = Object.fromEntries((eventPlayers ?? []).map(ep => [ep.player_id, ep.flight]))
  const perFlight = {}
  for (const p of byPlayer) {
    const f = flightOf[p.playerId]
    if (f) perFlight[f] = (perFlight[f] ?? 0) + 1
  }
  return { paid: byPlayer.length, perFlight }
}

export function totalPaid(byPlayer) {
  return cents(byPlayer.reduce((s, p) => s + p.total, 0))
}

/** "Tied — split 3 ways" is shown as a small tag instead of in the label. */
export function cleanLabel(label) {
  return String(label).replace(/\s*\((?:Tied|\d+ pairs tied)[^)]*\)\s*$/i, '').trim()
}
export function isTieLabel(label) {
  return /\((?:Tied|\d+ pairs tied)[^)]*\)\s*$/i.test(String(label))
}

const ORD = { 1: '1st', 2: '2nd', 3: '3rd' }

/**
 * How one prize's winner is shown on the By category list.
 *   single → the name; tie → every tied name with "$X each" (the amount is already split);
 *   none  → nobody has won it yet (no scores or no side-game winner entered).
 * `maxRank` is the lowest place paid for this contest, to word "2nd + 3rd combined".
 */
export function winnerDisplay(cat, nameOf, maxRank = 3) {
  const ids = cat.playerIds?.length ? cat.playerIds : cat.playerId ? [cat.playerId] : []
  if (ids.length === 0) return { kind: 'none', names: [], text: 'No winner yet', helper: null }
  const names = ids.map(nameOf)
  if (ids.length === 1 && !cat.isTied) return { kind: 'single', names, text: names[0], helper: null }
  const each = cents(cat.amount / ids.length)
  const rank = parseKey(cat.key).rank
  let helper = `Tie · ${money(each)} each`
  if (rank) {
    const last = Math.min(rank + ids.length - 1, maxRank)
    const places = Array.from({ length: last - rank + 1 }, (_, i) => ORD[rank + i]).join(' + ')
    helper = `Tie for ${ORD[rank]}${last > rank ? ` · ${places} combined` : ''} · ${money(each)} each`
  }
  return { kind: 'tie', names, text: names.join(' & '), helper }
}

/**
 * A category's parsed key. Skins winners are stored as `skins_<flight>_<playerId>` or
 * `skins_<playerId>`, so they are recognised by the skins flag rather than by the key alone.
 */
export function categoryParse(cat) {
  if (cat.isSkin) {
    const family = cat.key.startsWith('super_skins') ? 'super_skins' : 'skins'
    const flight = cat.key.match(/^(?:super_)?skins_([a-z])_/)?.[1]?.toUpperCase() ?? null
    return { key: cat.key, family, familyLabel: STANDALONE[family].label, flight, prize: 'Skins', order: 1 }
  }
  return parseKey(cat.key)
}

/**
 * The By category sections: [{ title, total, cats: [{ cat, parsed }] }] in a steady order.
 * 18-Hole Net, Front/Back 9, other scoring, Long drive, "Side games" (Closest to pin and Low putts),
 * then Skins at the bottom (Closest to pin and Low putts are grouped under "Side games"); any other contest in the config gets its own section.
 */
export function categorySections(byCategory) {
  const sections = new Map()
  for (const cat of byCategory) {
    const base = categoryParse(cat)
    const family = (base.family === 'ctp' || base.family === 'low_putts') ? 'field' : base.family
    const title = family === 'field' ? 'Side games' : base.familyLabel
    if (!sections.has(family)) sections.set(family, { family, title, total: 0, cats: [] })
    const s = sections.get(family)
    s.total = cents(s.total + cat.amount)
    s.cats.push({ cat, parsed: base })
  }
  // Skins always come last, after every other section.
  const rank = f => (f === 'skins' ? 1000 : f === 'super_skins' ? 1001 : f === 'field' ? FAMILY_ORDER.indexOf('long_drive') + 0.5 : familyRank(f))
  return [...sections.values()].sort((a, b) => rank(a.family) - rank(b.family))
}
