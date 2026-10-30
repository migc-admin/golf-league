import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import WagerPayoutSummary from './WagerPayoutSummary'
import { fetchLogoDataUrl } from '../../lib/logoData'

/**
 * PngWagerSummary — mounts the payout summary off-screen, waits for the league logo and fonts,
 * renders it to a PNG with html-to-image and downloads it. Same technique as the board's share card.
 * Props are WagerPayoutSummary's (minus logo handling) plus `filename` and `onDone`.
 */
export default function PngWagerSummary({ onDone, logoUrl, filename, ...sheet }) {
  // undefined = still loading, null = no usable logo (initials fallback), string = embedded data URL
  const [logo, setLogo] = useState(undefined)

  useEffect(() => {
    let cancelled = false
    fetchLogoDataUrl(logoUrl).then(d => { if (!cancelled) setLogo(d) })
    return () => { cancelled = true }
  }, [logoUrl])

  useEffect(() => {
    if (logo === undefined) return undefined
    let cancelled = false
    async function go() {
      try {
        const root = document.getElementById('wager-summary-root')
        if (!root) return
        const { toPng } = await import('html-to-image')
        const imgs = [...root.querySelectorAll('img')]
        await Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())))
        if (document.fonts?.ready) await document.fonts.ready
        await new Promise(r => setTimeout(r, 80))
        if (cancelled) return
        const dataUrl = await toPng(root.firstElementChild, { pixelRatio: 2, cacheBust: true, backgroundColor: '#ffffff' })
        const link = document.createElement('a')
        link.download = filename
        link.href = dataUrl
        link.click()
      } catch (err) {
        console.error('Wager summary PNG failed:', err)
        alert('Could not create the image: ' + (err?.message ?? err))
      } finally {
        if (!cancelled) onDone?.()
      }
    }
    go()
    return () => { cancelled = true }
  }, [logo, filename, onDone])

  if (logo === undefined) return null
  return createPortal(
    <div id="wager-summary-root" aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0 }}>
      <WagerPayoutSummary {...sheet} logoUrl={logo} />
    </div>,
    document.body,
  )
}
