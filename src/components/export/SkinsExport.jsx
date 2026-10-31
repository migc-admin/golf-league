import { useCallback, useEffect, useState } from 'react'
import { ActionButton } from '../ui/Button'
import PngExport from './PngExport'
import SkinsGridSheet from './SkinsGridSheet'
import { skinsGridViews } from '../../lib/skinsGridView'

const slug = event => (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()

/**
 * "Skins by flight" PNG download. Same props as before; one PNG per flight (and per Super Skins
 * flight), downloaded one after another with the same file names.
 */
export default function ExportSkinsGridButton({ event, eventPlayers, allScores, course, orgName, orgLogoUrl }) {
  const [views, setViews] = useState(null)
  const [index, setIndex] = useState(0)
  const [error, setError] = useState(null)

  const sides = event?.side_game_options ?? []
  const available = sides.some(s => s.startsWith('skins')) || sides.some(s => s === 'super_skins' || /^super_skins_[a-z]$/.test(s))
  const next = useCallback(() => setIndex(i => i + 1), [])
  const finished = views && index >= views.length
  useEffect(() => { if (finished) setViews(null) }, [finished])
  if (!available) return null

  function start() {
    setError(null)
    if (!course) { setError('No course loaded.'); return }
    try {
      const v = skinsGridViews({ event, eventPlayers, allScores, course })
      if (v.length === 0) { setError('No skins to export.'); return }
      setIndex(0)
      setViews(v)
    } catch (err) {
      setError(err?.message ?? 'Export failed')
    }
  }

  const current = views && !finished ? views[index] : null

  return (
    <>
      <ActionButton icon="download" onClick={start} loading={!!views}>{views ? 'Exporting…' : 'Download'}</ActionButton>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
      {current && (
        <PngExport
          key={index}
          logoUrl={orgLogoUrl}
          filename={`${current.file}_${slug(event)}${current.flightKey ? `_flight${current.flightKey}` : ''}.png`}
          onDone={next}
        >
          {logo => <SkinsGridSheet view={current} leagueName={orgName} logoUrl={logo} />}
        </PngExport>
      )}
    </>
  )
}
