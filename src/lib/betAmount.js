/** Bet amounts on the public form: $5 minimum, $5 steps. Pure helpers for the − / + buttons. */
export const MIN_BET = 5
export const STEP = 5

const snap = v => Math.max(MIN_BET, Math.round(v / STEP) * STEP)

/** Number from the amount field's text, or 0. */
export function amountOf(text) {
  const n = parseFloat(text)
  return Number.isFinite(n) ? n : 0
}

/** One $5 step down (never below $5) or up. An empty field starts at $5. */
export function stepAmount(text, dir) {
  const cur = amountOf(text)
  if (cur <= 0) return String(MIN_BET)
  return String(snap(dir < 0 ? cur - STEP : cur + STEP))
}

/** Snap whatever was typed to the nearest valid amount ($5 minimum, $5 steps). */
export function snapAmount(text) {
  const cur = amountOf(text)
  return cur <= 0 ? String(MIN_BET) : String(snap(cur))
}

/** True when a value is a whole number of $5 steps and at least $5. */
export function isValidAmount(text) {
  const n = amountOf(text)
  return n >= MIN_BET && Math.abs(n / STEP - Math.round(n / STEP)) < 1e-9
}

export function totalOf(picks) {
  return picks.reduce((t, p) => t + amountOf(p.amount), 0)
}
