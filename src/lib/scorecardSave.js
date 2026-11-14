/**
 * What "Save hole" should write for one hole of the live scorecard.
 *
 * A blank (or zero / unreadable) score is never turned into a number: that player is reported as
 * missing and nothing is written for them. Only players with a real score are saved.
 */

/**
 * @param {Array}    groupPlayers        event_players rows for the group, each with player_id and player
 * @param {Function} getScore            (playerId) => { gross, putts } as typed for the hole ('' when blank)
 * @returns {{ toSave: Array<{ ep, gross: number, putts: number|null }>, missing: Array }}
 */
export function splitHoleEntries(groupPlayers, getScore) {
  const toSave = []
  const missing = []
  for (const ep of groupPlayers ?? []) {
    const sc = getScore(ep.player_id) ?? {}
    const gross = parseInt(sc.gross, 10)
    if (!Number.isFinite(gross) || gross < 1) { missing.push(ep); continue }
    const putts = parseInt(sc.putts, 10)
    toSave.push({ ep, gross, putts: Number.isFinite(putts) ? putts : null })
  }
  return { toSave, missing }
}

/** The message shown when Save is tapped with one or more blank scores. */
export function missingScoresMessage(missing, groupSize, hole) {
  if (!missing?.length) return null
  if (missing.length === groupSize) return `Enter a score for hole ${hole} before saving.`
  const names = missing.map(ep => ep.player?.first_name?.trim() || 'a player')
  const list = names.length === 1 ? names[0]
    : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  return `No score entered for ${list} on hole ${hole}. Nothing was saved for them.`
}
