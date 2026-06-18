import { useState } from 'react'
import { fetchScorecardData } from '../lib/fetchScorecardData'

export function useScorecardExport(eventId) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  async function exportScorecards() {
    setLoading(true)
    setError(null)
    try {
      const payload = await fetchScorecardData(eventId)
      const res     = await fetch('/api/generate_scorecard', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`Server error ${res.status}: ${text}`)
      }

      const { pages } = await res.json()

      pages.forEach((b64, i) => {
        const link    = document.createElement('a')
        link.href     = `data:image/png;base64,${b64}`
        link.download = `scorecards_page${i + 1}.png`
        link.click()
      })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return { exportScorecards, loading, error }
}
