// Rank number for the public league lists: 1st gold tint, 2nd and 3rd neutral tints, the rest a plain number.
const TINT = {
  1: 'bg-status-upcoming-bg text-status-upcoming-text',
  2: 'bg-surface-highest text-ink',
  3: 'bg-surface-container text-ink-muted',
}

export default function RankBadge({ n }) {
  if (n == null) return <span className="flex h-7 w-7 items-center justify-center text-sm text-ink-muted">–</span>
  return TINT[n]
    ? <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${TINT[n]}`}>{n}</span>
    : <span className="flex h-7 w-7 items-center justify-center text-sm font-semibold text-ink-muted">{n}</span>
}
