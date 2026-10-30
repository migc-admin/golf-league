import { useEffect, useState } from 'react'
import { fetchLogoDataUrl } from './logoData'

/**
 * Fetches the league logo as a data URL so a PNG capture never races a network request.
 * Returns { logo, ready }: `logo` is the data URL (or null for the initials fallback); `ready`
 * turns true once the fetch has finished either way.
 */
export function useEmbeddedLogo(url) {
  const [state, setState] = useState({ logo: null, ready: false })
  useEffect(() => {
    let cancelled = false
    setState({ logo: null, ready: false })
    fetchLogoDataUrl(url).then(d => { if (!cancelled) setState({ logo: d, ready: true }) })
    return () => { cancelled = true }
  }, [url])
  return state
}
