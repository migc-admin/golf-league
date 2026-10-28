/**
 * Wager settlement — pool totals, odds inputs, and who gets paid what.
 *
 * Pure functions (no React, no Supabase) so the money math can be unit tested and
 * reused by both the admin board and the Excel export.
 *
 *   WIN   — pays bettors who picked the 1st-place (lowest net) finisher
 *   PLACE — North American pari-mutuel: pick must finish 1st OR 2nd; the pool is
 *           split 50/50 between the 1st- and 2nd-place groups; each winner gets
 *           their stake back plus a pro-rata share of their group's half of the profit.
 *           If only one of the two places has bettors, those bettors get ALL of the profit
 *           (the whole pool is paid out). It rolls to the club only when nobody hit.
 *   MATCH — each match is its own two-way pool; winners split it pro rata, a
 *           halved match refunds every stake, no backers on the winner rolls to the club.
 *           When the event requires a winner, a tied match is decided by the tiebreakers
 *           or the admin's manual pick (and stays Pending until one of them decides it).
 */
import { computeMatchPoints } from './engines/matchPoints'

export function computeWagerSettlement({ active, players, scores, pairings, course, matchRules = null }) {
  // Pool math — active only
  const winPool   = active.filter(w => w.pick_1st).reduce((s, w) => s + parseFloat(w.amount), 0)
  const placePool = active.filter(w => w.pick_2nd).reduce((s, w) => s + parseFloat(w.amount), 0)
  const totalPot  = winPool + placePool

  const winTotals   = {}
  const placeTotals = {}
  for (const w of active) {
    if (w.pick_1st) winTotals[w.pick_1st]   = (winTotals[w.pick_1st]   ?? 0) + parseFloat(w.amount)
    if (w.pick_2nd) placeTotals[w.pick_2nd] = (placeTotals[w.pick_2nd] ?? 0) + parseFloat(w.amount)
  }

  const allPickedIds = [...new Set([...Object.keys(winTotals), ...Object.keys(placeTotals)])]
    .sort((a, b) => ((winTotals[b] ?? 0) + (placeTotals[b] ?? 0)) - ((winTotals[a] ?? 0) + (placeTotals[a] ?? 0)))

  // ── Winner calculation ─────────────────────────────────────────────
  // WIN:   pays bettors who picked the 1st place (lowest net) finisher
  // PLACE: North American pari-mutuel — selection must finish 1st OR 2nd.
  //        Pool is split 50/50 between the 1st-place group and 2nd-place group.
  //        Each bettor gets their stake back + proportional share of their group's profit half.
  //        Dead heats: tied players share their group's half proportionally.
  let winResults   = null
  let placeResults = null

  if (scores.length > 0) {
    const grossByPlayer = {}
    for (const s of scores) {
      if (s.gross_score != null)
        grossByPlayer[s.player_id] = (grossByPlayer[s.player_id] ?? 0) + s.gross_score
    }
    const netByPlayer = {}
    for (const ep of players) {
      if (grossByPlayer[ep.player_id] != null) {
        const ch = ep.course_handicap ?? ep.adjusted_handicap_index ?? 0
        netByPlayer[ep.player_id] = grossByPlayer[ep.player_id] - ch
      }
    }

    // Sort all scored players by net ascending
    const allSorted = Object.entries(netByPlayer).sort((a, b) => a[1] - b[1])
    if (allSorted.length === 0) { /* no scores yet */ }
    else {
      // 1st place: lowest net (may be multiple tied)
      const net1 = allSorted[0][1]
      const place1Players = allSorted.filter(([, n]) => n === net1).map(([id]) => id)

      // 2nd place: next distinct net score (may be multiple tied)
      // If 2+ players tie for 1st, they occupy both 1st and 2nd — no separate 2nd group
      const twoWayTieForFirst = place1Players.length >= 2
      let place2Players = []
      let net2 = null
      if (!twoWayTieForFirst) {
        const secondEntry = allSorted.find(([, n]) => n > net1)
        if (secondEntry) {
          net2 = secondEntry[1]
          place2Players = allSorted.filter(([, n]) => n === net2).map(([id]) => id)
        }
      }

      // ── WIN pool ──────────────────────────────────────────────────
      const winBettors = active.filter(w => w.pick_1st && place1Players.includes(w.pick_1st))
      if (winBettors.length > 0) {
        const totalStake = winBettors.reduce((s, w) => s + parseFloat(w.amount), 0)
        winResults = {
          net: net1,
          matched: true,
          topPlayers: place1Players, // everyone tied for the lowest net (display only; no math uses it)
          bettors: winBettors.map(w => ({
            id:     w.id,
            name:   w.bettor_name,
            pid:    w.pick_1st,
            bet:    parseFloat(w.amount),
            payout: Math.floor((parseFloat(w.amount) / totalStake) * winPool * 100) / 100,
          })),
        }
      } else {
        winResults = { net: net1, matched: false, topPlayers: place1Players }
      }

      // ── PLACE pool ────────────────────────────────────────────────
      // Group 1 = bettors who picked 1st place finisher(s)
      // Group 2 = bettors who picked 2nd place finisher(s)
      // (If 2-way tie for 1st, group1 = tied player A bettors, group2 = tied player B bettors)
      let g1Players, g2Players
      if (twoWayTieForFirst) {
        // Two tied players fill 1st and 2nd — treat each tied player as their own group
        g1Players = [place1Players[0]]
        g2Players = place1Players.slice(1) // remaining tied players
      } else {
        g1Players = place1Players
        g2Players = place2Players
      }

      const g1Bettors = active.filter(w => w.pick_2nd && g1Players.includes(w.pick_2nd))
      const g2Bettors = active.filter(w => w.pick_2nd && g2Players.includes(w.pick_2nd))
      const s1 = g1Bettors.reduce((s, w) => s + parseFloat(w.amount), 0)
      const s2 = g2Bettors.reduce((s, w) => s + parseFloat(w.amount), 0)

      const hasG1 = g1Bettors.length > 0
      const hasG2 = g2Bettors.length > 0

      if (!hasG1 && !hasG2) {
        // Nobody bet on 1st or 2nd place finishers
        placeResults = {
          net: net1, net2: twoWayTieForFirst ? net1 : net2,
          matched: false,
          topPlayers: [...g1Players, ...g2Players],
        }
      } else {
        // Profit = pool minus stakes returned to both groups
        const stakesReturned = (hasG1 ? s1 : 0) + (hasG2 ? s2 : 0)
        const profit = placePool - stakesReturned
        // Both places have bettors: each group gets half the profit. Only one place has bettors:
        // they get all of it, so the whole pool is paid out. (Nobody hit → handled above, rolls to the club.)
        const bothGroups = hasG1 && hasG2
        const groupProfit = bothGroups ? profit / 2 : profit

        function placePayouts(bettors, groupStake, groupHalfProfit) {
          return bettors.map(w => {
            const bet = parseFloat(w.amount)
            const profitShare = groupStake > 0 ? Math.floor((bet / groupStake) * groupHalfProfit * 100) / 100 : 0
            return {
              id:     w.id,
              name:   w.bettor_name,
              pid:    w.pick_2nd,
              bet,
              payout: Math.floor((bet + profitShare) * 100) / 100,
            }
          })
        }

        placeResults = {
          net: net1,
          net2: twoWayTieForFirst ? net1 : net2,
          twoWayTie: twoWayTieForFirst,
          matched: true,
          g1: { players: g1Players, bettors: hasG1 ? placePayouts(g1Bettors, s1, groupProfit) : [], hasMatch: hasG1 },
          g2: { players: g2Players, bettors: hasG2 ? placePayouts(g2Bettors, s2, groupProfit) : [], hasMatch: hasG2 },
          allProfitToOneGroup: !bothGroups,
        }
      }
    }
  }

  // ── Match play wagers ───────────────────────────────────────────────
  // Each match is its own two-way pool. Winning side splits the whole pool
  // pro rata to stake. A halved match refunds every stake. If nobody backed
  // the winner, the pool rolls to the club (same rule as WIN).
  const matchResultByKey = {}
  if (pairings.length > 0 && course) {
    const mr = computeMatchPoints(players, scores, course, pairings, matchRules)
    for (const r of mr.pairings) matchResultByKey[`${r.playerA.player_id}|${r.playerB.player_id}`] = r
  }
  const matchCards = pairings.map(m => {
    const bets = active.filter(w => w.match_pairing_id === m.id)
    const sideAmt = { [m.player_a_id]: 0, [m.player_b_id]: 0 }
    for (const w of bets) sideAmt[w.pick_match] = (sideAmt[w.pick_match] ?? 0) + parseFloat(w.amount)
    const pool = (sideAmt[m.player_a_id] ?? 0) + (sideAmt[m.player_b_id] ?? 0)
    const result = matchResultByKey[`${m.player_a_id}|${m.player_b_id}`] ?? null
    const winnerPid = result?.winner === 'A' ? m.player_a_id : result?.winner === 'B' ? m.player_b_id : null

    let settlement = null
    if (result?.winner === 'halve') {
      settlement = { type: 'refund', bettors: bets.map(w => ({ id: w.id, name: w.bettor_name, pid: w.pick_match, bet: parseFloat(w.amount), payout: parseFloat(w.amount) })) }
    } else if (winnerPid) {
      const winners = bets.filter(w => w.pick_match === winnerPid)
      const stake = winners.reduce((sum, w) => sum + parseFloat(w.amount), 0)
      settlement = winners.length === 0
        ? { type: 'club', winnerPid }
        : {
            type: 'paid',
            winnerPid,
            bettors: winners.map(w => ({
              id: w.id, name: w.bettor_name, pid: w.pick_match, bet: parseFloat(w.amount),
              payout: Math.floor((parseFloat(w.amount) / stake) * pool * 100) / 100,
            })),
          }
    }
    return { match: m, bets, sideAmt, pool, result, settlement }
  })
  const matchPoolTotal = matchCards.reduce((sum, c) => sum + c.pool, 0)

  return {
    winPool, placePool, totalPot, winTotals, placeTotals, allPickedIds,
    winResults, placeResults, matchCards, matchPoolTotal,
  }
}

