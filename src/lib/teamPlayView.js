/**
 * Display and rule helpers for the Team Play page. Pure functions (no React, no Supabase).
 *
 * Nothing here changes how team points are earned or added up: points come from
 * `computeTGLEventResults` exactly as before. These helpers only decide how those numbers are
 * ranked for display, which players can be picked, and when selections are locked.
 */

/** Players each team plays per event (the limit the page has always enforced). */
export const TEAM_SIZE = 2

/** 13.5 → "13.5", 14 → "14", null → "—". */
export function fmtPts(p) {
  if (p == null || !Number.isFinite(Number(p))) return '—'
  const n = Number(p)
  return n % 1 === 0 ? String(n) : n.toFixed(1)
}

/**
 * Selections are locked once the event is complete, or when someone used the pre-round lock.
 * Returns { locked, reason: 'complete' | 'manual' | null }.
 */
export function lockState(event, tglLocked) {
  if (event?.status === 'complete') return { locked: true, reason: 'complete' }
  if (tglLocked) return { locked: true, reason: 'manual' }
  return { locked: false, reason: null }
}

/** Why a pick is not allowed (a message), or null when it is. Mirrors the rules the page enforces. */
export function selectionBlock({ lock, registered, teamFull, otherTeamName }) {
  if (lock?.locked) return lock.reason === 'complete' ? 'This event is complete. Re-open it to change team selections.' : 'Selections are locked. Unlock to make changes.'
  if (!registered) return 'That player is not registered for this event.'
  if (otherTeamName) return `Already selected for ${otherTeamName} this event.`
  if (teamFull) return `Max ${TEAM_SIZE} players per team per event.`
  return null
}

/** Competition ranking for display: 11, 11, 9 → #1, #1, #3. Teams with no points yet get no rank. */
export function sharedRanks(teamResults) {
  const sorted = [...teamResults].sort((a, b) => b.teamPoints - a.teamPoints)
  return sorted.map((t, i) => ({
    ...t,
    displayRank: i > 0 && t.teamPoints === sorted[i - 1].teamPoints ? null : i + 1,
  })).reduce((acc, t, i, arr) => {
    // ties inherit the rank of the first team with the same points
    acc.push({ ...t, displayRank: t.displayRank ?? acc[i - 1].displayRank })
    return acc
  }, [])
}

/**
 * The Standings rows.
 *   With scores:   teams highest first, shared rank on ties, a bar filled to (points ÷ leader's points).
 *   Before scores: teams in roster order, no rank, no points, empty bars.
 * `eventResults` is the object `computeTGLEventResults` returns (or null before scores exist).
 */
export function standingsRows({ eventResults, tglTeams }) {
  if (!eventResults) {
    return tglTeams.map(team => ({ team, rank: null, points: null, fraction: 0, players: [] }))
  }
  const ranked = sharedRanks(eventResults.teamResults)
  const leader = ranked[0]?.teamPoints ?? 0
  return ranked.map(t => ({
    team: t.team,
    rank: t.displayRank,
    points: t.teamPoints,
    fraction: leader > 0 ? t.teamPoints / leader : 0,
    players: t.selectedPlayers.map(p => ({ id: p.player_id, name: p.name, points: p.points })),
  }))
}

/** The four stat tiles. `final` = event complete. */
export function teamTiles({ rows, selectedCount, final }) {
  const teams = rows.length
  const required = teams * TEAM_SIZE
  const open = Math.max(0, required - selectedCount)
  const scored = rows.some(r => r.points != null)

  let winner = { value: '—', helper: 'No scores yet' }
  if (scored) {
    const top = rows.filter(r => r.rank === 1)
    const second = rows.find(r => r.rank !== 1)
    const pts = top[0].points
    winner = top.length > 1
      ? { value: top.map(r => r.team.name).join(' & '), helper: `Tied · ${fmtPts(pts)} pts` }
      : { value: top[0].team.name, helper: `${fmtPts(pts)} pts${second ? ` · ${final ? 'won' : 'leads'} by ${fmtPts(pts - second.points)}` : ''}` }
  }

  const totalPoints = rows.reduce((s, r) => s + (r.points ?? 0), 0)
  const playersWithPoints = rows.reduce((s, r) => s + r.players.length, 0)
  return [
    { label: 'Teams', value: teams, helper: `${TEAM_SIZE} players each this event` },
    { label: 'Selections', value: `${selectedCount} of ${required}`, helper: open === 0 ? 'All teams full' : `${open} spot${open !== 1 ? 's' : ''} open`, tone: open > 0 ? 'warn' : 'neutral' },
    { label: final ? 'Winner' : 'Leader', value: winner.value, helper: winner.helper },
    { label: 'Points awarded', value: scored ? fmtPts(totalPoints) : '—', helper: scored ? `Across ${playersWithPoints} players` : 'No scores yet' },
  ]
}

/**
 * One team's selection card.
 *   selected: the players picked for this event (with their points)
 *   rest:     every other roster member — registered players first and pickable, then the rest,
 *             each with why they can't be picked (not registered / on another team / team full)
 */
export function teamSelection({ team, members, selections, allSelections, teams, registeredIds, pointsByPlayer, lock }) {
  const mine = new Set(members.map(m => m.player_id))
  const selectedIds = new Set(selections.filter(s => s.team_id === team.id && mine.has(s.player_id)).map(s => s.player_id))
  const nameOf = m => `${m.player?.first_name ?? ''} ${m.player?.last_name ?? ''}`.trim()
  const teamFull = selectedIds.size >= TEAM_SIZE

  const selected = members.filter(m => selectedIds.has(m.player_id)).map(m => ({
    player_id: m.player_id, name: nameOf(m), points: pointsByPlayer?.[m.player_id] ?? null,
  }))

  const rest = members.filter(m => !selectedIds.has(m.player_id)).map(m => {
    const registered = registeredIds.has(m.player_id)
    const other = allSelections.find(s => s.player_id === m.player_id && s.team_id !== team.id)
    const otherTeamName = other ? teams.find(t => t.id === other.team_id)?.name ?? 'another team' : null
    const block = selectionBlock({ lock, registered, teamFull, otherTeamName })
    return {
      player_id: m.player_id, name: nameOf(m), registered, otherTeamName, otherSelectionId: other?.id ?? null,
      disabled: !!block, reason: block,
    }
  }).sort((a, b) => Number(b.registered) - Number(a.registered))

  return { selected, rest, required: TEAM_SIZE, count: selectedIds.size, full: teamFull }
}
