/**
 * Trip costs: what each person pays, from the trip's cost items (trips.cost_items).
 *
 *   Item: { id, label, kind: 'lodging'|'golf'|'other', event_id, mode: 'per_person'|'split',
 *           amount, split_count }
 *
 * A 'split' item is a shared total (a $3,000 rental) divided by its own split_count, else the
 * trip's planned headcount — so the price someone sees when registering is fixed and does not
 * change as other people sign up. A 'golf' item belongs to one round (event_id) and is only
 * charged to people who pick that round. Pure functions; nothing here touches the database.
 */

export const COST_KINDS = { lodging: 'Lodging', golf: 'Golf', other: 'Other' }

const num = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}
const cents = n => Math.round(n * 100) / 100

export function costItems(trip) {
  return Array.isArray(trip?.cost_items) ? trip.cost_items : []
}

/** Per-person price of one item, or null when a split item has nobody to split between. */
export function perPerson(item, plannedHeadcount) {
  const amount = num(item?.amount)
  if (item?.mode !== 'split') return cents(amount)
  const by = num(item.split_count) > 0 ? num(item.split_count) : num(plannedHeadcount)
  return by > 0 ? cents(amount / by) : null
}

/** The golf item for a round, if the trip has priced it. */
export function roundItem(trip, eventId) {
  return costItems(trip).find(i => i.kind === 'golf' && i.event_id === eventId) ?? null
}

/**
 * A registrant's quote.
 *   golfing: whether they play golf at all; roundIds: the rounds they picked.
 * Returns { lines: [{ id, label, kind, price }], total }. Non-golf items apply to everyone;
 * golf items only for picked rounds. Items with no price yet (split with no headcount) are left out.
 */
export function quote(trip, { golfing = true, roundIds = [], staying = null } = {}) {
  const picked = new Set(golfing ? roundIds : [])
  const lines = []
  for (const item of costItems(trip)) {
    if (item.kind === 'golf' && !picked.has(item.event_id)) continue
    // Not staying in the rental: no lodging share.
    if (item.kind === 'lodging' && staying === false) continue
    const price = perPerson(item, trip?.planned_headcount)
    if (price == null) continue
    lines.push({ id: item.id, label: item.label, kind: item.kind, price })
  }
  return { lines, total: cents(lines.reduce((s, l) => s + l.price, 0)) }
}

/** Whether the trip's lodging is a rental (non-hotel), so the sign-up form asks who is staying in it. */
export function isRental(trip) {
  return trip?.lodging?.type === 'rental'
}

/** The organizer's sign-up questions: { label, required, type: 'text'|'yes_no', cost }. */
export function signupQuestions(trip) {
  return (Array.isArray(trip?.custom_questions) ? trip.custom_questions : [])
    .filter(q => q?.label?.trim())
    .map(q => ({ ...q, type: q.type === 'yes_no' ? 'yes_no' : 'text', cost: num(q.cost) > 0 ? cents(num(q.cost)) : null }))
}

/**
 * The whole sign-up's price: the registrant, an optional guest (priced exactly like a person),
 * and each Yes answer to a question that has a cost (added once).
 *   person / guest: { golfing, roundIds, staying }   answers: { [questionIndex]: 'yes'|'no'|text }
 */
export function signupQuote(trip, { person, guest = null, answers = {} }) {
  const people = [{ who: 'you', ...quote(trip, person) }]
  if (guest) people.push({ who: 'guest', ...quote(trip, guest) })
  const extras = signupQuestions(trip)
    .map((q, i) => ({ q, i }))
    .filter(({ q, i }) => q.type === 'yes_no' && q.cost && answers[i] === 'yes')
    .map(({ q }) => ({ label: q.label.trim(), price: q.cost }))
  const total = cents(people.reduce((s, p) => s + p.total, 0) + extras.reduce((s, e) => s + e.price, 0))
  return { people, extras, total }
}

/** "$300" / "$62.50"; "Included" for a $0 item. */
export function money(n) {
  const v = num(n)
  if (v === 0) return 'Included'
  return `$${v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)}`
}

/** "$3,000 split 10 ways" / "per person" — how an item's price was worked out, for the admin and the form. */
export function priceBasis(item, plannedHeadcount) {
  if (item?.mode !== 'split') return 'per person'
  const by = num(item.split_count) > 0 ? num(item.split_count) : num(plannedHeadcount)
  const total = `$${num(item.amount).toLocaleString('en-US', { maximumFractionDigits: 2 })}`
  return by > 0 ? `${total} split ${by} ways` : `${total} total, set a headcount to split it`
}

let seq = 0
export function newCostItem(fields = {}) {
  return { id: `c${Date.now().toString(36)}${(seq++).toString(36)}`, label: '', kind: 'other', event_id: null, mode: 'per_person', amount: '', split_count: null, ...fields }
}
