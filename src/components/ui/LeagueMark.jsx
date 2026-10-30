import { useEffect, useState } from 'react'
import { initialsOf } from '../../lib/logoData'

/**
 * The league's own logo, fitted inside a square (`object-fit: contain`, never stretched or cropped).
 * With no logo, or if the image fails to load, a forest-green circle with the league's initials in gold.
 * Never shows a broken-image icon.
 */
export default function LeagueMark({ name, logoUrl, size = 40, className = '' }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => { setFailed(false) }, [logoUrl])

  if (!logoUrl || failed) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-fairway-700 font-extrabold ${className}`.trim()}
        style={{ width: size, height: size, fontSize: Math.round(size * 0.38), color: '#C9A84C' }}
        aria-hidden="true"
      >
        {initialsOf(name)}
      </span>
    )
  }
  return (
    <img
      src={logoUrl}
      alt={`${name ?? 'League'} logo`}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className={`shrink-0 object-contain ${className}`.trim()}
      style={{ width: size, height: size }}
    />
  )
}
