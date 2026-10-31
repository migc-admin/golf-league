import { supabase } from '../../lib/supabase'
import { ExportPngButton } from './PngExport'
import ResultsSheet from './ResultsSheet'
import { buildResultsView } from '../../lib/resultsView'

const slug = event => (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()

/** "Tournament results" PNG. Same props and file name as before. */
export default function ExportResultsButton({ event, eventPlayers, allScores, course, sideGames, orgName, orgLogoUrl }) {
  async function prepare() {
    if (!course) throw new Error('No course loaded.')
    const formats = event.formats ?? []
    let matchPairings = []
    if (formats.includes('match_points') || formats.includes('ryder_cup')) {
      const { data } = await supabase.from('match_pairings').select('*').eq('event_id', event.id).order('match_number')
      matchPairings = data ?? []
    }
    return buildResultsView({ event, eventPlayers, allScores, course, sideGames: sideGames ?? [], matchPairings })
  }
  return (
    <ExportPngButton filename={`results_${slug(event)}.png`} logoUrl={orgLogoUrl} prepare={prepare}>
      {(logo, view) => <ResultsSheet view={view} leagueName={orgName} logoUrl={logo} />}
    </ExportPngButton>
  )
}
