import { TIER_LABELS } from '../../lib/features'

const TIER_COLORS = {
  free:  'bg-gray-100 text-gray-600',
  pro:   'bg-blue-100 text-blue-700',
  elite: 'bg-amber-100 text-amber-700',
}

export default function TierBadge({ tier }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${TIER_COLORS[tier] ?? TIER_COLORS.free}`}>
      {TIER_LABELS[tier] ?? tier}
    </span>
  )
}
