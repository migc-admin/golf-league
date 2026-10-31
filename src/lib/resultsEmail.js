/**
 * The Results email: the Tournament Results layout as Gmail-friendly HTML.
 * Table layout, all styles inline, Arial/Helvetica. Outer width 800px, content card 760px, both with
 * max-width so they shrink on phones; two-column sections are a single table row (50% / 50%).
 * The data comes from buildResultsView (the same model as the Tournament Results PNG).
 */
import {
  GREEN, FONT, LINE, MUTED, INK, TINT_G, TINT_N, esc, section, headerBlock, buttonsBlock, noteBlock, shell, footerBlock, labelHtml,
} from './emailParts'
import { money } from './resultsView'
import { fmtPts } from './teamPlayView'

const dollars = n => (n != null ? money(n) : '')

function twoCols(left, right) {
  if (!right) return left
  if (!left) return right
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="table-layout:fixed;">
      <tr>
        <td valign="top" width="50%" style="width:50%;padding-right:5px;">${left}</td>
        <td valign="top" width="50%" style="width:50%;padding-left:5px;">${right}</td>
      </tr>
    </table>`
}

function tie() {
  return `<span style="display:inline-block;margin-left:5px;background:#eceae5;color:${MUTED};font-size:9px;font-weight:bold;letter-spacing:0.5px;text-transform:uppercase;padding:1px 4px;border-radius:4px;vertical-align:middle;">Tie</span>`
}

function flightBar(flight, right) {
  const bg = flight === 'A' ? TINT_G : TINT_N
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
    <td style="background:${bg};border-radius:${right ? '6px 0 0 6px' : '6px'};padding:7px 10px;font-family:${FONT};font-size:13px;font-weight:bold;color:${GREEN};">${flight ? `Flight ${esc(flight)}` : 'All players'}</td>
    ${right ? `<td align="right" style="background:${bg};border-radius:0 6px 6px 0;padding:7px 10px;font-family:${FONT};font-size:12px;color:${MUTED};">${esc(right)}</td>` : ''}
  </tr></table>`
}

function smallHead(text) {
  return `<div style="font-family:${FONT};font-size:10px;font-weight:bold;letter-spacing:1px;text-transform:uppercase;color:${MUTED};padding:12px 0 2px;">${esc(text)}</div>`
}

