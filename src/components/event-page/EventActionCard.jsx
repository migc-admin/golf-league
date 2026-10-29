import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getRemaining } from '../Countdown'
import { countdownLabel } from '../../lib/eventPageView'
import Button from '../ui/Button'

function Unit({ value, label }) {
  return (
    <div className="flex min-w-[56px] flex-col items-center">
      <div className="text-[28px] font-extrabold leading-none text-white tabular-nums">{String(value).padStart(2, '0')}</div>
      <div className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-fairway-200">{label}</div>
    </div>
  )
}

// Same tick logic as Countdown.jsx (getRemaining, 1s interval); only the look differs.
// The spoken label changes at most once a minute so screen readers aren't flooded.
function CountdownBand({ targetDate }) {
  const [remaining, setRemaining] = useState(() => getRemaining(targetDate))
  useEffect(() => {
    const tick = () => setRemaining(getRemaining(targetDate))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])
  const [spoken, setSpoken] = useState(() => countdownLabel(remaining))
  const minuteLabel = countdownLabel(remaining)
  useEffect(() => { setSpoken(minuteLabel) }, [minuteLabel])

  if (!remaining) return null
  return (
    <div className="bg-fairway-700 px-5 py-4 text-center" role="timer" aria-label={spoken}>
      <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fairway-200" aria-hidden="true">First tee in</div>
      <div className="flex items-start justify-center gap-2 sm:gap-3" aria-hidden="true">
        <Unit value={remaining.days} label="Days" />
        <Unit value={remaining.hours} label="Hrs" />
        <Unit value={remaining.minutes} label="Min" />
        <Unit value={remaining.seconds} label="Sec" />
      </div>
    </div>
  )
}

/**
 * Hero action card.
 *   kind 'open'     — countdown + fee + Register now
 *   kind 'closed'   — countdown (if still ahead) + "Registration closed", no Register
 *   kind 'complete' — final leaderboard + photos buttons, no Register
 */
export default function EventActionCard({ kind, targetDate, fee, regUrl, leaderboardUrl, onPhotos }) {
  if (kind === 'complete') {
    return (
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button as={Link} to={leaderboardUrl} size="lg" className="w-full sm:w-auto">See final leaderboard →</Button>
        <Button variant="secondary" size="lg" className="w-full sm:w-auto" onClick={onPhotos}>Event photos</Button>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-sm border border-surface-border bg-white">
      {targetDate && <CountdownBand targetDate={targetDate} />}
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        {kind === 'open' ? (
          <>
            {fee && (
              <div>
                <div className="text-[32px] font-extrabold leading-none text-ink tabular-nums" style={{ letterSpacing: '-0.02em' }}>{fee}</div>
                <div className="mt-1 text-sm text-ink-muted">Entry fee per player</div>
              </div>
            )}
            <Button id="hero-register" as={Link} to={regUrl} size="lg" className="w-full sm:w-auto sm:ml-auto">Register now →</Button>
          </>
        ) : (
          <div className="text-[15px] font-bold text-ink">Registration closed</div>
        )}
      </div>
    </div>
  )
}
