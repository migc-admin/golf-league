const variants = {
  green:  'bg-fairway-100 text-fairway-800',
  blue:   'bg-blue-100 text-blue-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red:    'bg-red-100 text-red-800',
  gray:   'bg-gray-100 text-gray-700',
  purple: 'bg-purple-100 text-purple-800',
  orange: 'bg-orange-100 text-orange-800',
}

export default function Badge({ children, variant = 'gray', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant]} ${className}`}>
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
    upcoming: { variant: 'yellow', label: 'Upcoming' },
    active:   { variant: 'green',  label: 'Active' },
    complete: { variant: 'gray',   label: 'Complete' },
  }
  const { variant, label } = map[status] ?? { variant: 'gray', label: status }
  return <Badge variant={variant}>{label}</Badge>
}
