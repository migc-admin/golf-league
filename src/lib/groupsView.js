/**
 * Display helpers for the Groups & pairings page. Pure functions (no React, no Supabase)
 * so the rules the page shows — who the scorer is, who has no match, when a tiebreak box
 * appears, what the mobile "Group" menu says — can be unit tested.
 *
 * Nothing here changes data. The page still calls the same save functions it always did.
 */

/** scores.entered_by is set to this for a marked no-show; it is a status, never a person. */
export const NO_SHOW_ENTRY = 'no_show'

/** The event is locked for group and pairing changes once it is complete. */
export function isGroupsLocked(event) {
  return event?.status === 'complete'
}

export function fullName(ep) {
  return `${ep?.player?.first_name ?? ''} ${ep?.player?.last_name ?? ''}`.trim()
}

/**
 * Who entered scores for each group: { [groupNumber]: Set<name> }.
 * Skips blank entries and the no-show marker, so "no_show" can never appear as a scorer.
 */
export function scorerNamesByGroup(eventPlayers, allScores) {
  const groupOf = Object.fromEntries((eventPlayers ?? []).map(ep => [ep.player_id, ep.group_number]))
  const map = {}
  for (const s of allScores ?? []) {
    const name = typeof s.entered_by === 'string' ? s.entered_by.trim() : ''
    if (!name || name === NO_SHOW_ENTRY) continue
    const g = groupOf[s.player_id]
    if (!g) continue
    ;(map[g] ??= new Set()).add(name)
  }
  return map
}

/** Which members of a group are its scorer(s): players whose full name matches an entry. */
export function scorerIds(members, scorerNames) {
  if (!scorerNames || scorerNames.size === 0) return new Set()
  const wanted = new Set([...scorerNames].map(n => n.toLowerCase()))
  return new Set(members.filter(ep => wanted.has(fullName(ep).toLowerCase())).map(ep => ep.id))
}

/** Scorer(s) first, otherwise the existing order. */
export function scorersFirst(members, scorerIdSet) {
  return [...members].sort((a, b) => Number(scorerIdSet.has(b.id)) - Number(scorerIdSet.has(a.id)))
}

/** Players not in any pairing. */
export function playersWithoutMatch(eventPlayers, pairings) {
  const paired = new Set((pairings ?? []).flatMap(p => [p.player_a_id, p.player_b_id]))
  return (eventPlayers ?? []).filter(ep => !paired.has(ep.player_id))
}

/** "Bryan Cappelli, Will Vuong (Group 1) · Mat Vigil (Group 4)". */
export function withoutMatchSummary(players) {
  const byGroup = new Map()
  for (const ep of players) {
    const key = ep.group_number ?? 0
    ;(byGroup.get(key) ?? byGroup.set(key, []).get(key)).push(fullName(ep))
  }
  return [...byGroup.entries()]
    .sort((a, b) => (a[0] || 1e9) - (b[0] || 1e9))
    .map(([g, names]) => `${names.join(', ')} (${g ? `Group ${g}` : 'no group'})`)
    .join(' · ')
}

/** The groups the two players of a pairing are in, and whether they differ. */
export function pairingGroups(pairing, epByPlayerId) {
  const a = epByPlayerId[pairing.player_a_id]?.group_number ?? null
  const b = epByPlayerId[pairing.player_b_id]?.group_number ?? null
  return { a, b, differ: a !== b, label: a === b ? (a ? `Group ${a}` : '—') : [a, b].map(g => (g ? `Group ${g}` : '—')).join(' / ') }
}

/**
 * Text for the tiebreak box under a match, or null when no box should show.
 * Only a match that finished all square after 18 (`result.tiedAfter18`) gets one; decided
 * matches, matches in progress and matches with no scores never do.
 */
export function tiebreakBox(result, nameA, nameB) {
  if (!result?.tiedAfter18) return null
  const winnerName = result.winner === 'A' ? nameA : result.winner === 'B' ? nameB : null
  const tb = result.tiebreak
  if (result.needsWinner) {
    return {
      headline: result.needsPuttOff ? 'Tied after 18 · Putt-off: pick the winner' : 'Tied after 18 · Pick the winner',
      detail: null,
      showSelect: true,
    }
  }
  if (tb && tb.by === 'manual') {
    return { headline: `Tied after 18 · ${winnerName} wins (decided by admin)`, detail: null, showSelect: true }
  }
  if (tb) {
    const mine = result.winner === 'A' ? tb.valueA : tb.valueB
    const theirs = result.winner === 'A' ? tb.valueB : tb.valueA
    return {
      headline: `Tied after 18 · ${winnerName} wins on tiebreak`,
      detail: `${tb.label}${tb.unit === 'net' ? ' (net)' : ''} ${mine} vs ${theirs}`,
      showSelect: true,
    }
  }
  return { headline: 'Tied after 18 · Halved (½ point each)', detail: null, showSelect: false }
}

/** "Net total, fewest putts, most net pars or better, putt-off" → "Net total → fewest putts → …". */
export function tiebreakOrderLabel(label) {
  return String(label ?? '').replace(/,\s*then\s*/i, ' → ').replace(/,\s*/g, ' → ')
}

/** Option text for the mobile "Group" menu: "Group 4 · 10:20 AM (1 open)". */
export function groupOptionLabel({ groupNumber, teeTime, count, size = 4 }) {
  const open = size - count
  const status = open <= 0 ? ' (full)' : ` (${open} open)`
  return `Group ${groupNumber}${teeTime ? ` · ${teeTime}` : ''}${status}`
}

/** Move one item up (-1) or down (+1); returns the same array when it can't move. */
export function moveItem(list, index, direction) {
  const to = index + direction
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list
  const next = [...list]
  ;[next[index], next[to]] = [next[to], next[index]]
  return next
}

/** A no-show stays in the field (bets, team play) with a fixed bad score on every hole. */
export const NO_SHOW_OVER_PAR = 5

/** Score rows for a no-show: par + 5 gross on each hole, tagged so they are never a "scorer". */
export function noShowScoreRows({ eventId, playerId, pars }) {
  return (pars ?? Array(18).fill(4)).map((par, i) => ({
    event_id: eventId,
    player_id: playerId,
    hole_number: i + 1,
    gross_score: par + NO_SHOW_OVER_PAR,
    putts: null,
    entered_by: NO_SHOW_ENTRY,
  }))
}
