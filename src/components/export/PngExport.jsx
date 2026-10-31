import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ActionButton } from '../ui/Button'
import { fetchLogoDataUrl } from '../../lib/logoData'
import { downloadPng } from '../../lib/downloadPng'

/**
 * PngExport — mounts a sheet off-screen, waits for the league logo and fonts, captures it with
 * html-to-image and downloads the PNG. `children` is a function that receives the embedded logo
 * (a data URL, or null for the initials fallback) so the logo can never be blank in the capture.
 */
export default function PngExport({ logoUrl, filename, onDone, children }) {
  // undefined = still loading, null = no usable logo (initials fallback), string = embedded data URL
  const [logo, setLogo] = useState(undefined)
  const rootRef = useRef(null)

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
        const root = rootRef.current
        if (!root) return
        const { toPng } = await import('html-to-image')
        await Promise.all([...root.querySelectorAll('img')].map(i => (i.decode ? i.decode().catch(() => {}) : Promise.resolve())))
        if (document.fonts?.ready) await document.fonts.ready
        await new Promise(r => setTimeout(r, 80))
        if (cancelled) return
        const dataUrl = await toPng(root.firstElementChild, { pixelRatio: 2, cacheBust: true, backgroundColor: '#ffffff' })
        downloadPng(dataUrl, filename)
      } catch (err) {
        console.error('PNG export failed:', err)
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
    <div ref={rootRef} aria-hidden="true" style={{ position: 'fixed', left: -10000, top: 0 }}>
      {children(logo)}
    </div>,
    document.body,
  )
}

/**
 * The "Download" button used on the Results rows. `prepare` may load extra data first (it returns
 * what `children(logo, data)` needs); throw an Error from it to show a message under the button.
 */
export function ExportPngButton({ filename, logoUrl, prepare, children }) {
  const [busy, setBusy] = useState(false)
  const [job, setJob] = useState(null)
  const [error, setError] = useState(null)

  async function start() {
    setError(null)
    setBusy(true)
    try {
      const data = prepare ? await prepare() : null
      setJob({ data })
    } catch (err) {
      setError(err?.message ?? 'Export failed')
      setBusy(false)
    }
  }
  const finish = () => { setJob(null); setBusy(false) }

  return (
    <>
      <ActionButton icon="download" onClick={start} loading={busy}>{busy ? 'Exporting…' : 'Download'}</ActionButton>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {job && <PngExport logoUrl={logoUrl} filename={filename} onDone={finish}>{logo => children(logo, job.data)}</PngExport>}
    </>
  )
}
