/**
 * TGL (Team Golf League) Points Engine
 * Pure functions — no Supabase calls.
 *
 * Points formula: field_size - position + 1
 * Ties: combined place points split equally
 *   e.g. 2-way tie for 1st in 10-player field → (10 + 9) / 2 = 9.5 each
 *
 * Each event: 2 players per team contribute points.
 * Team event score = sum of their 2 players' individual points.
 */

/**
 * Assign individual TGL points from a ranked leaderboard.
 * @param {Array} ranked — sorted array of { player_id, rank } (rank 1 = best)
 *   Ties share the same rank. Use dense rank or competition rank — this function handles either.
 * @param {number} fieldSize — total number of players in the event
 * @returns {Object} playerId → points (number, may be .5)
 */
export function assignTGLPoints(ranked, fieldSize) {
  const points = {}

  // Group players by rank
  const byRank = {}
  for (const p of ranked) {
    const r = p.rank
    if (!byRank[r]) byRank[r] = []
    byRank[r].push(p.player_id)
  }

  // For each rank group, compute combined place points and split
  for (const [rankStr, playerIds] of Object.entries(byRank)) {
    const rank = parseInt(rankStr, 10)
    const count = playerIds.length

    // Places occupied: rank, rank+1, ..., rank+count-1
    let combined = 0
    for (let i = 0; i < count; i++) {
      const place = rank + i
      const pts = Math.max(0, fieldSize - place + 1)
      combined += pts
    }
    const perPlayer = combined / count

    for (const pid of playerIds) {
      points[pid] = perPlayer
    }
  }

  return points
}

/**
 * Compute TGL standings for a single event.
 *
 * @param {Array}  ranked           — from computeLeaderboards().ranked (has player_id, rank)
 * @param {Array}  tglSelections    — tgl_event_selections rows with { team_id, player_id }
 * @param {Array}  tglTeams         — tgl_teams rows with { id, name, color }
 * @param {Array}  tglMembers       — tgl_team_members rows with { team_id, player_id, player: {...} }
 * @returns {{ teamResults, playerPoints }}
 */
export function computeTGLEventResults(ranked, tglSelections, tglTeams, tglMembers) {
  const fieldSize = ranked.length
  const playerPoints = assignTGLPoints(ranked, fieldSize)

  // Map team_id → selected player_ids for this event
  const teamSelections = {}
  for (const sel of tglSelections) {
    if (!teamSelections[sel.team_id]) teamSelections[sel.team_id] = []
    teamSelections[sel.team_id].push(sel.player_id)
  }

  // Build per-team result
  const playerRankMap = Object.fromEntries(ranked.map(p => [p.player_id, p]))

  const teamResults = tglTeams.map(team => {
    const selectedIds = teamSelections[team.id] ?? []
    const players = selectedIds.map(pid => {
      const ep = playerRankMap[pid]
      return {
        player_id: pid,
        points: playerPoints[pid] ?? 0,
        rank: ep?.rank ?? null,
        name: ep ? `${ep.player?.first_name ?? ''} ${ep.player?.last_name ?? ''}`.trim() : pid,
      }
    })

    // Fill roster from members for display even if not selected
    const memberIds = (tglMembers ?? [])
      .filter(m => m.team_id === team.id)
      .map(m => m.player_id)

    const teamPoints = players.reduce((sum, p) => sum + p.points, 0)

    return {
      team,
      selectedPlayers: players,
      memberIds,
      teamPoints,
    }
  }).sort((a, b) => b.teamPoints - a.teamPoints)
    .map((t, i) => ({ ...t, rank: i + 1 }))

  return { teamResults, playerPoints }
}

/**
 * Compute season-long TGL standings across multiple events.
 *
 * @param {Array}  events           — array of { id, event_number, event_date, name }
 * @param {Array}  allEventResults  — array of computeTGLEventResults() outputs keyed by event_id
 *   Format: [{ event_id, teamResults }]
 * @param {Array}  tglTeams         — tgl_teams rows
 * @returns {Array} teams sorted by season total points (desc)
 */
export function computeTGLSeasonStandings(eventResultsByEventId, tglTeams) {
  const seasonPoints = {}  // team_id → total

  for (const [, { teamResults }] of Object.entries(eventResultsByEventId)) {
    for (const tr of teamResults) {
      seasonPoints[tr.team.id] = (seasonPoints[tr.team.id] ?? 0) + tr.teamPoints
    }
  }

  return tglTeams
    .map(team => ({
      team,
      seasonPoints: seasonPoints[team.id] ?? 0,
    }))
    .sort((a, b) => b.seasonPoints - a.seasonPoints)
    .map((t, i) => ({ ...t, rank: i + 1 }))
}
