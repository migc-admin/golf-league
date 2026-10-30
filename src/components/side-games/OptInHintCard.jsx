import SectionCard from '../ui/SectionCard'

/**
 * OptInHintCard — shown on the Side Games tab while no game has "Separate buy-in" turned on, so the
 * missing opt-in link and QR aren't a mystery. Text only; nothing here changes any setting.
 */
const STEPS = [
  'Open Edit Event (the pencil icon) and tick "Separate buy-in" under the game.',
  'Set the $ per entrant in the Payout tab.',
  'Come back here for the opt-in link. The Check-in QR sign is under Print & share.',
]

export default function OptInHintCard({ className = '' }) {
  return (
    <SectionCard
      title="Let players join and pay for a side game"
      subtitle="Games with a separate buy-in get their own opt-in list, link and QR sign. No game has one yet."
      className={className}
    >
      <ol className="space-y-2.5">
        {STEPS.map((s, i) => (
          <li key={i} className="flex items-start gap-3 text-sm text-ink">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-status-active-bg text-xs font-bold text-status-active-text" aria-hidden="true">{i + 1}</span>
            <span className="pt-0.5">{s}</span>
          </li>
        ))}
      </ol>
    </SectionCard>
  )
}
