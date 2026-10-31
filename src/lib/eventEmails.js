/**
 * Pre-round / post-round email builders.
 *
 * Produce Gmail-friendly HTML: table layout and inline styles only. Gmail strips
 * <style> blocks, CSS classes and scripts, and drops embedded (data:) images, so
 * nothing here relies on them. The result is meant to be copied to the clipboard
 * as rich text and pasted into a Gmail compose window.
 */
import { matchCH } from './engines/matchPoints'
import { markdownToHtml } from './simpleMarkdown'
import { competitionGroups } from './eventPageView'
import { cityOf, feeText } from './registerView'
import {
  GREEN, GOLD, FONT, LINE, MUTED, INK, TINT_G, TINT_N, esc, longDate, shortDate, section,
  headerBlock, buttonsBlock, noteBlock, shell, footerBlock,
} from './emailParts'

export { buildPostRoundEmail } from './resultsEmail'

function teeTime(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  const total  = h * 60 + m + (groupNum - 1) * (intervalMins ?? 10)
  const hh     = Math.floor(total / 60) % 24
  const mm     = total % 60
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`
}

function playerLabel(p) { return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '' }
function eventTitle(event) { return event?.name ?? (event?.event_number ? `Event #${event.event_number}` : 'Event') }

// ── Pre-round ─────────────────────────────────────────────────────────────────
function flightLabel(k) { return k ? `Flight ${k}` : 'No flight yet' }

/** Competitions as { name, detail } rows, built from the same grouping the public event page uses. */
export function emailCompetitions(event) {
  return competitionGroups(event ?? {}).flatMap(g => g.rows).map(r => {
    let detail = r.variants.join(' · ')
    if (!detail && r.detail) detail = r.detail
    if (!detail && r.title === 'Closest to Pin') detail = 'Full field'
    return { name: r.title, detail }
  })
}

/**
 * What the pre-round email contains, for the composer's "Included automatically" box.
 * Each item is { label, missing }; missing items are called out in amber.
 */
export function preRoundIncludes(event, eventPlayers = []) {
  const hasGroups = eventPlayers.some(ep => ep.group_number != null)
  return [
    { label: 'Event details', missing: false },
    { label: 'Competitions & side games', missing: emailCompetitions(event).length === 0 },
    { label: 'Groups & tee times', missing: !hasGroups },
    { label: 'Players by flight', missing: eventPlayers.length === 0 },
  ]
}

/**
 * @param {Object}  p
 * @param {Object}  p.event
 * @param {Array}   p.eventPlayers   event_players rows with player objects
 * @param {Array}   p.matchPairings  match_pairings rows with playerA/playerB (may be empty)
 * @param {string}  p.leagueName
 * @param {string}  [p.logoUrl]      public URL of the league logo; omitted from the email when missing
 * @param {string}  [p.eventUrl]
 * @param {string}  [p.wagerUrl]     "Place a bet" is left out when this is empty
 * @param {string}  [p.note]         free-text message from the admin, shown as a note from the organizer
 */
export function buildPreRoundEmail({ event, eventPlayers = [], matchPairings = [], leagueName, logoUrl, eventUrl, wagerUrl, note }) {
  const title      = eventTitle(event)
  const isShotgun  = event?.shotgun_start ?? false
  const interval   = event?.tee_time_interval_mins ?? 10
  const holeMap    = event?.group_hole_assignments ?? {}
  const course     = event?.course
  const city       = cityOf(course?.address)

  const firstTee = event?.start_time ? teeTime(event.start_time, 0, 1) : null
  const teeText  = firstTee ? `${isShotgun ? 'Shotgun start' : 'First tee'} ${firstTee}` : (isShotgun ? 'Shotgun start' : '')
  const dateLine = [
    event?.event_date ? `<b style="color:${INK};">${esc(longDate(event.event_date))}</b>` : '',
    teeText ? esc(teeText) : '',
  ].filter(Boolean).join(' &middot; ')
  const courseLine = [course?.name, city].filter(Boolean).map(esc).join(' &middot; ')

  const headerHtml = headerBlock({ leagueName, logoUrl, title, lines: [dateLine, courseLine] })
  const buttonsHtml = buttonsBlock([
    { label: 'View event page', href: eventUrl, filled: true },
    { label: 'Place a bet', href: wagerUrl, filled: false },
  ])
  const noteHtml = noteBlock(note)

  // Event details: course (with address + Directions), start, entry fee. The date is already in the header.
  const directions = course?.address || course?.name
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(course.address || course.name)}`
    : null
  const fee = Number(event?.tournament_fee)
  const detailRow = (label, value) => `
      <tr>
        <td valign="top" width="96" style="font-family:${FONT};font-size:14px;line-height:21px;color:${MUTED};padding:5px 12px 5px 0;">${esc(label)}</td>
        <td valign="top" style="font-family:${FONT};font-size:14px;line-height:21px;color:${INK};padding:5px 0;">${value}</td>
      </tr>`
  const detailRowsHtml = [
    course?.name ? detailRow('Course', `<b>${esc(course.name)}</b>${course.address ? `<div style="color:${MUTED};">${esc(course.address)}</div>` : ''}${directions ? `<a href="${esc(directions)}" style="color:${GREEN};font-weight:bold;text-decoration:underline;">Directions</a>` : ''}`) : '',
    firstTee ? detailRow('Start', `<b>${esc(firstTee)}</b> ${isShotgun ? 'shotgun start' : 'first tee'}`) : '',
    fee > 0 ? detailRow('Entry fee', `<b>${esc(feeText(fee))}</b> per player`) : '',
  ].join('')
  const detailsHtml = detailRowsHtml
    ? section('Event details', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${detailRowsHtml}</table>`)
    : ''

  // Competitions & side games
  const comps = emailCompetitions(event)
  const compsHtml = comps.length ? section('Competitions & side games', `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${comps.map((c, i) => `
      <tr>
        <td valign="top" width="45%" style="font-family:${FONT};font-size:14px;line-height:21px;font-weight:bold;color:${INK};padding:7px 12px 7px 0;${i ? `border-top:1px solid ${LINE};` : ''}">${esc(c.name)}</td>
        <td valign="top" style="font-family:${FONT};font-size:14px;line-height:21px;color:${MUTED};padding:7px 0;${i ? `border-top:1px solid ${LINE};` : ''}">${esc(c.detail)}</td>
      </tr>`).join('')}
    </table>`) : ''

  const rulesHtml = event?.local_rules?.trim() ? section('Local Rules', `
    <div style="font-family:${FONT};font-size:14px;line-height:21px;color:#78350f;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:12px 14px;">${markdownToHtml(event.local_rules.trim())}</div>`) : ''

  // Groups, in group order
  const groups = {}
  for (const ep of eventPlayers) {
    if (ep.group_number == null) continue
    ;(groups[ep.group_number] ??= []).push(ep)
  }
  const groupNums = Object.keys(groups).map(Number).sort((a, b) => a - b)
  groupNums.forEach(g => groups[g].sort((a, b) => (a.group_order ?? 99) - (b.group_order ?? 99)))

  const th = `font-family:${FONT};font-size:11px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${MUTED};background:${TINT_N};padding:8px 10px;text-align:left;`
  const groupRows = groupNums.map(g => {
    const time = isShotgun
      ? (holeMap[g] ? `Hole ${holeMap[g]}` : '')
      : teeTime(event?.start_time, interval, g) ?? ''
    const names = groups[g].map(ep => esc(playerLabel(ep.player))).join(', ')
    const td = `font-family:${FONT};font-size:13px;line-height:19px;padding:9px 10px;border-top:1px solid ${LINE};`
    return `
      <tr>
        <td valign="top" style="${td}font-weight:bold;color:${GREEN};white-space:nowrap;">Group ${g}</td>
        <td valign="top" style="${td}color:${INK};white-space:nowrap;">${esc(time)}</td>
        <td valign="top" style="${td}color:${INK};">${names}</td>
      </tr>`
  }).join('')
  const groupsHtml = section('Groups & tee times', groupNums.length ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:8px;border-collapse:separate;">
      <tr><td style="${th}">Group</td><td style="${th}">${isShotgun ? 'Start' : 'Tee time'}</td><td style="${th}">Players</td></tr>
      ${groupRows}
    </table>` : `
    <div style="font-family:${FONT};font-size:14px;line-height:21px;color:${MUTED};background:${TINT_N};border-radius:8px;padding:14px 16px;">Groups and tee times will be posted soon. We'll send them before the round.</div>`)

  // Match play matchups. Strokes = difference in match play course handicaps, given to the
  // higher-handicap player (the lower handicap plays scratch).
  const epById = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
  const strokeTag = n => (n > 0 ? ` <span style="color:${GREEN};font-weight:bold;">(${n})</span>` : '')
  const matchRows = matchPairings.map((m, i) => {
    const chA = matchCH(epById[m.player_a_id]) ?? 0
    const chB = matchCH(epById[m.player_b_id]) ?? 0
    const diff = Math.abs(chA - chB)
    const strokesA = chA > chB ? diff : 0
    const strokesB = chB > chA ? diff : 0
    const td = `font-family:${FONT};font-size:13px;line-height:19px;padding:9px 10px;${i ? `border-top:1px solid ${LINE};` : ''}`
    return `
      <tr>
        <td style="${td}font-weight:bold;color:${GREEN};white-space:nowrap;">Match ${m.match_number ?? i + 1}</td>
        <td style="${td}color:${INK};">${esc(playerLabel(m.playerA))}${strokeTag(strokesA)} <span style="color:#9ca3af;">vs</span> ${esc(playerLabel(m.playerB))}${strokeTag(strokesB)}</td>
      </tr>`
  }).join('')
  const matchesHtml = matchPairings.length ? section('Match play matchups', `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:8px;border-collapse:separate;">${matchRows}</table>`) : ''

  // Players by flight: one bordered card per flight, names A–Z, course handicap beside the name when known
  const byFlight = {}
  for (const ep of eventPlayers) (byFlight[ep.flight ?? ''] ??= []).push(ep)
  const flightKeys = Object.keys(byFlight).filter(k => k).sort()
  if (byFlight['']) flightKeys.push('')
  const tintFor = k => (k === 'A' ? TINT_G : TINT_N)
  const flightCard = k => {
    const players = byFlight[k].slice().sort((a, b) => playerLabel(a.player).localeCompare(playerLabel(b.player)))
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid ${LINE};border-radius:8px;border-collapse:separate;">
        <tr><td style="background:${tintFor(k)};border-radius:8px 8px 0 0;padding:9px 10px;font-family:${FONT};font-size:13px;font-weight:bold;color:${GREEN};">
          ${esc(flightLabel(k))} <span style="font-weight:normal;color:${MUTED};">&middot; ${players.length} ${players.length === 1 ? 'player' : 'players'}</span>
        </td></tr>
        ${players.map((ep, i) => `
        <tr><td style="${i ? `border-top:1px solid ${LINE};` : ''}padding:7px 10px;font-family:${FONT};font-size:13px;line-height:19px;color:${INK};">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td style="font-family:${FONT};font-size:13px;line-height:19px;color:${INK};">${esc(playerLabel(ep.player))}</td>
            ${ep.course_handicap != null ? `<td align="right" style="font-family:${FONT};font-size:13px;line-height:19px;color:${MUTED};padding-left:6px;">${esc(ep.course_handicap)}</td>` : ''}
          </tr></table>
        </td></tr>`).join('')}
      </table>`
  }
  const flightsHtml = flightKeys.length ? section(`Players by flight · ${eventPlayers.length} registered`, `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        ${flightKeys.map((k, i) => `<td valign="top" width="${Math.floor(100 / flightKeys.length)}%" style="padding:${i === 0 ? '0 5px 0 0' : i === flightKeys.length - 1 ? '0 0 0 5px' : '0 5px'};">${flightCard(k)}</td>`).join('')}
      </tr>
    </table>`) : ''

  const footLink = (label, href) => `<a href="${esc(href)}" style="color:${MUTED};text-decoration:underline;">${esc(label)}</a>`
  const footerLinks = [eventUrl ? footLink('Event page', eventUrl) : '', wagerUrl ? footLink('Wager board', wagerUrl) : ''].filter(Boolean).join(' &middot; ')
  const footerHtml = footerBlock(['Questions? Reply to this email.', footerLinks, `<span style="display:inline-block;margin-top:6px;">Powered by Scorify Golf</span>`])

  const html = shell(`
          ${headerHtml}
          ${buttonsHtml}
          ${noteHtml}
          ${detailsHtml}
          ${compsHtml}
          ${rulesHtml}
          ${groupsHtml}
          ${matchesHtml}
          ${flightsHtml}
          ${footerHtml}`, { outer: 600, card: 560 })

  return { subject: `${leagueName ? leagueName + ': ' : ''}${title} — ${shortDate(event?.event_date)}`.trim(), html }
}


// ── Clipboard ─────────────────────────────────────────────────────────────────
/** Copy rich HTML (with a plain-text fallback) so it pastes formatted into Gmail. */
export async function copyRichHtml(html, plainText) {
  if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html':  new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText ?? ''], { type: 'text/plain' }),
      }),
    ])
    return
  }
  throw new Error('Rich copy is not supported in this browser')
}
