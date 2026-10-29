/**
 * SegmentedToggle — a small either/or switch ("By player | By category").
 * A labelled group of real buttons; the selected one reports `aria-pressed`. 44px tall.
 * Presentational and controlled.
 */

export default function SegmentedToggle({ options, value, onChange, label, className = '' }) {
  return (
    <div role="group" aria-label={label} className={`inline-flex overflow-hidden rounded-sm border border-surface-highest ${className}`.trim()}>
      {options.map((o, i) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={`min-h-[44px] px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 ${
              i > 0 ? 'border-l border-surface-highest' : ''
            } ${on ? 'bg-fairway-700 text-white' : 'bg-white text-ink hover:bg-surface-dim'}`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
