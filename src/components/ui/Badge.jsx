// Design system: two status tints only (active green / upcoming tan). No gold.
const variants = {
  // Status chips — DESIGN.md tints
  active:   'bg-status-active-bg   text-status-active-text',
  upcoming: 'bg-status-upcoming-bg text-status-upcoming-text',
  complete: 'bg-surface-high text-ink-muted',
  // General purpose
  green:    'bg-status-active-bg text-status-active-text',
  blue:     'bg-blue-50 text-blue-700',
  yellow:   'bg-status-upcoming-bg text-status-upcoming-text',
  red:      'bg-red-50 text-red-700',
  gray:     'bg-surface-high text-ink-muted',
  purple:   'bg-purple-50 text-purple-700',
  orange:   'bg-orange-50 text-orange-700',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant] ?? variants.gray} ${className}`}>
      {children}
    </span>
  )
}

export function FlightBadge({ flight }) {
  return (
    <Badge variant={flight === 'A' ? 'blue' : 'purple'}>
      Flight {flight}
    </Badge>
  )
}

export function StatusBadge({ status }) {
  const map = {
    upcoming: { variant: 'upcoming', label: 'Upcoming' },
    active:   { variant: 'active',   label: 'Live' },
    complete: { variant: 'complete', label: 'Complete' },
  }
  const { variant, label } = map[status] ?? { variant: 'gray', label: status }
  return <Badge variant={variant}>{label}</Badge>
}

// Score chip — under par = Forest Green, even/over = ink
export function ScoreBadge({ score, par }) {
  const diff = score - par
  if (diff < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-status-active-bg text-status-active-text">
        {score}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-surface-high text-ink-muted">
      {score}
    </span>
  )
}
