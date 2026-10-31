/**
 * Tournament results as plain data, for the results PNG and the results email.
 *
 * Nothing here calculates anything new: leaderboards, skins, payouts and match play all come from the
 * same engines the old results card used, with the same arguments. This file only decides how those
 * numbers are grouped for display (flight columns, place rows with TIE flags, margin pills).
 */
import { computeLeaderboards, computeStableford, computeBlindPartners } from './engines/scoring'
import { computeAllSkins, computeSuperSkins } from './engines/skins'
import { computePayouts } from './engines/payouts'
import { computeMatchPoints, computeTeamMatchPoints } from './engines/matchPoints'

export const money = n => `$${Number(n ?? 0).toFixed(2)}`

const RANK_SUFF = ['1st', '2nd', '3rd']

// How each scoring format is shown. `lb` is the computeLeaderboards key, `prefix` the payout key prefix.
const SCORING = {
  net_stroke:          { label: '18-hole',        score: 'Net',    lb: 'full',        prefix: '18_net',   value: e => e.net18 },
  net_stroke_front9:   { label: 'Front 9',        score: 'Out',    lb: 'front9',      prefix: 'f9',       value: e => e.netF9 },
  net_stroke_back9:    { label: 'Back 9',         score: 'In',     lb: 'back9',       prefix: 'b9',       value: e => e.netB9 },
  low_gross:           { label: '18-hole gross',  score: 'Gross',  lb: 'grossFull',   prefix: '18_gross', value: e => e.gross18 },
  gross_stroke_front9: { label: 'Front 9 gross',  score: 'Out',    lb: 'grossFront9', prefix: 'gf9',      value: e => e.grossF9 },
  gross_stroke_back9:  { label: 'Back 9 gross',   score: 'In',     lb: 'grossBack9',  prefix: 'gb9',      value: e => e.grossB9 },
  stableford:          { label: 'Stableford',     score: 'Points', lb: 'stableford',  prefix: 'stf_net',  value: e => e.totalPoints },
  stableford_gross:    { label: 'Stableford gross', score: 'Points', lb: 'stableford_gross', prefix: 'stf_gross', value: e => e.totalPoints },
}

export function playerFullName(ep) {
  return `${ep?.player?.first_name ?? ''} ${ep?.player?.last_name ?? ''}`.trim() || '—'
}

export function longDateText(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : ''
}
export function shortDateText(d) {
  return d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : ''
}

