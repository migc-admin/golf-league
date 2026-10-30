/** Display helpers for the public registration page. Pure; nothing here touches what is saved. */

/** "8640 Rush St, Rosemead, CA 91770" -> "Rosemead". Null when the address isn't in that shape. */
export function cityOf(address) {
  const parts = String(address ?? '').split(',').map(s => s.trim()).filter(Boolean)
  if (parts.length < 3) return null
  return /^[A-Za-z]{2}\b(\s+\d{5}(-\d{4})?)?$/.test(parts[parts.length - 1]) ? parts[parts.length - 2] : null
}

/** "$160" for whole dollars, "$160.50" otherwise. */
export function feeText(n) {
  const v = Number(n)
  if (!Number.isFinite(v)) return ''
  return Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`
}

/** First schedule entry that mentions a tee time, as "9:00 AM" (null when there is none). */
export function firstTeeTime(items, time12) {
  const hit = (items ?? []).find(s => /tee/i.test(s?.label ?? '') && s?.time)
  return hit ? time12(hit.time) : null
}

const list = a => (a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)

/**
 * The red alert text for a submit with missing fields.
 * names: ['first name', 'last name'] · questions: the labels of required questions left blank.
 */
export function missingMessage({ names = [], questions = [] }) {
  const parts = []
  if (names.length) parts.push(`add your ${list(names)}`)
  if (questions.length) parts.push(`answer ${list(questions.map(q => `“${q}”`))}`)
  return parts.length ? `Please ${parts.join(' and ')} to finish registering.` : ''
}
