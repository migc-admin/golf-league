// "Insights" for the public league page: season records and averages worked out from the same round
// rows the Player scoring tab shows (see playerScoring.js). Nothing here changes scoring.
// Pure functions: rows in, a list of cards out. A card with no data behind it is left out.

export const MAX_PLAUSIBLE_GROSS = 200
const one = n => (Math.round(n * 10) / 10).toString()

const sum = a => a.reduce((s, n) => s + n, 0)
const avg = a => sum(a) / a.length
export function median(nums) {
  if (nums.length === 0) return null
  const s = [...nums].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const where = r => r.course ?? r.event

/** Rows holding the lowest (or highest) value of `field`; several rows when players tie. */
function extreme(rows, field, mode) {
  const have = rows.filter(r => r[field] != null)
  if (have.length === 0) return null
  const best = mode === 'min' ? Math.min(...have.map(r => r[field])) : Math.max(...have.map(r => r[field]))
  return { value: best, rows: have.filter(r => r[field] === best) }
}

/** "Name — 76" with the course underneath, or "2 Tied — 76" with the names when players share the record. */
function recordCard(key, label, found) {
  if (!found) return null
  const names = [...new Set(found.rows.map(r => r.player))]
  if (names.length === 1) return { key, label, title: `${names[0]} — ${found.value}`, sub: where(found.rows[0]) }
  return { key, label, title: `${names.length} Tied — ${found.value}`, sub: names.join(', ') }
}

function groupBy(rows, keyFn) {
  const m = new Map()
  for (const r of rows) {
    const k = keyFn(r)
    if (k == null) continue
    if (!m.has(k)) m.set(k, [])
    m.get(k).push(r)
  }
  return m
}

/**
 * @param rows        from playerScoringRows()
 * @param ctpByFlight optional { A: n, B: n } of recorded closest-to-pin winners by flight
 * @returns [{ key, label, title, sub }]
 */
export function seasonInsights(allRows, { ctpByFlight = null } = {}) {
  // A gross over 200 is a mistyped score, not a round; it would swamp the records and course averages.
  const rows = allRows.filter(r => r.gross <= MAX_PLAUSIBLE_GROSS)
  if (rows.length === 0) return []
  const cards = []

  cards.push(recordCard('high-gross', 'Season high gross', extreme(rows, 'gross', 'max')))
  cards.push(recordCard('low-gross', 'Season low gross', extreme(rows, 'gross', 'min')))
  cards.push(recordCard('low-putts', 'Lowest single-round putts', extreme(rows.filter(r => r.putts > 0), 'putts', 'min')))

  // Most tournaments attended
  const byPlayer = groupBy(rows, r => r.playerId)
  const counts = [...byPlayer.values()].map(rs => ({ name: rs[0].player, n: new Set(rs.map(r => r.eventId)).size }))
  const most = Math.max(...counts.map(c => c.n))
  const top = counts.filter(c => c.n === most).map(c => c.name).sort()
  cards.push({
    key: 'most-attended',
    label: 'Most tournaments attended',
    title: top.length === 1 ? top[0] : `${top.length} Tied`,
    sub: top.length === 1 ? `${most} tournament${most === 1 ? '' : 's'}` : `${most} tournaments — ${top.slice(0, 4).join(', ')}${top.length > 4 ? '…' : ''}`,
  })

  // Lowest average gross by player (at least two rounds)
  const avgs = [...byPlayer.values()].filter(rs => rs.length >= 2).map(rs => ({ name: rs[0].player, avg: avg(rs.map(r => r.gross)) }))
  if (avgs.length) {
    const best = Math.min(...avgs.map(a => a.avg))
    const who = avgs.filter(a => a.avg === best)
    cards.push({
      key: 'low-avg-player',
      label: 'Lowest avg gross — player (min 2 rounds)',
      title: who.length === 1 ? who[0].name : `${who.length} Tied`,
      sub: `${one(best)} avg gross${who.length > 1 ? ` — ${who.map(w => w.name).join(', ')}` : ''}`,
    })
  }

  if (ctpByFlight) {
    const parts = Object.entries(ctpByFlight).filter(([, n]) => n > 0).sort(([a], [b]) => a.localeCompare(b))
    const total = sum(parts.map(([, n]) => n))
    if (total > 0) cards.push({ key: 'ctp-flight', label: 'Closest to pin wins by flight', title: parts.map(([f, n]) => `Flight ${f}: ${n}`).join(' | '), sub: `${total} total CTP win${total === 1 ? '' : 's'}` })
  }

  // Course averages
  const byCourse = [...groupBy(rows, r => r.course).entries()].map(([course, rs]) => ({ course, avg: avg(rs.map(r => r.gross)) }))
  if (byCourse.length >= 2) {
    const hi = byCourse.reduce((a, b) => (b.avg > a.avg ? b : a))
    const lo = byCourse.reduce((a, b) => (b.avg < a.avg ? b : a))
    cards.push({ key: 'high-avg-course', label: 'Highest avg gross — course', title: hi.course, sub: `Avg ${one(hi.avg)} gross` })
    cards.push({ key: 'low-avg-course', label: 'Lowest avg gross — course', title: lo.course, sub: `Avg ${one(lo.avg)} gross` })
  }

  // Median net by flight
  const flights = [...groupBy(rows, r => r.flight).entries()].sort(([a], [b]) => a.localeCompare(b))
  if (flights.length) {
    const meds = flights.map(([f, rs]) => [f, median(rs.map(r => r.net))])
    cards.push({
      key: 'median-net',
      label: 'Median net score',
      title: meds.length === 1 ? one(meds[0][1]) : meds.map(([f, m]) => `${f}: ${one(m)}`).join(' | '),
      sub: meds.length === 1 ? 'Median net across all rounds' : `Flight ${meds[0][0]} vs Flight ${meds[1][0]} median net`,
    })
  }

  return cards.filter(Boolean)
}

/**
 * Player-rounds that stay out of the season insights: guests (by profile role or event entry) and
 * players marked no-show for the event (every score entered_by "no_show"; their scores only exist
 * so bets could settle). Returns a Set of "eventId-playerId", the same key playerScoringRows uses.
 */
export function insightExclusions({ events, epsByEvent, scoresByEvent }) {
  const out = new Set()
  for (const ev of events) {
    const byPlayer = {}
    for (const sc of scoresByEvent?.[ev.id] ?? []) (byPlayer[sc.player_id] ??= []).push(sc)
    for (const ep of epsByEvent?.[ev.id] ?? []) {
      const mine = byPlayer[ep.player_id] ?? []
      const noShow = mine.length > 0 && mine.every(sc => sc.entered_by === 'no_show')
      if (ep.is_guest || ep.player?.intended_role === 'guest' || noShow) out.add(`${ev.id}-${ep.player_id}`)
    }
  }
  return out
}

/**
 * Recorded closest-to-pin winners per flight ({ A: n, B: n }), straight from the side-game results.
 * Guests and no-shows are left out; a league with no flights counts everyone as Flight A. Super CTP isn't counted.
 */
export function ctpWinsByFlight({ events, epsByEvent, sideGamesByEvent, scoresByEvent }) {
  const skip = insightExclusions({ events, epsByEvent, scoresByEvent })
  const out = {}
  for (const ev of events) {
    const eps = epsByEvent[ev.id] ?? []
    for (const sg of sideGamesByEvent?.[ev.id] ?? []) {
      if (sg.game_type !== 'ctp' || !sg.winner_player_id) continue
      const ep = eps.find(e => e.player_id === sg.winner_player_id)
      if (!ep || skip.has(`${ev.id}-${ep.player_id}`)) continue
      const f = ep.flight === 'B' ? 'B' : 'A'
      out[f] = (out[f] ?? 0) + 1
    }
  }
  return out
}
