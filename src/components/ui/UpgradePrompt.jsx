/**
 * UpgradePrompt — modal shown when a user hits a tier limit or locked feature.
 */
import Modal from './Modal'
import { TIER_LABELS } from '../../lib/features'

const GREEN = '#1B4332'

export default function UpgradePrompt({ open, onClose, reason, requiredTier }) {
  const tierLabel = TIER_LABELS[requiredTier] ?? 'Pro'

  return (
    <Modal open={open} onClose={onClose} title="Upgrade to continue">
      <div className="space-y-5">
        {/* Icon */}
        <div className="flex justify-center">
          <div style={{
            width: 56, height: 56,
            borderRadius: '50%',
            background: '#f0fdf4',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" fill="none" stroke={GREEN} strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 15v2m0 0v2m0-2h2m-2 0H10m2-6V7m0 0a5 5 0 100 10A5 5 0 0012 7z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M15 12h.01M9 12h.01" />
            </svg>
          </div>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 mb-1">{reason}</p>
          <p className="text-sm text-gray-500">
            Upgrade to{' '}
            <span className="font-semibold" style={{ color: GREEN }}>{tierLabel}</span>
            {' '}to unlock this feature.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-1">
          <a
            href="/onboarding"
            className="block text-center py-2.5 rounded-full text-sm font-bold text-white transition-opacity hover:opacity-90"
            style={{ background: GREEN }}
          >
            Upgrade to {tierLabel}
          </a>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors py-1"
          >
            Not now
          </button>
        </div>
      </div>
    </Modal>
  )
}