/** Rows of cells: [{ html, width?, align?, color?, bold? }] */
function rowsTable(rows, { divider = true } = {}) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map((cells, i) => `
    <tr>${cells.map(c => `<td valign="middle" ${c.width ? `width="${c.width}"` : ''} align="${c.align ?? 'left'}" style="font-family:${FONT};font-size:13px;line-height:18px;padding:6px ${c.align === 'right' ? '0 6px 6px' : '6px 6px 6px 0'};${i > 0 && divider ? `border-top:1px solid ${LINE};` : ''}color:${c.color ?? INK};${c.bold ? 'font-weight:bold;' : ''}${c.nowrap ? 'white-space:nowrap;' : ''}">${c.html}</td>`).join('')}</tr>`).join('')}
  </table>`
}

function tile(label, value, helper, good, i, n) {
  return `<td valign="top" style="padding:0 ${i < n - 1 ? 5 : 0}px 0 ${i > 0 ? 5 : 0}px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="background:${good ? TINT_G : '#ffffff'};border:1px solid ${LINE};border-radius:8px;padding:10px 12px;font-family:${FONT};">
        <div style="font-size:12px;color:${good ? GREEN : MUTED};">${esc(label)}</div>
        <div style="font-size:17px;line-height:22px;font-weight:bold;color:${INK};margin-top:2px;">${esc(value)}</div>
        ${helper ? `<div style="font-size:12px;color:${good ? GREEN : MUTED};margin-top:1px;">${esc(helper)}</div>` : ''}
      </td>
    </tr></table>
  </td>`
}

function marginPill(text) {
  return `<span style="display:inline-block;background:${TINT_G};color:${GREEN};font-size:11px;font-weight:bold;padding:2px 7px;border-radius:5px;white-space:nowrap;">${esc(text)}</span>`
}

function scoringColumn(col) {
  const blocks = col.blocks.map(b => `
    ${smallHead(`${b.label} · ${b.scoreLabel}`)}
    ${b.rows.length === 0 ? `<div style="font-family:${FONT};font-size:12px;color:${MUTED};padding:4px 0;">No results yet</div>` : rowsTable(b.rows.map(r => [
      { html: esc(r.place), width: 30, color: MUTED },
      { html: `${esc(r.name)}${r.tie ? tie() : ''}`, bold: true },
      { html: esc(r.score ?? ''), align: 'right', color: MUTED, width: 28 },
      { html: dollars(r.amount), align: 'right', bold: true, nowrap: true, width: 62 },
    ]))}`).join('')
  return `${flightBar(col.flight, `${col.count} players`)}${blocks}`
}

function skinsColumn(skins, c) {
  const per = c.perSkin != null ? `${money(c.perSkin).replace(/\.00$/, '')} / skin` : null
  const head = skins.perFlight ? flightBar(c.flight, per) : (per ? smallHead(per) : '')
  const body = c.empty
    ? `<div style="font-family:${FONT};font-size:12px;color:${MUTED};padding:8px 0;">No skins won</div>`
    : `<div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>${rowsTable(c.rows.map(r => [
        { html: `×${r.count}`, width: 30, color: MUTED },
        { html: esc(r.name), bold: true },
        { html: dollars(r.amount), align: 'right', bold: true, nowrap: true, width: 62 },
      ]))}`
  return head + body
}

function matchLine(r) {
  if (r.kind === 'def') return `<b>${esc(r.winner)}</b> <span style="color:${MUTED};">def. ${esc(r.loser)}</span>`
  if (r.kind === 'halved') return `<b>${esc(r.winner)}</b> <span style="color:${MUTED};">halved with ${esc(r.loser)}</span>`
  return `<b>${esc(r.winner)}</b> <span style="color:${MUTED};">vs ${esc(r.loser)}</span>`
}

/**
 * @param {Object} p
 * @param {Object} p.event
 * @param {Object} p.view          buildResultsView(...) result
 * @param {Array}  [p.teamRows]    teamPlayExportView(...).rows when team play is enabled
 * @param {Object} [p.nextEvent]   { name, dateText, url } for the "Next up" footer line
 * @param {string} p.leagueName
 * @param {string} [p.logoUrl]
 * @param {string} [p.leaderboardUrl]
 * @param {string} [p.payoutsUrl]
 * @param {string} [p.note]
 */
export function buildPostRoundEmail({ event, view, teamRows = [], nextEvent = null, leagueName, logoUrl, leaderboardUrl, payoutsUrl, note }) {
  const title = event?.name ?? (event?.event_number ? `Event #${event.event_number}` : 'Event')

  const dateLine = [view?.dateLong ? `<b style="color:${INK};">${esc(view.dateLong)}</b>` : '', view?.courseName ? esc(view.courseName) : ''].filter(Boolean).join(' &middot; ')
  const header = headerBlock({ leagueName, logoUrl, statusPill: 'Final results', title, lines: [dateLine] })
  const buttons = buttonsBlock([
    { label: 'View full leaderboard', href: leaderboardUrl, filled: true },
    { label: 'Payouts per player', href: payoutsUrl, filled: false },
  ])

  let body = ''
  if (view) {
    const t = view.tiles
    const defs = [
      ...t.lowNet.map(l => [l.flight ? `Low net · Flight ${l.flight}` : 'Low net', l.name, l.net != null ? `Net ${l.net}` : null, true]),
      ['Total pot', money(t.pot.value), `${t.pot.paid} of ${t.pot.players} paid`, false],
    ]
    const tiles = defs.map((d, i) => tile(...d, i, defs.length))
    body += `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;table-layout:fixed;"><tr>${tiles.join('')}</tr></table>`

    if (view.scoring) {
      body += section(view.scoring.title, twoCols(
        scoringColumn(view.scoring.columns[0]),
        view.scoring.columns[1] ? scoringColumn(view.scoring.columns[1]) : null,
      ))
    }

    if (view.skins) {
      body += section('Skins', twoCols(
        skinsColumn(view.skins, view.skins.columns[0]),
        view.skins.columns[1] ? skinsColumn(view.skins, view.skins.columns[1]) : null,
      ))
    }

    if (view.ctp || view.longDrive || view.lowPutts) {
      const ctpHtml = view.ctp ? `
        ${labelHtml('Closest to pin')}
        <div style="font-family:${FONT};font-size:12px;color:${MUTED};padding:3px 0 4px;">${view.ctp.prize != null ? `Full field · ${money(view.ctp.prize)} each` : 'Full field'}</div>
        ${rowsTable(view.ctp.rows.map(r => [
          { html: `Hole ${r.hole}`, width: 56, color: MUTED, nowrap: true },
          { html: esc(r.name), bold: true },
          { html: dollars(r.amount), align: 'right', bold: true, nowrap: true, width: 62 },
        ]))}` : null
      const ldHtml = view.longDrive ? `
        ${labelHtml(`Long drive${view.longDrive.hole ? ` · Hole ${view.longDrive.hole}` : ''}`)}
        <div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
        ${rowsTable(view.longDrive.rows.map(r => [
          { html: esc(r.label), width: 28, color: MUTED },
          { html: esc(r.name), bold: true },
          { html: dollars(r.amount), align: 'right', bold: true, nowrap: true, width: 62 },
        ]))}` : ''
      const lpHtml = view.lowPutts ? `
        <div style="height:${view.longDrive ? 16 : 0}px;line-height:${view.longDrive ? 16 : 0}px;font-size:0;">&nbsp;</div>
        ${labelHtml('Low putts')}
        <div style="height:6px;line-height:6px;font-size:0;">&nbsp;</div>
        ${rowsTable(view.lowPutts.rows.map(r => [
          { html: `${esc(r.name)}${r.tie ? tie() : ''}`, bold: true },
          { html: dollars(r.amount), align: 'right', bold: true, nowrap: true, width: 62 },
        ]))}` : ''
      const right = ldHtml || lpHtml ? ldHtml + lpHtml : null
      body += section('Side games', twoCols(ctpHtml, right))
    }

    view.extras.forEach(e => {
      body += section(e.title, rowsTable(e.rows.map(r => [
        { html: esc(r.label), width: 150, color: MUTED },
        { html: `${esc(r.name)}${r.tie ? tie() : ''}`, bold: true },
        { html: dollars(r.amount), align: 'right', bold: true, nowrap: true, width: 62 },
      ])))
    })

    if (view.matchPlay) {
      const half = Math.ceil(view.matchPlay.rows.length / 2)
      const colHtml = rows => rows.length ? rowsTable(rows.map(r => [
        { html: esc(r.id), width: 28, color: MUTED },
        { html: matchLine(r) },
        { html: marginPill(r.margin), align: 'right', nowrap: true },
      ])) : null
      body += section(view.matchPlay.leader ? `Match play · ${view.matchPlay.leader}` : 'Match play', twoCols(
        colHtml(view.matchPlay.rows.slice(0, half)), colHtml(view.matchPlay.rows.slice(half)),
      ))
    }

    if (view.teamMatch) {
      body += section(`${view.teamMatch.title} · ${view.teamMatch.score}`, rowsTable(view.teamMatch.rows.map(r => [
        { html: esc(r.id), width: 28, color: MUTED },
        { html: `<b>${esc(r.text)}</b>` },
        { html: marginPill(r.margin), align: 'right', nowrap: true },
      ])))
    }
  }

  if (teamRows.length > 0) {
    body += section('Team play standings', rowsTable(teamRows.map(r => [
      { html: r.rank != null ? `#${r.rank}` : '—', width: 30, color: MUTED },
      { html: `<span style="display:inline-block;width:9px;height:9px;border-radius:5px;background:${esc(r.team.color || GREEN)};margin-right:7px;"></span><b>${esc(r.team.name)}</b><div style="color:${MUTED};font-size:12px;padding-left:16px;">${r.players.map(p => `${esc(p.name)} ${esc(fmtPts(p.points))}`).join(' · ')}</div>` },
      { html: r.points != null ? `${esc(fmtPts(r.points))} pts` : '—', align: 'right', bold: true, nowrap: true },
    ])))
  }

  const nextLine = nextEvent
    ? `Next up: <b style="color:${INK};">${esc(nextEvent.name)}</b>${nextEvent.dateText ? ` &middot; ${esc(nextEvent.dateText)}` : ''}${nextEvent.url ? ` &middot; <a href="${esc(nextEvent.url)}" style="color:${GREEN};font-weight:bold;text-decoration:underline;">Register</a>` : ''}`
    : null
  const footer = footerBlock([nextLine, `<span style="display:inline-block;margin-top:6px;">Powered by Scorify Golf</span>`])

  const html = shell(`
          ${header}
          ${buttons}
          ${noteBlock(note)}
          ${body}
          ${footer}`, { outer: 800, card: 760 })

  return { subject: `${leagueName ? leagueName + ': ' : ''}${title} — Results`.trim(), html }
}
