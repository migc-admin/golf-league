import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import LeagueLayout from '../../components/LeagueLayout'

const GREEN = '#1B4332'

export default function OrgHome({ orgSlug }) {
  const [org, setOrg]       = useState(null)
  const [leagues, setLeagues] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!orgSlug) return
    async function load() {
      setLoading(true)

      // Fetch org
      const { data: orgData, error: orgErr } = await supabase
        .from('organizations')
        .select('id, name, slug, logo_url, tier')
        .eq('slug', orgSlug)
        .single()

      if (orgErr || !orgData) {
        setError('League not found.')
        setLoading(false)
        return
      }

      setOrg(orgData)

      // Fetch leagues for this org
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('id, name, slug, season_year')
        .eq('org_id', orgData.id)
        .order('season_year', { ascending: false })

      setLeagues(leagueData || [])
      setLoading(false)
    }
    load()
  }, [orgSlug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading…</p>
      </div>
    )
  }

  if (error || !org) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">{error || 'League not found.'}</p>
      </div>
    )
  }

  if (org.tier !== 'club') {
    return (
      <LeagueLayout org={org} leagues={leagues}>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-gray-700 mb-3">Upgrade Required</h2>
          <p className="text-gray-500 max-w-md mx-auto">
            This league's public site requires a Club plan. Contact the league administrator to upgrade.
          </p>
        </div>
      </LeagueLayout>
    )
  }

  return (
    <LeagueLayout org={org} leagues={leagues}>
      {/* Hero */}
      <div className="mb-10 text-center">
        <img
          src={org.logo_url || '/logo.png'}
          alt={org.name}
          className="mx-auto h-20 w-20 rounded-full object-cover shadow mb-4"
          onError={(e) => { e.target.src = '/logo.png' }}
        />
        <h1 className="text-4xl font-extrabold" style={{ color: GREEN }}>
          {org.name}
        </h1>
        <p className="text-gray-500 mt-2">Select a league below to view schedules and results.</p>
      </div>

      {/* League grid */}
      {leagues.length === 0 ? (
        <p className="text-center text-gray-400">No leagues available yet.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((lg) => (
            <Link
              key={lg.id}
              to={`/${lg.slug}`}
              className="block bg-white border border-gray-200 rounded-xl shadow hover:shadow-md transition-shadow p-6 group"
            >
              <h2
                className="text-lg font-bold group-hover:underline"
                style={{ color: GREEN }}
              >
                {lg.name}
              </h2>
              {lg.season_year && (
                <p className="text-sm text-gray-500 mt-1">Season {lg.season_year}</p>
              )}
              <p className="mt-4 text-sm font-semibold" style={{ color: GREEN }}>
                View League →
              </p>
            </Link>
          ))}
        </div>
      )}
    </LeagueLayout>
  )
}
