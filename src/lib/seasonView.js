// Pure view-model helpers for the public league season page (LeagueHome.jsx).
// Presentation only: nothing here changes how earnings, skins, CTP or long drive are worked out —
// it only orders, labels and formats numbers that useSeasonStandings already produced.

import { standingsConfig } from './standingsBuckets'

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

/** "2026-10-25" -> local Date. (new Date('2026-10-25') is UTC midnight and shows as Oct 24 in US time zones.) */
export function parseLocalDate(str) {
  if (!str) return null
  const [y, m, d] = String(str).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d)
}

/** { mon: 'OCT', day: 25 } for a date-only string, or null. */
export function monthDay(str) {
  const d = parseLocalDate(str)
  return d ? { mon: MONTHS[d.getMonth()], day: d.getDate() } : null
}

/** First + last name, or null when the player record is missing or has no name. */
export function playerName(player) {
  const name = `${player?.first_name ?? ''} ${player?.last_name ?? ''}`.trim()
  return name || null
}

export const UNNAMED = 'Unnamed player'

const cents = n => Math.round(Number(n) * 100)

/**
 * Money list rows in the order useSeasonStandings produced them. Ties share a rank
 * (1, 2, 2, 4). `pct` is the bar width (0-100) scaled to the leader; `perEvent` is display-only.
 */
export function moneyRows(standings) {
  const top = standings[0]?.totalEarnings ?? 0
  let rank = 0
  return standings.map((s, i) => {
    if (i === 0 || cents(s.totalEarnings) !== cents(standings[i - 1].totalEarnings)) rank = i + 1
    return {
      key: s.player?.id ?? `row-${i}`,
      rank,
      name: playerName(s.player),
      events: s.eventsPlayed,
      perEvent: s.eventsPlayed > 0 ? s.totalEarnings / s.eventsPlayed : 0,
      earnings: s.totalEarnings,
      pct: top > 0 ? Math.max(2, Math.round((s.totalEarnings / top) * 100)) : 0,
      source: s,
    }
  })
}

/** Side-game rows sorted by Side $ (highest first). Equal totals keep their incoming order. */
export function sideRows(stats) {
  return stats
    .map((s, i) => ({
      key: s.player?.id ?? `side-${i}`,
      name: playerName(s.player),
      skins: s.skinsWon,
      ctp: s.ctpWins,
      ld: s.ldWins,
      lp: s.lpWins,
      total: s.skinsTotal + s.ctpTotal + s.ldTotal + s.lpTotal,
      order: i,
    }))
    .sort((a, b) => (cents(b.total) - cents(a.total)) || (a.order - b.order))
}

const list = parts => (parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`)

/** "Season earnings from scoring, closest to pin, long drive and low putts." from the league's standings settings. */
export function moneyListSubtitle(config) {
  const cfg = standingsConfig(config)
  const parts = []
  if (cfg.include_scoring) parts.push('scoring')
  if (cfg.include_skins) parts.push('skins')
  if (cfg.include_ctp) parts.push('closest to pin')
  if (cfg.include_long_drive) parts.push('long drive')
  if (cfg.include_low_putts) parts.push('low putts')
  if (cfg.include_super_games) parts.push('super games')
  if (cfg.include_blind_partners) parts.push('Blind Partners')
  if (parts.length === 0) return 'Season earnings.'
  return `Season earnings from ${list(parts)}.`
}

/**
 * What the side-game table says about the money list. `shown` says which columns the table has
 * ({ skins, ctp, ld, lp }); the sentence names the shown games the money list leaves out.
 */
export function sideGameSubtitle(config, shown = { skins: true, ctp: true, ld: true, lp: true }) {
  const cfg = standingsConfig(config)
  const games = [
    { on: shown.skins, counted: cfg.include_skins, name: 'skins' },
    { on: shown.ctp, counted: cfg.include_ctp, name: 'closest to pin' },
    { on: shown.ld, counted: cfg.include_long_drive, name: 'long drive' },
    { on: shown.lp, counted: cfg.include_low_putts, name: 'low putts' },
  ].filter(g => g.on)
  const left = games.filter(g => !g.counted).map(g => g.name)
  if (left.length === 0) return `${list(games.map(g => g.name)).replace(/^./, c => c.toUpperCase())} winnings across the season.`
  const verb = left.length === 1 && left[0] !== 'skins' && left[0] !== 'low putts' ? "which doesn't" : "which don't"
  return `Includes ${list(left)}, ${verb} count toward the money list.`
}

/** The league's next event: earliest upcoming/active by date, then by event number. */
export function nextEventOf(events) {
  const open = events.filter(e => e.status === 'upcoming' || e.status === 'active')
  open.sort((a, b) => String(a.event_date ?? '9999').localeCompare(String(b.event_date ?? '9999')) || (a.event_number ?? 0) - (b.event_number ?? 0))
  return open[0] ?? null
}

/** "{n} events played · {n} players in the money · Updated after {event}" (parts drop out when unknown). */
export function seasonMeta({ played, inMoney, latestName }) {
  const parts = []
  parts.push(`${played} event${played === 1 ? '' : 's'} played`)
  if (inMoney != null) parts.push(`${inMoney} player${inMoney === 1 ? '' : 's'} in the money`)
  if (latestName) parts.push(`Updated after ${latestName}`)
  return parts.join(' · ')
}
