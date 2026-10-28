/**
 * StatTiles — a row of separate stat cards (label over big number).
 *
 *   [ Players 4 ] [ Flight A 0 ] [ Flight B 0 ] [ Unassigned 4 ]
 *
 * Each tile is `{ label, value, tone }`. `tone: 'warn'` uses the gold "Upcoming" tint
 * (the page passes it for Unassigned only while the count is above 0); anything else is
 * a neutral white card. 4 across on wide screens, 2 across on narrow ones.
 */

export default function StatTiles({ tiles, className = '' }) {
  return (
    <div className={`grid grid-cols-2 gap-3 min-[700px]:grid-cols-4 ${className}`.trim()}>
      {tiles.map(t => {
        const warn = t.tone === 'warn'
        return (
          <div
            key={t.label}
            className={`rounded-sm border px-4 py-3 ${
              warn ? 'border-surface-border bg-status-upcoming-bg' : 'border-surface-border bg-white'
            }`}
          >
            <p className={`text-xs ${warn ? 'text-status-upcoming-text' : 'text-ink-muted'}`}>{t.label}</p>
            <p className={`mt-0.5 text-2xl font-bold tabular-nums ${warn ? 'text-status-upcoming-text' : 'text-ink'}`}>
              {t.value ?? 0}
            </p>
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
