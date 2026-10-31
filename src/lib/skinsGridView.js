/**
 * The "Skins by flight" PNG as plain data: one view per flight (and per Super Skins flight).
 * Nothing is recalculated here: skins come from computeSkinsForFlight / computeSuperSkins, hole nets
 * use the same course-handicap strokes as before, and the pot / per-skin split is the same arithmetic.
 */
import { computeSkinsForFlight, computeSuperSkins } from './engines/skins'
import { getStrokesOnHole, getStrokeIndexForTee } from './engines/scoring'
import { playerFullName, shortDateText } from './resultsView'

// A single hole this far over par is not a real score (typo or bad sync), so the row is flagged.
export const CHECK_OVER_PAR = 10

const sum = a => a.reduce((x, y) => x + y, 0)

function oneView({ event, course, flightPlayers, allScores, flight, payoutKey, superSkins }) {
  const pars = course.par_per_hole
  const sis = course.stroke_index
  const { holes: skinsHoles, playerSkins } = computeSkinsForFlight(flightPlayers, allScores, course, flight)
  const winnerByHole = {}
  const carryByHole = {}
  skinsHoles.forEach(r => { winnerByHole[r.hole] = r.winner ?? null; carryByHole[r.hole] = r.carryoverIn ?? 0 })

  const key = payoutKey ?? (flight ? `skins_${flight.toLowerCase()}` : 'skins')
  const pot = (event.payout_config?.[key] ?? 0) * flightPlayers.length
  const totalSkins = sum(Object.values(playerSkins))
  const perSkin = totalSkins > 0 ? pot / totalSkins : 0

  const scoreMap = new Map(allScores.map(s => [`${s.player_id}:${s.hole_number}`, s]))

  // Same pre-sort as the old export (course handicap, then gross) so ties fall in the same order.
  const ordered = [...flightPlayers].sort((a, b) => (a.course_handicap ?? 99) - (b.course_handicap ?? 99))
  const rows = ordered.map(ep => {
    const ch = ep.course_handicap ?? 0
    const playerSis = getStrokeIndexForTee(course, ep.tee)
    const nets = {}
    let frontGross = 0, frontNet = 0, backGross = 0, backNet = 0, putts = 0, hasPutts = false, check = false
    for (let h = 1; h <= 18; h++) {
      const s = scoreMap.get(`${ep.player_id}:${h}`)
      if (!s) continue
      const net = s.gross_score - getStrokesOnHole(ch, playerSis[h - 1])
      nets[h] = net
      if (h <= 9) { frontGross += s.gross_score; frontNet += net } else { backGross += s.gross_score; backNet += net }
      if (s.putts != null) { putts += s.putts; hasPutts = true }
      if (s.gross_score > pars[h - 1] + CHECK_OVER_PAR) check = true
    }
    const gross = frontGross + backGross
    const skins = playerSkins[ep.player_id] ?? 0
    const wins = new Set(Object.keys(winnerByHole).filter(h => winnerByHole[h] === ep.player_id).map(Number))
    return {
      id: ep.player_id, name: playerFullName(ep), lastName: ep.player?.last_name ?? playerFullName(ep),
      skins, won: skins > 0 ? Math.round(skins * perSkin * 100) / 100 : 0,
      nets, wins, out: frontNet || null, in: backNet || null, gross: gross || null,
      hc: ch || null, net: gross ? gross - ch : null, putts: hasPutts ? putts : null, check, _gross: gross,
    }
  })
  // Same order as the old export: by net (total gross minus course handicap), lowest first.
  rows.sort((a, b) => ((a._gross || 999) - (a.hc ?? 0)) - ((b._gross || 999) - (b.hc ?? 0)))

  const top = rows.filter(r => r.skins > 0).sort((a, b) => b.skins - a.skins)[0] ?? null
  const holes = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, si: sis[i], par: pars[i], carry: carryByHole[i + 1] ?? 0 }))

  return {
    flight, superSkins, rows, holes,
    parOut: sum(pars.slice(0, 9)), parIn: sum(pars.slice(9)), parTotal: sum(pars),
    pool: pot, perSkin, totalSkins,
    top: top ? { name: top.lastName, count: top.skins } : null,
    title: `${superSkins ? 'Super skins results' : 'Skins results'}${flight ? ` · Flight ${flight}` : ''}`,
    fileSuffix: `${superSkins ? 'super_skins_grid' : 'skins_grid'}`,
    meta: [event.name ?? (event.event_number ? `Event #${event.event_number}` : null), course.name, shortDateText(event.event_date)].filter(Boolean).join(' · '),
    final: event.status === 'complete',
    dateShort: shortDateText(event.event_date),
  }
}

/** Every sheet the "Skins by flight" download produces, in the order it used to download them. */
export function skinsGridViews({ event, eventPlayers, allScores, course }) {
  const sides = event?.side_game_options ?? []
  const out = []
  if (sides.some(s => s.startsWith('skins'))) {
    const flights = [...new Set(eventPlayers.map(ep => ep.flight).filter(Boolean))].sort()
    if (flights.length === 0) flights.push(null)
    for (const flight of flights) {
      const flightPlayers = flight ? eventPlayers.filter(ep => ep.flight === flight) : [...eventPlayers]
      out.push({ ...oneView({ event, course, flightPlayers, allScores, flight, superSkins: false }), file: `skins_grid`, flightKey: flight })
    }
  }
  const superKey = sides.find(s => s === 'super_skins' || /^super_skins_[a-z]$/.test(s))
  if (superKey) {
    const result = computeSuperSkins(event, eventPlayers, allScores, course)
    if (result) {
      const buyIn = !!event?.side_game_buy_ins?.super_skins?.enabled
      const pool = buyIn ? eventPlayers.filter(ep => (event?.side_game_entries?.super_skins ?? []).includes(ep.player_id)) : eventPlayers
      const perFlightKey = /^super_skins_[a-z]$/.test(superKey)
      const both = perFlightKey && result.A.entrantCount > 0 && result.B.entrantCount > 0
      const flights = both ? ['A', 'B'] : perFlightKey ? [result.A.entrantCount > 0 ? 'A' : 'B'] : [null]
      for (const flight of flights) {
        const flightPlayers = flight ? pool.filter(ep => ep.flight === flight) : pool.map(ep => ({ ...ep, flight: null }))
        if (flightPlayers.length === 0) continue
        out.push({
          ...oneView({ event, course, flightPlayers, allScores, flight, payoutKey: perFlightKey ? `super_skins_${flight.toLowerCase()}` : 'super_skins', superSkins: true }),
          file: 'super_skins_grid', flightKey: flight,
        })
      }
    }
  }
  return out
}
