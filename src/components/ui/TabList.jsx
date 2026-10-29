/**
 * TabList — an accessible row of tabs (the Payout page's "Results | Setup").
 *
 * A real tablist: each tab is a button with role="tab" and aria-selected, only the selected one is
 * in the tab order, and the left/right arrow keys (and Home/End) move between tabs. `panelId` ties
 * the tabs to the panel they control. `lockedTabs` shows a small lock icon on those tabs.
 * Presentational and controlled.
 */

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 018 0v3" />
    </svg>
  )
}

export default function TabList({ tabs, value, onChange, label, panelId, lockedTabs = [], className = '' }) {
  function onKeyDown(e, index) {
    const last = tabs.length - 1
    let next = null
    if (e.key === 'ArrowRight') next = index === last ? 0 : index + 1
    else if (e.key === 'ArrowLeft') next = index === 0 ? last : index - 1
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = last
    if (next === null) return
    e.preventDefault()
    onChange(tabs[next].value)
    if (typeof document !== 'undefined') document.getElementById(`tab-${tabs[next].value}`)?.focus()
  }

  return (
    <div role="tablist" aria-label={label} className={`flex gap-1 border-b border-surface-border ${className}`.trim()}>
      {tabs.map((t, i) => {
        const on = t.value === value
        return (
          <button
            key={t.value}
            id={`tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={on}
            aria-controls={panelId}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.value)}
            onKeyDown={e => onKeyDown(e, i)}
            className={`-mb-px inline-flex min-h-[44px] items-center gap-1.5 border-b-2 px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 ${
              on ? 'border-fairway-700 text-fairway-700' : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
            {lockedTabs.includes(t.value) && <LockIcon />}
          </button>
        )
      })}
    </div>
  )
}
