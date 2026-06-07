/**
 * Skins Engine — net skins, computed per flight.
 *
 * Rules:
 *  1. Net score per hole per player is computed first.
 *  2. Sole lowest net on a hole → wins that hole's skin.
 *  3. Tie → hole carries over to the next hole.
 *  4. Carryover accumulates until a solo winner claims all carried skins.
 *  5. WRAPAROUND: unresolved skins after hole 18 → awarded to the player
 *     who won their first skin EARLIEST in the round.
 *  6. If NO player won any skin → pot carries to next event (flagged).
 *  7. Flight A and Flight B are independent.
 */

import { getStrokesOnHole } from './scoring.js'

/**
 * Compute skins for one flight.
 *
 * @param {Array}  eventPlayers   — event_players rows filtered to this flight,
 *                                  each with .course_handicap and .player_id
 * @param {Array}  allScores      — all scores rows for the event
 * @param {number[]} strokeIndexes — 18-element stroke-index array (index 0 = hole 1)
 * @param {string} flight         — 'A' | 'B'
 * @returns {{ holes, playerSkins, carryoverToNext, carryoverAmount }}
 */
export function computeSkinsForFlight(eventPlayers, allScores, strokeIndexes, flight) {
  const flightPlayers = eventPlayers.filter(ep => ep.flight === flight)
  if (flightPlayers.length === 0) {
    return { holes: [], playerSkins: {}, carryoverToNext: false, carryoverAmount: 0 }
  }

  // Build net score per player per hole
  const netByHole = {}    // { holeNum: { playerId: netScore } }
  for (let h = 1; h <= 18; h++) {
    netByHole[h] = {}
    for (const ep of flightPlayers) {
      const s = allScores.find(x => x.player_id === ep.player_id && x.hole_number === h)
      if (s) {
        const strokes = getStrokesOnHole(ep.course_handicap ?? 0, strokeIndexes[h - 1])
        netByHole[h][ep.player_id] = s.gross_score - strokes
      }
    }
  }

  const holeResults = []
  let carryover   = 0
  let firstWinnerPlayerId = null
  let firstWinnerResultIdx = -1

  for (let h = 1; h <= 18; h++) {
    const holeScores  = netByHole[h]
    const playerIds   = Object.keys(holeScores)

    // Not enough scores entered yet — treat as incomplete, carry
    if (playerIds.length < flightPlayers.length) {
      holeResults.push({
        hole:       h,
        winner:     null,
        tied:       false,
        incomplete: true,
        skinsWon:   0,
        carryoverIn: carryover,
        resolved:   false,
        netScores:  holeScores,
      })
      // Don't advance carryover for incomplete holes (scoring in progress)
      continue
    }

    const minNet  = Math.min(...playerIds.map(id => holeScores[id]))
    const winners = playerIds.filter(id => holeScores[id] === minNet)

    if (winners.length === 1) {
      const winnerId = winners[0]
      const skinsWon = carryover + 1

      const resultIdx = holeResults.length
      if (firstWinnerPlayerId === null) {
        firstWinnerPlayerId  = winnerId
        firstWinnerResultIdx = resultIdx
      }

      holeResults.push({
        hole:        h,
        winner:      winnerId,
        tied:        false,
        incomplete:  false,
        skinsWon,
        carryoverIn: carryover,
        resolved:    true,
        netScores:   holeScores,
      })
      carryover = 0
    } else {
      // Tie — carry over
      holeResults.push({
        hole:        h,
        winner:      null,
        tied:        true,
        tiedPlayers: winners,
        incomplete:  false,
        skinsWon:    0,
        carryoverIn: carryover,
        resolved:    false,
        netScores:   holeScores,
      })
      carryover++
    }
  }

  // Wraparound: carryover remaining after hole 18
  const carryoverToNext = carryover > 0 && firstWinnerPlayerId === null

  if (carryover > 0 && firstWinnerPlayerId !== null) {
    // Award to first skin winner of the round
    holeResults[firstWinnerResultIdx].skinsWon    += carryover
    holeResults[firstWinnerResultIdx].wraparound   = carryover
    carryover = 0
  }

  // Build player skin totals
  const playerSkins = {}
  flightPlayers.forEach(ep => { playerSkins[ep.player_id] = 0 })
  holeResults.forEach(r => {
    if (r.winner && r.skinsWon > 0) {
      playerSkins[r.winner] = (playerSkins[r.winner] ?? 0) + r.skinsWon
    }
  })

  return {
    holes: holeResults,
    playerSkins,
    carryoverToNext,
    carryoverAmount: carryoverToNext ? carryover : 0,
  }
}

/**
 * Compute skins for both flights.
 */
export function computeAllSkins(eventPlayers, allScores, strokeIndexes) {
  return {
    A: computeSkinsForFlight(eventPlayers, allScores, strokeIndexes, 'A'),
    B: computeSkinsForFlight(eventPlayers, allScores, strokeIndexes, 'B'),
  }
}

/**
 * Given a skins result for one flight and the skins pot amount,
 * return per-player payout.
 *
 * @param {Object} skinsResult   — from computeSkinsForFlight
 * @param {number} skinsPot      — dollar amount allocated to skins for this flight
 * @returns {Array<{playerId, skinsWon, perSkinValue, total}>}
 */
export function computeSkinsPayout(skinsResult, skinsPot) {
  const { playerSkins } = skinsResult
  const totalSkins = Object.values(playerSkins).reduce((a, b) => a + b, 0)
  if (totalSkins === 0 || skinsPot <= 0) return []

  const perSkin = skinsPot / totalSkins

  return Object.entries(playerSkins)
    .filter(([, count]) => count > 0)
    .map(([playerId, skinsWon]) => ({
      playerId,
      skinsWon,
      perSkinValue: perSkin,
      total:        Math.round(skinsWon * perSkin * 100) / 100,
    }))
}
