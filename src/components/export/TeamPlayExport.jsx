import { ExportPngButton } from './PngExport'
import TeamPlaySheet from './TeamPlaySheet'
import { teamPlayExportView } from '../../lib/teamPlayExport'

const slug = event => (event.name ?? `event_${event.event_number}`).replace(/[^a-z0-9]/gi, '_').toLowerCase()

/** "Team play standings" PNG. Same props and file name as before. */
export default function ExportTeamPlayButton({ event, eventPlayers, allScores, course, tglTeams, tglMembers, tglSelections, orgName, orgLogoUrl }) {
  function prepare() {
    if (!tglTeams?.length) throw new Error('No teams configured.')
    return teamPlayExportView({ event, eventPlayers, allScores, course, tglTeams, tglMembers, tglSelections })
  }
  return (
    <ExportPngButton filename={`team_play_${slug(event)}.png`} logoUrl={orgLogoUrl} prepare={prepare}>
      {(logo, view) => <TeamPlaySheet view={view} leagueName={orgName ?? event.league?.name ?? ''} logoUrl={logo} />}
    </ExportPngButton>
  )
}
