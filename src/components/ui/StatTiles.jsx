/**
 * StatTiles — a row of separate stat cards (label over big number).
 *
 *   [ Players 4 ] [ Flight A 0 ] [ Flight B 0 ] [ Unassigned 4 ]
 *
 * Each tile is `{ label, value, tone, helper }`. `tone: 'warn'` uses the gold "Upcoming" tint
 * (the page passes it, e.g. for Unassigned while the count is above 0); `tone: 'good'` the light
 * green "active" tint; anything else is a neutral white card. `helper` is a small line under the number. 4 across on wide screens, 2 across on narrow ones.
 */

export default function StatTiles({ tiles, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-3 min-[700px]:grid-cols-4 ${className}`.trim()}>
      {tiles.map(t => {
        const warn = t.tone === 'warn'
        const good = t.tone === 'good'
        return (
          <div
            key={t.label}
            className={`rounded-sm border border-surface-border px-4 py-3 ${
              warn ? 'bg-status-upcoming-bg' : good ? 'bg-status-active-bg' : 'bg-white'
            }`}
          >
            <p className={`text-xs ${warn ? 'text-status-upcoming-text' : good ? 'text-status-active-text' : 'text-ink-muted'}`}>{t.label}</p>
            <p className={`mt-0.5 text-2xl font-bold tabular-nums ${warn ? 'text-status-upcoming-text' : good ? 'text-status-active-text' : 'text-ink'}`}>
              {t.value ?? 0}
            </p>
            {t.helper && (
              <p className={`mt-0.5 text-xs ${warn ? 'text-status-upcoming-text' : good ? 'text-status-active-text' : 'text-ink-muted'}`}>{t.helper}</p>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * The four Players-page tiles from existing roster data. Guests are not counted as
 * players or flights, matching the Overview Participants card.
 */
export function playerTiles(eventPlayers) {
  const nonGuests = (eventPlayers ?? []).filter(p => !p.is_guest)
  const unassigned = nonGuests.filter(p => !p.flight).length
  return [
    { label: 'Players', value: nonGuests.length },
    { label: 'Flight A', value: nonGuests.filter(p => p.flight === 'A').length },
    { label: 'Flight B', value: nonGuests.filter(p => p.flight === 'B').length },
    { label: 'Unassigned', value: unassigned, tone: unassigned > 0 ? 'warn' : 'neutral' },
  ]
}
