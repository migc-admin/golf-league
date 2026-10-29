/**
 * PrizeInput — a "$ per player" money box for the Payout setup tables. 44px tall, tabular
 * numbers, a "$" in front, and a real accessible name. Greyed and read-only when `disabled`.
 * The value is passed through as typed; the page's existing `setVal` turns it into a number.
 */

export default function PrizeInput({ value, onChange, label, disabled = false, className = '' }) {
  return (
    <label className={`flex items-center gap-1.5 ${className}`.trim()}>
      <span aria-hidden="true" className="text-sm text-ink-muted">$</span>
      <input
        type="number"
        inputMode="decimal"
        min="0"
        step="0.01"
        aria-label={label}
        disabled={disabled}
        value={value ?? 0}
        onChange={e => onChange(e.target.value)}
        className="input h-11 w-24 text-right tabular-nums disabled:cursor-not-allowed disabled:bg-surface-container disabled:text-ink-muted"
      />
    </label>
  )
}
