// Pure view-model helpers for the public event page (EventPage.jsx).
// Presentation only: nothing here reads or writes the database.

import { FORMAT_LABELS, SIDE_GAME_LABELS } from './eventLabels'
import { isBuyInEnabled } from './sideGames'

/**
 * Which hero/CTA state the page is in.
 *   open     — upcoming, has a registration link and spots left
 *   closed   — active, full, or no registration link (no Register anywhere)
 *   complete — final results
 */
export function registrationState({ status, regUrl, spotsLeft }) {
  if (status === 'complete') return { kind: 'complete', canRegister: false, pill: 'Final results' }
  const full = spotsLeft != null && spotsLeft <= 0
  if (status === 'upcoming' && regUrl && !full) return { kind: 'open', canRegister: true, pill: 'Registration open' }
  return { kind: 'closed', canRegister: false, pill: 'Registration closed' }
}

/** "$160" for a positive fee, otherwise null. */
export function feeLabel(fee) {
  const n = Number(fee)
  return n > 0 ? `$${n.toFixed(0)}` : null
}

/** Sponsor list with repeats removed (same URL, else same name), keeping the entry that has a logo. */
export function dedupeSponsors(sponsors) {
  const norm = v => (v ?? '').toString().trim().toLowerCase().replace(/\/+$/, '')
  const out = []
  for (const s of sponsors ?? []) {
    if (!s || (!norm(s.name) && !s.logo_url)) continue
    const url = norm(s.url), name = norm(s.name)
    const i = out.findIndex(o => (url && norm(o.url) === url) || (name && norm(o.name) === name))
    if (i === -1) out.push(s)
    else if (!out[i].logo_url && s.logo_url) out[i] = { ...out[i], ...s }
  }
  return out
}

// Splits "Net Stroke Play — Front 9" into { title, variant }.
function splitLabel(label) {
  const [title, variant] = label.split(' — ')
  return { title, variant: variant ?? null }
}

function addRow(rows, label, extra = {}) {
  const { title, variant } = splitLabel(label)
  let row = rows.find(r => r.title === title)
  if (!row) { row = { title, variants: [], sepEntry: false, detail: null }; rows.push(row) }
  if (variant && !row.variants.includes(variant)) row.variants.push(variant)
  if (extra.sepEntry) row.sepEntry = true
}

/**
 * Competitions & side games, grouped. Built only from what the event has enabled;
 * empty groups are dropped. Returns [{ title, rows: [{ title, variants, sepEntry, detail }] }]; detail is e.g. "Hole 7" when set.
 */
export function competitionGroups(event) {
  const formatKeys = event.formats ?? (event.format ? [event.format] : [])
  const scoring = [], side = [], other = []
  for (const k of formatKeys) {
    const label = FORMAT_LABELS[k] ?? FORMAT_LABELS[k.replace(/_[a-z]$/, '')]
    if (label) addRow(scoring, label)
  }
  for (const k of event.side_game_options ?? []) {
    const label = SIDE_GAME_LABELS[k]
    if (label) addRow(side, label, { sepEntry: isBuyInEnabled(event, k.replace(/_[ab]$/, '')) })
  }
  // Hole numbers, only when the organizer set them: long drive hole, and CTP holes from the payout setup.
  const ctpHoles = Object.keys(event.payout_config ?? {})
    .filter(k => /^ctp_\d+$/.test(k)).map(k => parseInt(k.slice(4), 10)).sort((a, b) => a - b)
  for (const r of side) {
    if (r.title === 'Long Drive' && event.long_drive_hole) r.detail = `Hole ${event.long_drive_hole}`
    if (r.title === 'Closest to Pin' && ctpHoles.length) r.detail = `${ctpHoles.length > 1 ? 'Holes' : 'Hole'} ${ctpHoles.join(', ')}`
  }
  for (const c of event.custom_competitions ?? []) {
    if (c?.trim()) addRow(other, c.trim())
  }
  return [
    { title: 'Scoring', rows: scoring },
    { title: 'Side games', rows: side },
    { title: 'Other', rows: other },
  ].filter(g => g.rows.length > 0)
}

/**
 * Schedule timeline entries. Falls back to a single "First tee time" entry when the
 * organizer added none; null when there is nothing to show.
 * startLabel is the already-formatted start time (e.g. "8:00 AM · Shotgun").
 */
export function scheduleEntries(event, startLabel) {
  const items = (event.schedule_items ?? []).filter(s => s?.label?.trim())
  if (items.length > 0) {
    return items.map(s => ({ time: s.time ?? null, label: s.label.trim(), description: s.description?.trim() || null }))
  }
  if (startLabel) return [{ time: null, timeLabel: startLabel, label: 'First tee time', description: null }]
  return null
}

/** Tab list. Matchups only with pairings; Register only while registration is open. */
export function eventTabs({ hasMatchups, canRegister, fee }) {
  const tabs = [{ key: 'overview', label: 'Overview' }]
  if (hasMatchups) tabs.push({ key: 'matchups', label: 'Matchups' })
  tabs.push({ key: 'pairings', label: 'Pairings' }, { key: 'photos', label: 'Photos' })
  return { tabs, registerLabel: canRegister ? (fee ? `Register · ${fee}` : 'Register') : null }
}

/** Screen-reader text for the countdown, e.g. "17 days, 12 hours, 9 minutes until first tee". */
export function countdownLabel(r) {
  if (!r) return ''
  const part = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`
  return `${part(r.days, 'day')}, ${part(r.hours, 'hour')}, ${part(r.minutes, 'minute')} until first tee`
}

/**
 * Match cards for the public page. Same stroke maths the Matchups tab uses: the lower
 * course handicap plays off scratch, the other gets the difference.
 */
export function matchupRows(pairings, eventPlayers) {
  const byPlayer = Object.fromEntries((eventPlayers ?? []).map(ep => [ep.player_id, ep]))
  const name = p => [p?.first_name, p?.last_name].filter(Boolean).join(' ')
  return (pairings ?? []).map(p => {
    const chA = byPlayer[p.player_a_id]?.course_handicap ?? 0
    const chB = byPlayer[p.player_b_id]?.course_handicap ?? 0
    const base = Math.min(chA, chB)
    return {
      id: p.id,
      number: p.match_number,
      a: { name: name(p.playerA), strokes: Math.max(0, chA - base) },
      b: { name: name(p.playerB), strokes: Math.max(0, chB - base) },
    }
  })
}

/** "13:05" or "13:05:00" → "1:05 PM"; empty for no time. */
export function time12(t) {
  if (!t) return ''
  const [h, m] = String(t).split(':').map(Number)
  if (Number.isNaN(h)) return ''
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** Same Google Maps embed the Overview tab has always used; null without an address. */
export function mapEmbedUrl(address) {
  return address ? `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed` : null
}
