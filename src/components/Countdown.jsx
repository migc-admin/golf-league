import { useEffect, useState } from 'react'

const GREEN = '#2D6A4F'
const GOLD  = '#D4AF37'

function getRemaining(targetDate) {
  const diff = targetDate.getTime() - Date.now()
  if (diff <= 0) return null
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours   = Math.floor((diff / (1000 * 60 * 60)) % 24)
  const minutes = Math.floor((diff / (1000 * 60)) % 60)
  const seconds = Math.floor((diff / 1000) % 60)
  return { days, hours, minutes, seconds }
}

/**
 * Countdown clock — Days / Hours / Minutes / Seconds to a target Date.
 * Renders nothing once the target has passed.
 */
export default function Countdown({ targetDate, label = 'Countdown to First Tee Time' }) {
  const [remaining, setRemaining] = useState(() => getRemaining(targetDate))

  useEffect(() => {
    const tick = () => setRemaining(getRemaining(targetDate))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetDate])

  if (!remaining) return null

  return (
    <div style={{
      background: GREEN, borderRadius: 14, padding: '12px 16px',
      marginBottom: 20,
    }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, textAlign: 'center' }}>
          {label}
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
        <Unit value={remaining.days}    label="Days"    />
        <Sep />
        <Unit value={remaining.hours}   label="Hours"   />
        <Sep />
        <Unit value={remaining.minutes} label="Min"     />
        <Sep />
        <Unit value={remaining.seconds} label="Sec"     />
      </div>
    </div>
  )
}

function Unit({ value, label }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 44 }}>
      <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {String(value).padStart(2, '0')}
      </div>
      <div style={{ fontSize: 9, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 4 }}>
        {label}
      </div>
    </div>
  )
}

function Sep() {
  return <div style={{ fontSize: 20, fontWeight: 700, color: 'rgba(255,255,255,0.25)', alignSelf: 'flex-start', marginTop: 1 }}>:</div>
}