/** Net/gross scores and the money for one event, ready to lay out. `course` is required. */
export function buildResultsView({ event, eventPlayers, allScores, course, sideGames = [], matchPairings = [] }) {
  const nonGuests = eventPlayers.filter(ep => !ep.is_guest)
  const sides = event.side_game_options ?? []
  const flights = [...new Set(nonGuests.map(ep => ep.flight).filter(Boolean))].sort()
  const hasFlights = flights.length > 0
  const formats = event.formats ?? []

  const leaderboards = computeLeaderboards(nonGuests, allScores, course)
  const stablefordData = computeStableford(nonGuests, allScores, course)
  const stablefordGrossData = computeStableford(nonGuests, allScores, course, true)
  const blindPartnersData = computeBlindPartners(event, nonGuests, allScores, course)

  const hasMatchPoints = formats.includes('match_points') || formats.includes('ryder_cup')
  const hasTeamMatchPlay = formats.includes('team_match_play')
  const matchData = hasMatchPoints ? computeMatchPoints(nonGuests, allScores, course, matchPairings, event.match_rules) : null
  const teamMatchData = hasTeamMatchPlay ? computeTeamMatchPoints(nonGuests, allScores, course, event.team_match_config ?? null) : null

  const skinsResults = computeAllSkins(nonGuests, allScores, course)
  const superSkinsResult = computeSuperSkins(event, nonGuests, allScores, course)

  const playerMap = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
  const name = pid => (playerMap[pid] ? playerFullName(playerMap[pid]) : '—')

  const flightCounts = {}
  nonGuests.forEach(ep => { if (ep.flight) flightCounts[ep.flight] = (flightCounts[ep.flight] ?? 0) + 1 })
  const payout = computePayouts(event, nonGuests.length, leaderboards, sideGames, skinsResults, flightCounts, {
    stablefordData, blindPartnersData, superSkinsResult, stablefordGrossData, eventPlayers: nonGuests,
  })

  // catAmt[categoryKey][playerId] = amount for that specific result (same rules as the old results card)
  const catAmt = {}
  payout.byCategory.forEach(cat => {
    if (cat.isSkin) {
      const baseKey = cat.key.replace(/_[^_]+$/, '')
      ;(catAmt[baseKey] ??= {})[cat.playerId] = cat.amount
    } else if (cat.playerIds?.length > 1) {
      const split = Math.floor((cat.amount / cat.playerIds.length) * 100) / 100
      catAmt[cat.key] ??= {}
      cat.playerIds.forEach(pid => { catAmt[cat.key][pid] = split })
    } else {
      catAmt[cat.key] ??= {}
      if (cat.playerId) catAmt[cat.key][cat.playerId] = cat.amount
    }
  })
  const amt = (pid, key) => (key ? catAmt[key]?.[pid] ?? null : null)
  const playerTotal = pid => payout.byPlayer.find(p => p.playerId === pid)?.total ?? 0
  const paidCount = payout.byPlayer.filter(p => p.total > 0).length

  // ── Net stroke play (and the other scoring formats) ───────────────
  const scoringKeys = [...new Set(formats.map(f => f.replace(/_[a-z]$/, '')))].filter(f => SCORING[f])
  const payoutPlaces = event.payout_places ?? {}
  const scoringData = { ...leaderboards, stableford: stablefordData, stableford_gross: stablefordGrossData }
  let scoring = null
  if (scoringKeys.length > 0) {
    const columnFlights = hasFlights ? flights : [null]
    const columns = columnFlights.map(fl => ({
      flight: fl,
      count: fl ? nonGuests.filter(ep => ep.flight === fl).length : nonGuests.length,
      blocks: scoringKeys.map(fmt => {
        const def = SCORING[fmt]
        const lbEntry = scoringData[def.lb] ?? {}
        const list = fl ? (lbEntry[fl] ?? []) : (lbEntry.A ?? lbEntry[Object.keys(lbEntry)[0]] ?? [])
        const places = Math.min(payoutPlaces[fmt] ?? 3, 3)
        const rows = []
        for (let rank = 1; rank <= places; rank++) {
          const tied = list.filter(p => p.rank === rank)
          tied.forEach(p => {
            const key = fl ? `${def.prefix}_${fl.toLowerCase()}_${RANK_SUFF[rank - 1]}` : `${def.prefix}_${RANK_SUFF[rank - 1]}`
            rows.push({
              place: RANK_SUFF[rank - 1],
              name: name(p.player_id),
              tie: tied.length > 1,
              score: def.value(p) ?? null,
              amount: amt(p.player_id, key),
            })
          })
        }
        return { fmt, label: def.label, scoreLabel: def.score, rows }
      }),
    }))
    const allNet = scoringKeys.every(k => ['net_stroke', 'net_stroke_front9', 'net_stroke_back9'].includes(k))
    scoring = { title: allNet ? 'Net stroke play' : 'Scoring results', scoreHeader: allNet ? 'Out · In · Net' : null, columns }
  }

  // ── Skins ────────────────────────────────────────────────────────
  const skinsSides = sides.filter(s => s === 'skins' || /^skins_[a-z]$/.test(s))
  let skins = null
  if (skinsSides.length > 0) {
    const skinFlights = skinsSides.map(k => k.match(/^skins_([a-z])$/)?.[1]?.toUpperCase()).filter(Boolean)
    const column = (fl, key, result) => {
      const winners = Object.entries(result?.playerSkins ?? {}).filter(([, n]) => n > 0).sort(([, a], [, b]) => b - a)
      const rows = winners.map(([pid, count]) => ({ count, name: name(pid), amount: amt(pid, key) }))
      const first = rows.find(r => r.amount != null)
      return { flight: fl, rows, perSkin: first ? first.amount / first.count : null, empty: winners.length === 0 }
    }
    const columns = skinFlights.length > 1
      ? skinFlights.map(fl => column(fl, `skins_${fl.toLowerCase()}`, skinsResults?.[fl]))
      : skinsSides.map(key => {
          const fl = key.match(/^skins_([a-z])$/)?.[1]?.toUpperCase() ?? null
          const result = fl ? skinsResults?.[fl] : (skinsResults?.[''] ?? Object.values(skinsResults ?? {})[0])
          return column(fl, key, result)
        })
    skins = { columns, perFlight: columns.length > 1 }
  }

  // ── Closest to pin ───────────────────────────────────────────────
  const ctpHoles = Object.keys(event.payout_config ?? {})
    .filter(k => k.startsWith('ctp_')).map(k => parseInt(k.replace('ctp_', ''), 10)).sort((a, b) => a - b)
  let ctp = null
  if (sides.includes('ctp') && ctpHoles.length > 0) {
    const rows = ctpHoles.map(h => {
      const g = sideGames.find(x => x.game_type === 'ctp' && x.hole_number === h)
      return { hole: h, name: g?.winner_player_id ? name(g.winner_player_id) : '—', amount: g?.winner_player_id ? amt(g.winner_player_id, `ctp_${h}`) : null }
    })
    const prizes = [...new Set(rows.map(r => r.amount).filter(v => v != null))]
    ctp = { rows, prize: prizes.length === 1 ? prizes[0] : null }
  }

  // ── Long drive ───────────────────────────────────────────────────
  const ldSides = sides.filter(s => s === 'long_drive' || /^long_drive_[a-z]$/.test(s))
  let longDrive = null
  if (ldSides.length > 0) {
    longDrive = {
      hole: event.long_drive_hole ?? null,
      rows: ldSides.map(key => {
        const fl = key.match(/^long_drive_([a-z])$/)?.[1]?.toUpperCase() ?? null
        const g = sideGames.find(x => x.game_type === 'long_drive' && (fl ? x.flight === fl : !x.flight || x.flight === 'overall'))
        const k = fl ? `long_drive_${fl.toLowerCase()}` : 'long_drive'
        return { label: fl ?? 'All', name: g?.winner_player_id ? name(g.winner_player_id) : '—', amount: g?.winner_player_id ? amt(g.winner_player_id, k) : null }
      }),
    }
  }

  // ── Low putts ────────────────────────────────────────────────────
  const lpSides = sides.filter(s => s === 'low_putts' || /^low_putts_[a-z]$/.test(s))
  let lowPutts = null
  if (lpSides.length > 0) {
    const rows = []
    lpSides.forEach(key => {
      const fl = key.match(/^low_putts_([a-z])$/)?.[1]?.toUpperCase() ?? null
      const manual = sideGames.find(x => x.game_type === 'low_putts' && (fl ? x.flight === fl : true))?.winner_player_id
      const k = fl ? `low_putts_${fl.toLowerCase()}` : 'low_putts'
      if (manual) {
        rows.push({ flight: fl, name: name(manual), tie: false, amount: amt(manual, k) })
      } else if (!fl && leaderboards.putts?.length > 0) {
        const top = leaderboards.putts[0]
        const tied = leaderboards.putts.filter(p => p.rank === top.rank)
        tied.forEach(p => rows.push({ flight: null, name: name(p.player_id), tie: tied.length > 1, amount: amt(p.player_id, k) }))
      } else {
        rows.push({ flight: fl, name: '—', tie: false, amount: null })
      }
    })
    lowPutts = { rows }
  }

  // ── Games that only some events use: same card style, plain label | name | amount rows ─────────
  const extras = []
  const nassauNet = formats.includes('net_stroke_nassau')
  const nassauGross = formats.includes('gross_stroke_nassau')
  if (nassauNet || nassauGross) {
    const winnerRow = (label, lbKey, key) => {
      const list = [...(leaderboards[lbKey]?.A ?? []), ...(leaderboards[lbKey]?.B ?? [])].filter(p => p.rank === 1)
      return list.length
        ? list.map(p => ({ label, name: name(p.player_id), tie: list.length > 1, amount: amt(p.player_id, key) }))
        : [{ label, name: '—', amount: null }]
    }
    const rows = []
    if (nassauNet) rows.push(...winnerRow('Front 9 · Net', 'front9', 'nassau_net_f9'), ...winnerRow('Back 9 · Net', 'back9', 'nassau_net_b9'), ...winnerRow('Full 18 · Net', 'full', 'nassau_net_18'))
    if (nassauGross) rows.push(...winnerRow('Front 9 · Gross', 'grossFront9', 'nassau_gross_f9'), ...winnerRow('Back 9 · Gross', 'grossBack9', 'nassau_gross_b9'), ...winnerRow('Full 18 · Gross', 'grossFull', 'nassau_gross_18'))
    extras.push({ title: 'Nassau', rows })
  }

  const superSkinsKey = sides.find(s => s === 'super_skins' || /^super_skins_[a-z]$/.test(s))
  if (superSkinsKey && superSkinsResult) {
    const perFlight = /^super_skins_[a-z]$/.test(superSkinsKey) && superSkinsResult.A.entrantCount > 0 && superSkinsResult.B.entrantCount > 0
    const rows = []
    const add = (fl, result, key) => {
      const winners = Object.entries(result.playerSkins).filter(([, n]) => n > 0).sort(([, a], [, b]) => b - a)
      if (winners.length === 0) rows.push({ label: fl ? `Flight ${fl}` : 'Super skins', name: result.carryoverToNext ? `No skins won — ${result.carryoverAmount} carry to next event` : 'No skins won', amount: null })
      winners.forEach(([pid, n]) => rows.push({ label: `${fl ? `Flight ${fl} · ` : ''}${n} skin${n !== 1 ? 's' : ''}`, name: name(pid), amount: amt(pid, key) }))
    }
    if (perFlight) ['A', 'B'].forEach(fl => add(fl, superSkinsResult[fl], `super_skins_${fl.toLowerCase()}`))
    else {
      const active = superSkinsResult.A.entrantCount > 0 ? 'A' : 'B'
      add(null, superSkinsResult[active], /^super_skins_[a-z]$/.test(superSkinsKey) ? `super_skins_${active.toLowerCase()}` : 'super_skins')
    }
    extras.push({ title: 'Super skins', rows })
  }

  const superCtpHole = event.super_ctp_hole ? parseInt(event.super_ctp_hole, 10) : null
  const superCtpFlights = sides.map(s => s.match(/^super_ctp_([a-z])$/)?.[1]).filter(Boolean)
  if (superCtpHole && (superCtpFlights.length > 0 || sides.includes('super_ctp'))) {
    const entries = superCtpFlights.length > 0
      ? superCtpFlights.map(fl => ({ fl: fl.toUpperCase(), key: `super_ctp_${fl}_${superCtpHole}` }))
      : [{ fl: null, key: `super_ctp_${superCtpHole}` }]
    extras.push({
      title: 'Super CTP',
      rows: entries.map(({ fl, key }) => {
        const g = sideGames.find(x => x.game_type === 'super_ctp' && x.hole_number === superCtpHole && (fl ? x.flight === fl : !x.flight || x.flight === 'overall'))
        return { label: fl ? `Hole ${superCtpHole} · Flight ${fl}` : `Hole ${superCtpHole}`, name: g?.winner_player_id ? name(g.winner_player_id) : '—', amount: g?.winner_player_id ? amt(g.winner_player_id, key) : null }
      }),
    })
  }

  if (sides.some(s => s === 'blind_partners' || s.startsWith('blind_partners_')) && blindPartnersData.length > 0) {
    const unit = blindPartnersData[0].mode === 'stableford' ? 'pts' : 'net'
    const topRank = blindPartnersData[0].rank
    extras.push({
      title: 'Blind partners',
      rows: blindPartnersData.filter(p => p.rank === topRank).map(pair => {
        const names = pair.player_ids.map(name)
        if (!pair.p2) {
          names.push(pair.oddConfig?.type === 'ghost' ? `Ghost (${pair.oddConfig.score ?? '—'} ${unit})`
            : pair.oddConfig?.type === 'blind' && pair.oddConfig.player_id ? `${name(pair.oddConfig.player_id)} (blind draw)` : 'No partner')
        }
        return { label: `${pair.combinedScore} ${unit}`, name: names.join(' + '), amount: amt(pair.player_ids[0], 'blind_partners') }
      }),
    })
  }

  // ── Match play ───────────────────────────────────────────────────
  let matchPlay = null
  if (matchData && matchData.pairings.length > 0) {
    const teamNames = event.ryder_cup_teams ?? {}
    const teamA = teamNames.a?.trim() || 'Team A'
    const teamB = teamNames.b?.trim() || 'Team B'
    const showTeams = matchData.hasTeams && (matchData.teamPoints.A + matchData.teamPoints.B) > 0
    const rows = matchData.pairings.map((pair, i) => {
      const a = name(pair.playerA.player_id), b = name(pair.playerB.player_id)
      const margin = pair.holesPlayed === 0 ? 'Not started' : pair.matchStatus
      const base = { id: `M${pair.match_number ?? i + 1}`, margin }
      if (pair.winner === 'A') return { ...base, winner: a, loser: b, kind: 'def' }
      if (pair.winner === 'B') return { ...base, winner: b, loser: a, kind: 'def' }
      if (pair.winner === 'halve') return { ...base, winner: a, loser: b, kind: 'halved' }
      return { ...base, winner: a, loser: b, kind: 'vs' }
    })
    const pa = matchData.teamPoints.A, pb = matchData.teamPoints.B
    matchPlay = {
      rows,
      showTeams,
      teamScore: showTeams ? `${teamA} ${pa} · ${teamB} ${pb}` : null,
      leader: showTeams ? (pa === pb ? 'Teams tied' : `${pa > pb ? teamA : teamB} wins ${Math.max(pa, pb)}–${Math.min(pa, pb)}`) : null,
      tileValue: showTeams ? (pa === pb ? `Tied ${pa} – ${pb}` : `${pa > pb ? teamA : teamB} ${Math.max(pa, pb)} – ${Math.min(pa, pb)}`) : 'Head-to-head',
      count: rows.length,
    }
  }

  let teamMatch = null
  if (teamMatchData && teamMatchData.groupMatches.length > 0) {
    teamMatch = {
      title: 'Team match',
      score: `${teamMatchData.teamAName} ${teamMatchData.totalA} · ${teamMatchData.teamBName} ${teamMatchData.totalB}`,
      rows: teamMatchData.groupMatches.map(m => ({
        id: `G${m.groupNumber}`,
        text: `${m.teamA.map(ep => name(ep.player_id)).join(' + ')} vs ${m.teamB.map(ep => name(ep.player_id)).join(' + ')}`,
        margin: m.holesPlayed === 0 ? 'Not started' : m.matchStatus,
      })),
    }
  }

  // ── Tiles ────────────────────────────────────────────────────────
  const lowNet = (hasFlights ? flights : [null]).map(fl => {
    const list = fl ? (leaderboards.full?.[fl] ?? []) : (leaderboards.full?.A ?? [])
    const top = list.filter(p => p.rank === list[0]?.rank)
    if (top.length === 0) return { flight: fl, name: '—', net: null, total: null }
    const names = top.length > 2 ? `${name(top[0].player_id)} +${top.length - 1}` : top.map(p => name(p.player_id)).join(' / ')
    return { flight: fl, name: names, net: top[0].net18 ?? null, total: top.length === 1 ? playerTotal(top[0].player_id) : null }
  })

  return {
    eventName: event.name ?? (event.event_number ? `Event #${event.event_number}` : 'Event'),
    courseName: course?.name ?? '',
    dateLong: longDateText(event.event_date),
    dateShort: shortDateText(event.event_date),
    playerCount: nonGuests.length,
    flights, hasFlights,
    tiles: {
      lowNet,
      pot: { value: payout.totalPot, paid: paidCount, players: nonGuests.length },
      match: matchPlay ? { value: matchPlay.tileValue, helper: `${matchPlay.count} match${matchPlay.count === 1 ? '' : 'es'}` } : null,
    },
    scoring, skins, ctp, longDrive, lowPutts, extras, matchPlay, teamMatch,
  }
}
