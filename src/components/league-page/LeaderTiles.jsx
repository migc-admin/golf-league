/**
 * LeaderTiles — the row of four season leaders under the tabs. The money leader tile is tinted
 * light green; the others are white. `tiles` is [{ key, label, name, sub, lead }].
 */
export default function LeaderTiles({ tiles }) {
  if (!tiles.length) return null
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map(t => (
        <div key={t.key} className={`min-w-0 rounded-sm border p-4 ${t.lead ? 'border-fairway-200 bg-fairway-50' : 'border-surface-border bg-white'}`}>
          <div className={`text-[11px] font-bold uppercase tracking-[0.1em] ${t.lead ? 'text-fairway-700' : 'text-ink-muted'}`}>{t.label}</div>
          <div className="mt-1 truncate text-[17px] font-bold text-ink">{t.name}</div>
          {t.sub && <div className={`text-sm ${t.lead ? 'text-fairway-700' : 'text-ink-muted'}`}>{t.sub}</div>}
        </div>
      ))}
    </div>
  )
}