/**
 * Per-bet outcome for every active wager: { result, payout, provisional }.
 *   result: 'Won' | 'Lost' | 'Refund' | 'Pending'
 *   provisional: true while WIN/PLACE results can still change (event not complete)
 * Match results are decided once the match is over, so they are never provisional.
 */
export function wagerOutcomes(settlement, active, eventStatus) {
  const { winResults, placeResults, matchCards } = settlement
  const final = eventStatus === 'complete'
  const out = {}

  const paid = new Map()
  for (const b of winResults?.bettors ?? []) paid.set(b.id, b.payout)
  for (const g of [placeResults?.g1, placeResults?.g2]) {
    for (const b of g?.bettors ?? []) paid.set(b.id, b.payout)
  }
  const matchPaid = new Map(), matchRefund = new Set(), matchLost = new Set(), matchPending = new Set()
  for (const c of matchCards) {
    for (const w of c.bets) {
      if (!c.settlement) matchPending.add(w.id)
      else if (c.settlement.type === 'refund') matchRefund.add(w.id)
      else if (c.settlement.type === 'paid') {
        const b = c.settlement.bettors.find(x => x.id === w.id)
        if (b) matchPaid.set(w.id, b.payout); else matchLost.add(w.id)
      } else matchLost.add(w.id) // rolls to club: nobody backed the winner
    }
  }

  for (const w of active) {
    if (w.match_pairing_id) {
      if (matchPending.has(w.id))      out[w.id] = { result: 'Pending', payout: 0, provisional: false }
      else if (matchRefund.has(w.id))  out[w.id] = { result: 'Refund', payout: parseFloat(w.amount), provisional: false }
      else if (matchPaid.has(w.id))    out[w.id] = { result: 'Won', payout: matchPaid.get(w.id), provisional: false }
      else                             out[w.id] = { result: 'Lost', payout: 0, provisional: false }
      continue
    }
    const hasResults = w.pick_1st ? winResults != null : placeResults != null
    if (!hasResults)         out[w.id] = { result: 'Pending', payout: 0, provisional: false }
    else if (paid.has(w.id)) out[w.id] = { result: 'Won', payout: paid.get(w.id), provisional: !final }
    else                     out[w.id] = { result: 'Lost', payout: 0, provisional: !final }
  }
  return out
}
