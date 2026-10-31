/**
 * The side game signs (closest to pin, long drive, custom competitions) as plain data.
 * Prize amounts use the same rule as the payout engine: the configured $ per player times the field.
 */
import { money } from './resultsView'

const holeText = h => `Hole ${h}`

export function buildSignItems(event, eventPlayers = []) {
  const sides = event?.side_game_options ?? []
  const config = event?.payout_config ?? {}
  const nonGuests = eventPlayers.filter(ep => !ep.is_guest)
  const field = nonGuests.length
  const flightCount = fl => nonGuests.filter(ep => ep.flight === fl).length
  const prize = (rate, count) => (rate > 0 && count > 0 ? Math.round(rate * count * 100) / 100 : null)
  const items = []

  if (sides.includes('ctp')) {
    const holes = Object.keys(config).filter(k => k.startsWith('ctp_')).map(k => parseInt(k.replace('ctp_', ''), 10)).sort((a, b) => a - b)
    if (holes.length > 0) {
      holes.forEach(h => {
        const p = prize(Number(config[`ctp_${h}`]), field)
        items.push({ kind: 'ctp', label: 'Closest to pin', big: holeText(h), scope: p != null ? `Full field · ${money(p)}` : 'Full field', cols: ['Name', 'Distance'], note: 'Closest wins. Write your name and distance if you beat the leader.' })
      })
    } else {
      items.push({ kind: 'ctp', label: 'Closest to pin', big: 'Closest to pin', scope: 'Full field', cols: ['Name', 'Distance'], note: 'Closest wins. Write your name and distance if you beat the leader.' })
    }
  }

  const ldKeys = sides.filter(s => s === 'long_drive' || /^long_drive_[a-z]$/.test(s))
  if (ldKeys.length > 0) {
    const flights = ldKeys.map(k => k.match(/^long_drive_([a-z])$/)?.[1]?.toUpperCase()).filter(Boolean)
    let scope = 'Full field'
    if (flights.length > 0) {
      const parts = flights.map(fl => {
        const p = prize(Number(config[`long_drive_${fl.toLowerCase()}`]), flightCount(fl))
        return p != null ? `${fl} ${money(p)}` : `Flight ${fl}`
      })
      scope = flights.length === 1 && parts[0].startsWith('Flight') ? parts[0] : parts.join(' · ')
    } else {
      const p = prize(Number(config.long_drive), field)
      if (p != null) scope = `Full field · ${money(p)}`
    }
    items.push({
      kind: 'drive', label: 'Longest drive', big: event?.long_drive_hole ? holeText(event.long_drive_hole) : 'Longest drive',
      scope, cols: ['Name', 'Flight'], note: 'Longest in the fairway wins. Write your name if you beat the leader.',
    })
  }

  ;(event?.custom_competitions ?? []).filter(c => c?.trim()).forEach(name => {
    items.push({ kind: 'other', label: 'Side game', big: name.trim(), scope: 'Full field', cols: ['Name', 'Result'], note: 'Write your name and result if you beat the leader.' })
  })
  return items
}

/** Four signs per Letter page. */
export function signPages(items) {
  const pages = []
  for (let i = 0; i < items.length; i += 4) pages.push(items.slice(i, i + 4))
  return pages
}
