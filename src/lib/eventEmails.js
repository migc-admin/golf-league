/**
 * Pre-round / post-round email builders.
 *
 * Produce Gmail-friendly HTML: table layout and inline styles only. Gmail strips
 * <style> blocks, CSS classes and scripts, and drops embedded (data:) images, so
 * nothing here relies on them. The result is meant to be copied to the clipboard
 * as rich text and pasted into a Gmail compose window.
 */
import { FORMAT_LABELS, SIDE_GAME_LABELS } from './eventLabels'
import { matchCH } from './engines/matchPoints'

const GREEN = '#1B4332'
const GOLD  = '#C9A84C'
const FONT  = "Arial, Helvetica, sans-serif"

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function longDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  })
}

function shortDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function teeTime(startTime, intervalMins, groupNum) {
  if (!startTime) return null
  const [h, m] = startTime.split(':').map(Number)
  const total  = h * 60 + m + (groupNum - 1) * (intervalMins ?? 10)
  const hh     = Math.floor(total / 60) % 24
  const mm     = total % 60
  return `${hh % 12 || 12}:${String(mm).padStart(2, '0')} ${hh >= 12 ? 'PM' : 'AM'}`
}

function money(n) { return `$${Number(n).toFixed(2)}` }
function playerLabel(p) { return p ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : '' }
function eventTitle(event) { return event?.name ?? (event?.event_number ? `Event #${event.event_number}` : 'Event') }

// ── Shared building blocks ────────────────────────────────────────────────────
function header({ leagueName, logoUrl, title, subtitle }) {
  const initials = esc((leagueName ?? '⛳').slice(0, 2).toUpperCase())
  const badge = logoUrl && /^https?:\/\//.test(logoUrl)
    ? `<img src="${esc(logoUrl)}" width="56" height="56" alt="" style="display:block;width:56px;height:56px;border-radius:28px;border:2px solid ${GOLD};">`
    : `<div style="width:56px;height:56px;line-height:56px;border-radius:28px;background:${GREEN};color:${GOLD};font-weight:bold;font-size:20px;text-align:center;">${initials}</div>`
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
    <tr>
      <td width="70" valign="middle">${badge}</td>
      <td valign="middle" style="font-family:${FONT};">
        <div style="font-size:13px;font-weight:bold;color:${GREEN};">${esc(leagueName)}</div>
        <div style="font-size:20px;font-weight:bold;color:#111;margin-top:2px;">${esc(title)}</div>
        ${subtitle ? `<div style="font-size:13px;color:#666;margin-top:2px;">${esc(subtitle)}</div>` : ''}
      </td>
    </tr>
  </table>
  <div style="height:3px;background:${GOLD};margin:0 0 16px;font-size:0;line-height:0;">&nbsp;</div>`
}

function sectionTitle(text) {
  return `<div style="font-family:${FONT};font-size:14px;font-weight:bold;color:${GREEN};margin:20px 0 6px;padding-bottom:3px;border-bottom:1px solid ${GOLD};">${esc(text)}</div>`
}

function paragraph(text) {
  return `<p style="font-family:${FONT};font-size:14px;line-height:1.5;color:#222;margin:0 0 12px;">${esc(text).replace(/\n/g, '<br>')}</p>`
}

function button(label, href) {
  return `<a href="${esc(href)}" style="display:inline-block;background:${GREEN};color:#ffffff;font-family:${FONT};font-size:14px;font-weight:bold;text-decoration:none;padding:10px 20px;border-radius:6px;margin:0 8px 8px 0;">${esc(label)}</a>`
}

function wrap(inner) {
  return `<div style="font-family:${FONT};max-width:600px;margin:0 auto;padding:8px;">${inner}</div>`
}

function detailRows(rows) {
  const body = rows.filter(([, v]) => v).map(([label, value]) => `
    <tr>
      <td valign="top" style="font-family:${FONT};font-size:14px;color:#666;padding:4px 12px 4px 0;white-space:nowrap;">${esc(label)}</td>
      <td valign="top" style="font-family:${FONT};font-size:14px;color:#111;font-weight:bold;padding:4px 0;">${value}</td>
    </tr>`).join('')
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 4px;">${body}</table>`
}

function cleanKey(k, labels) {
  return labels[k] ?? labels[String(k).replace(/_[a-z]$/, '')] ?? null
}

// ── Pre-round ─────────────────────────────────────────────────────────────────
/**
 * @param {Object}  p
 * @param {Object}  p.event
 * @param {Array}   p.eventPlayers   event_players rows with player objects
 * @param {Array}   p.matchPairings  match_pairings rows with playerA/playerB (may be empty)
 * @param {string}  p.leagueName
 * @param {string}  [p.logoUrl]
 * @param {string}  [p.eventUrl]
 * @param {string}  [p.wagerUrl]
 * @param {string}  [p.note]         free-text message from the admin, shown at the top
 */
