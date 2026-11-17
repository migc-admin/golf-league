// Display helpers for the public event leaderboard. Pure functions over values the
// scoring engines already produce — nothing here changes scoring, skins, match play or payouts.

/**
 * Result chip for a match play row: the text and which side's colour fills it.
 * tone: 'winA' | 'winB' (decided, filled) · 'leadA' | 'leadB' (in progress, tinted) · 'even'
 */
export function matchChip(m) {
  if (!m || m.holesPlayed === 0) return { text: 'Not started', tone: 'even' }
  if (m.needsWinner) return { text: 'Tied', tone: 'even' }
  if (m.winner === 'halve') return { text: 'Halved', tone: 'even' }
  if (m.winner === 'A' || m.winner === 'B') {
    const text = m.tiebreak ? 'Tiebreak' : tidyStatus(m.matchStatus)
    return { text, tone: m.winner === 'A' ? 'winA' : 'winB' }
  }
  const lead = m.upBy > 0 ? 'A' : m.upBy < 0 ? 'B' : null
  return { text: tidyStatus(m.matchStatus), tone: lead ? `lead${lead}` : 'even' }
}

/** "2 UP (A)" → "2 up", "All Square" → "All square", "Dormie 2 (B)" → "Dormie 2", "3&2" stays. */
export function tidyStatus(status) {
  return String(status ?? '')
    .replace(/ \([AB]\)$/, '')
    .replace(/\bUP\b/, 'up')
    .replace(/^All Square$/, 'All square')
}

/**
 * Hole-by-hole skins as display rows. Consecutive tied holes collapse into one row; a winning
 * hole carries the pieces of its skin count ("1 + 3 carried + 5 wrapped from 14–18").
 * Holes still being scored are left out, as before.
 *
 * @returns [{ type: 'tied', from, to, carried } | { type: 'win', hole, winner, skinsWon, parts: [] }]
 */
export function skinsHoleRows(holes = []) {
  const done = holes.filter(h => !h.incomplete)
  const rows = []
  for (const h of done) {
    const prev = rows[rows.length - 1]
    if (h.tied && !h.winner) {
      if (prev?.type === 'tied' && prev.to === h.hole - 1) {
        prev.to = h.hole
        prev.carried = h.carryoverIn + 1
      } else {
        rows.push({ type: 'tied', from: h.hole, to: h.hole, carried: h.carryoverIn + 1 })
      }
    } else if (h.winner) {
      rows.push({ type: 'win', hole: h.hole, winner: h.winner, skinsWon: h.skinsWon, carryoverIn: h.carryoverIn ?? 0, wraparound: h.wraparound ?? 0 })
    }
  }
  // Skins still tied after the last hole wrap around to the first winner
  const last = rows[rows.length - 1]
  const wrapRun = last?.type === 'tied' && last.to === 18 ? last : null
  for (const r of rows) {
    if (r.type !== 'win') continue
    const parts = []
    if (r.carryoverIn > 0 || r.wraparound > 0) {
      parts.push('1')
      if (r.carryoverIn > 0) parts.push(`${r.carryoverIn} carried`)
      if (r.wraparound > 0) parts.push(`${r.wraparound} wrapped${wrapRun ? ` from ${holeRange(wrapRun.from, wrapRun.to)}` : ''}`)
    }
    r.parts = parts
    delete r.carryoverIn
    delete r.wraparound
  }
  return rows
}

export const holeRange = (from, to) => (from === to ? `${from}` : `${from}–${to}`)

const GAME_SHORT = {
  '18-Hole Net': 'net',
  'Front 9 Net': 'F9 net',
  'Back 9 Net': 'B9 net',
  'Low Gross': 'gross',
  'Gross Front 9': 'F9 gross',
  'Gross Back 9': 'B9 gross',
  'Stableford Net': 'Stableford',
  'Stableford Gross': 'Stableford gross',
}

/**
 * Short source tag for a payout line ("18-Hole Net — Flight A, 1st" → "1st net",
 * "Closest to Pin — Hole 8 (Full Field)" → "CTP #8"). Unknown labels pass through.
 */
export function payoutTag(label) {
  const raw = String(label ?? '')
  const tied = /\(Tied — split \d+ ways\)/.test(raw)
  const s = raw.replace(/\s*\(Tied — split \d+ ways\)/, '').trim()
  const tie = t => (tied ? `${t} (tie)` : t)

  let m = s.match(/^Super CTP — Hole (\d+)/)
  if (m) return tie(`Super CTP #${m[1]}`)
  m = s.match(/^Closest to Pin — Hole (\d+)/)
  if (m) return tie(`CTP #${m[1]}`)
  if (/^Super Skins/.test(s)) return tie('Super skins')
  if (/^Skins/.test(s)) return tie('Skins')
  if (/^Long Drive/.test(s)) return tie('Long drive')
  if (/^Low Putts/.test(s)) return tie('Low putts')
  if (/^Blind Partners/.test(s)) return tie('Blind partners')
  m = s.match(/^Nassau \((Net|Gross)\) — (Front 9|Back 9|Full 18)$/)
  if (m) return tie(`Nassau ${{ 'Front 9': 'F9', 'Back 9': 'B9', 'Full 18': '18' }[m[2]]} ${m[1].toLowerCase()}`)
  m = s.match(/^(.+?) — (?:Flight [A-Z], )?(\d+(?:st|nd|rd|th))$/)
  if (m && GAME_SHORT[m[1]]) return tie(`${m[2]} ${GAME_SHORT[m[1]]}`)
  return raw
}

/**
 * Finish label for a Team play pick: "7", or "T7" when another player in the same flight
 * finished on the same points (tied finishes split points equally).
 */
export function finishLabel(playerId, rank, playerPoints = {}, flightOf = () => null) {
  if (rank == null) return '—'
  const fl = flightOf(playerId)
  const pts = playerPoints[playerId]
  const shared = Object.entries(playerPoints).filter(([id, p]) => p === pts && flightOf(id) === fl).length
  return shared > 1 ? `T${rank}` : `${rank}`
}

/** "+3" / "E" / "-2" / "—" */
export function toParText(vs) {
  return vs == null ? '—' : vs === 0 ? 'E' : `${vs > 0 ? '+' : ''}${vs}`
}
