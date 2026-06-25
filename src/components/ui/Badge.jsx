// Change 2: Generalized status chip variants
// Pattern: pill-shaped, low-saturation tint bg + high-saturation same-hue text
const variants = {
  // Status chips
  active:   'bg-fairway-100 text-fairway-700',
  upcoming: 'bg-gold-100 text-gold-600',
  complete: 'bg-gray-100 text-gray-500',
  // Colour chips (legacy + extras)
  green:    'bg-fairway-100 text-fairway-800',
  blue:     'bg-blue-100 text-blue-800',
  yellow:   'bg-yellow-100 text-yellow-800',
  red:      'bg-red-100 text-red-800',
  gray:     'bg-gray-100 text-gray-700',
  purple:   'bg-purple-100 text-purple-800',
  orange:   'bg-orange-100 text-orange-800',
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
    active:   { variant: 'active',   label: 'Active' },
    complete: { variant: 'complete', label: 'Complete' },
  }
  const { variant, label } = map[status] ?? { variant: 'gray', label: status }
  return <Badge variant={variant}>{label}</Badge>
}

// Change 2: Score chip — under par = red, even/over = default text
export function ScoreBadge({ score, par }) {
  const diff = score - par
  if (diff < 0) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-[#BA1A1A]">
        {score}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
      {score}
    </span>
  )
}