export function buildPreRoundEmail({ event, eventPlayers = [], matchPairings = [], leagueName, logoUrl, eventUrl, wagerUrl, note }) {
  const title      = eventTitle(event)
  const isShotgun  = event?.shotgun_start ?? false
  const interval   = event?.tee_time_interval_mins ?? 10
  const holeMap    = event?.group_hole_assignments ?? {}
  const course     = event?.course

  const formats = [...new Set((event?.formats ?? (event?.format ? [event.format] : []))
    .map(k => cleanKey(k, FORMAT_LABELS)).filter(Boolean))]
  const sideGames = [...new Set((event?.side_game_options ?? [])
    .map(k => SIDE_GAME_LABELS[k]).filter(Boolean))]
  const custom = (event?.custom_competitions ?? []).filter(c => c?.trim())
  const games = [...sideGames, ...custom]

  const startText = event?.start_time
    ? (isShotgun
        ? `${teeTime(event.start_time, 0, 1)} · Shotgun start`
        : `${teeTime(event.start_time, interval, 1)} first tee`)
    : (isShotgun ? 'Shotgun start' : '')
  const courseHtml = course?.name
    ? esc(course.name) + (course.address ? `<div style="font-weight:normal;color:#666;font-size:13px;">${esc(course.address)}</div>` : '')
    : ''

  // Groups, in group order
  const groups = {}
  for (const ep of eventPlayers) {
    if (ep.group_number == null) continue
    ;(groups[ep.group_number] ??= []).push(ep)
  }
  const groupNums = Object.keys(groups).map(Number).sort((a, b) => a - b)
  groupNums.forEach(g => groups[g].sort((a, b) => (a.group_order ?? 99) - (b.group_order ?? 99)))

  const groupRows = groupNums.map((g, i) => {
    const time = isShotgun
      ? (holeMap[g] ? `Hole ${holeMap[g]}` : '')
      : teeTime(event?.start_time, interval, g) ?? ''
    const names = groups[g].map(ep => esc(playerLabel(ep.player))).join(', ')
    return `
      <tr style="background:${i % 2 ? '#f7f6f2' : '#ffffff'};">
        <td valign="top" style="font-family:${FONT};font-size:13px;font-weight:bold;color:${GREEN};padding:6px 8px;white-space:nowrap;">Group ${g}</td>
        <td valign="top" style="font-family:${FONT};font-size:13px;color:#555;padding:6px 8px;white-space:nowrap;">${esc(time)}</td>
        <td valign="top" style="font-family:${FONT};font-size:13px;color:#111;padding:6px 8px;">${names}</td>
      </tr>`
  }).join('')

  // Strokes in a match = difference in match play course handicaps, given to the
  // higher-handicap player (the lower handicap plays scratch).
  const epById = Object.fromEntries(eventPlayers.map(ep => [ep.player_id, ep]))
  const strokeTag = n => (n > 0 ? ` <span style="color:${GREEN};font-weight:bold;">(${n})</span>` : '')
  const matchRows = matchPairings.map((m, i) => {
    const chA = matchCH(epById[m.player_a_id]) ?? 0
    const chB = matchCH(epById[m.player_b_id]) ?? 0
    const diff = Math.abs(chA - chB)
    const strokesA = chA > chB ? diff : 0
    const strokesB = chB > chA ? diff : 0
    return `
      <tr style="background:${i % 2 ? '#f7f6f2' : '#ffffff'};">
        <td style="font-family:${FONT};font-size:13px;font-weight:bold;color:${GREEN};padding:6px 8px;white-space:nowrap;">Match ${m.match_number ?? i + 1}</td>
        <td style="font-family:${FONT};font-size:13px;color:#111;padding:6px 8px;">${esc(playerLabel(m.playerA))}${strokeTag(strokesA)} <span style="color:#999;">vs</span> ${esc(playerLabel(m.playerB))}${strokeTag(strokesB)}</td>
      </tr>`
  }).join('')

  // Players by flight, lowest course handicap first, handicap in parentheses
  const byFlight = {}
  for (const ep of eventPlayers) (byFlight[ep.flight ?? ''] ??= []).push(ep)
  const flightKeys = Object.keys(byFlight).sort()
  const flightCols = flightKeys.map(k => ({
    title: k ? `Flight ${k}` : 'Players',
    players: byFlight[k].sort((a, b) => (a.course_handicap ?? 999) - (b.course_handicap ?? 999)),
  }))
  const flightRowCount = Math.max(0, ...flightCols.map(c => c.players.length))
  const flightCell = ep => ep
    ? `${esc(playerLabel(ep.player))}${ep.course_handicap != null ? ` <span style="color:#666;">(${ep.course_handicap})</span>` : ''}`
    : ''
  const flightTable = flightCols.length === 0 ? '' : `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;">
      <tr>${flightCols.map(c => `<td style="background:${GREEN};color:${GOLD};font-family:${FONT};font-size:13px;font-weight:bold;padding:6px 8px;" width="${Math.floor(100 / flightCols.length)}%">${esc(c.title)} <span style="font-weight:normal;font-size:11px;">(Course Handicap)</span></td>`).join('')}</tr>
      ${Array.from({ length: flightRowCount }, (_, r) => `
      <tr style="background:${r % 2 ? '#f7f6f2' : '#ffffff'};">${flightCols.map(c => `<td valign="top" style="font-family:${FONT};font-size:13px;color:#111;padding:5px 8px;">${flightCell(c.players[r])}</td>`).join('')}</tr>`).join('')}
    </table>`

  const html = wrap(`
    ${header({ leagueName, logoUrl, title, subtitle: longDate(event?.event_date) })}
    ${note?.trim() ? paragraph(note.trim()) : ''}
    ${eventUrl || wagerUrl ? `<div style="margin:4px 0 8px;">
      ${eventUrl ? button('View Event Page', eventUrl) : ''}
      ${wagerUrl ? button('Place a Bet', wagerUrl) : ''}
    </div>` : ''}
    ${sectionTitle('Event Details')}
    ${detailRows([
      ['Date', esc(longDate(event?.event_date))],
      ['Course', courseHtml],
      ['Start', esc(startText)],
      ['Format', esc(formats.join(' · '))],
      ['Side games', esc(games.join(' · '))],
    ])}
    ${sectionTitle('Groups & Tee Times')}
    ${groupNums.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;">${groupRows}</table>`
      : paragraph('Groups and tee times will be posted soon.')}
    ${flightTable ? `
      ${sectionTitle('Players by Flight')}
      ${flightTable}` : ''}
    ${matchPairings.length ? `
      ${sectionTitle('Match Play Matchups')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;">${matchRows}</table>` : ''}
    `)

  return { subject: `${leagueName ? leagueName + ': ' : ''}${title} — ${shortDate(event?.event_date)}`.trim(), html }
}

// ── Post-round ────────────────────────────────────────────────────────────────
/**
 * @param {Object} p
 * @param {Object} p.event
 * @param {Array}  p.payouts        from computePlayerPayouts (who won what)
 * @param {Array}  p.matchResults   [{ playerA, playerB, winner, matchStatus }] (may be empty)
 * @param {string} p.leagueName
 * @param {string} [p.logoUrl]
 * @param {string} [p.leaderboardUrl]
 * @param {string} [p.note]
 */
export function buildPostRoundEmail({ event, payouts = [], matchResults = [], leagueName, logoUrl, leaderboardUrl, note }) {
  const title  = eventTitle(event)
  const winners = payouts.filter(p => p.total > 0).sort((a, b) => b.total - a.total)
  const totalPaid = winners.reduce((s, p) => s + p.total, 0)

  const winnerRows = winners.map((p, i) => `
      <tr style="background:${i % 2 ? '#f7f6f2' : '#ffffff'};">
        <td valign="top" style="font-family:${FONT};font-size:13px;padding:7px 8px;">
          <div style="font-weight:bold;color:#111;">${esc(p.name)}</div>
          <div style="color:#666;font-size:12px;margin-top:1px;">${p.items.map(it => `${esc(it.category)} ${money(it.amount)}`).join(' · ')}</div>
        </td>
        <td valign="top" align="right" style="font-family:${FONT};font-size:14px;font-weight:bold;color:${GREEN};padding:7px 8px;white-space:nowrap;">${money(p.total)}</td>
      </tr>`).join('')

  const matchLines = matchResults.map((r, i) => {
    const a = playerLabel(r.playerA?.player), b = playerLabel(r.playerB?.player)
    let text
    if (r.winner === 'A')      text = `<b>${esc(a)}</b> def. ${esc(b)} <span style="color:#666;">(${esc(r.matchStatus)})</span>`
    else if (r.winner === 'B') text = `<b>${esc(b)}</b> def. ${esc(a)} <span style="color:#666;">(${esc(r.matchStatus)})</span>`
    else if (r.winner === 'halve') text = `${esc(a)} halved with ${esc(b)}`
    else                       text = `${esc(a)} vs ${esc(b)} <span style="color:#666;">(${esc(r.matchStatus)})</span>`
    return `<tr style="background:${i % 2 ? '#f7f6f2' : '#ffffff'};"><td style="font-family:${FONT};font-size:13px;padding:6px 8px;color:#111;">${text}</td></tr>`
  }).join('')

  const html = wrap(`
    ${header({ leagueName, logoUrl, title: `${title} — Results`, subtitle: longDate(event?.event_date) })}
    ${note?.trim() ? paragraph(note.trim()) : ''}
    ${sectionTitle('Winners')}
    ${winners.length
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;">${winnerRows}</table>
         <div style="font-family:${FONT};font-size:12px;color:#666;margin-top:4px;text-align:right;">Total paid out: ${money(totalPaid)}</div>`
      : paragraph('Final results will be posted soon.')}
    ${matchResults.length ? `
      ${sectionTitle('Match Play Results')}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;">${matchLines}</table>` : ''}
    <div style="margin-top:20px;">
      ${leaderboardUrl ? button('View Full Leaderboard', leaderboardUrl) : ''}
    </div>`)

  return { subject: `${leagueName ? leagueName + ': ' : ''}${title} — Results`.trim(), html }
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
