import { Link } from 'react-router-dom'
import Button from '../ui/Button'

const TAB = 'inline-flex min-h-[48px] shrink-0 items-center whitespace-nowrap border-b-[3px] px-4 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500 sm:px-5'

/**
 * Sticky tab bar for the public event page. The tabs scroll sideways on phones; the
 * Register button (only passed while registration is open) stays pinned at the right end.
 * Props: tabs [{ key, label }], value, onChange(key), leaderboardUrl, registerLabel, registerHref.
 */
export default function EventTabBar({ tabs, value, onChange, leaderboardUrl, registerLabel, registerHref }) {
  function onKeyDown(e, i) {
    const last = tabs.length - 1
    const next = e.key === 'ArrowRight' ? (i === last ? 0 : i + 1)
      : e.key === 'ArrowLeft' ? (i === 0 ? last : i - 1)
      : e.key === 'Home' ? 0 : e.key === 'End' ? last : null
    if (next === null) return
    e.preventDefault()
    onChange(tabs[next].key)
    if (typeof document !== 'undefined') document.getElementById(`event-tab-${tabs[next].key}`)?.focus()
  }

  return (
    <div className="sticky top-0 z-20 border-b border-surface-border bg-white">
      <div className="mx-auto flex max-w-[1100px] items-center gap-2 px-2 sm:px-4">
        <div className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div role="tablist" aria-label="Event sections" className="flex">
            {tabs.map((t, i) => {
              const on = t.key === value
              return (
                <button
                  key={t.key}
                  id={`event-tab-${t.key}`}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  tabIndex={on ? 0 : -1}
                  onClick={() => onChange(t.key)}
                  onKeyDown={e => onKeyDown(e, i)}
                  className={`${TAB} ${on ? 'border-fairway-700 text-fairway-700' : 'border-transparent text-ink-muted hover:text-ink'}`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          <Link to={leaderboardUrl} className={`${TAB} border-transparent text-ink-muted hover:text-ink`}>Leaderboard ↗</Link>
        </div>
        {registerLabel && (
          <Button as={Link} to={registerHref} size="md" className="shrink-0">{registerLabel}</Button>
        )}
      </div>
    </div>
  )
}
