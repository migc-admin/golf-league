import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input, { Select } from '../../components/ui/Input'
import ImageUpload from '../../components/ui/ImageUpload'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import { atLimit, getLimit, nextTier, TIER_LABELS } from '../../lib/features'

const CURRENT_YEAR = new Date().getFullYear()

export default function Leagues() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leagues,       setLeagues]       = useState([])
  const [orgSlug,       setOrgSlug]       = useState(null)
  const [orgId,         setOrgId]         = useState(null)
  const [orgTier,       setOrgTier]       = useState('free')
  const [loading,       setLoading]       = useState(true)
  const [leagueModal,   setLeagueModal]   = useState(false)
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const dragItem    = useRef(null)
  const dragOver    = useRef(null)

  async function load() {
    const { data } = await supabase
      .from('leagues')
      .select('id, name, slug, season_year, logo_url, display_order, events(id)')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('season_year', { ascending: false })
    setLeagues(data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    async function fetchOrg() {
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('org_id').eq('id', user.id).single()
      if (profile?.org_id) {
        const { data: org } = await supabase
          .from('organizations').select('id, slug, tier').eq('id', profile.org_id).single()
        if (org?.slug) setOrgSlug(org.slug)
        if (org?.id)   setOrgId(org.id)
        if (org?.tier) setOrgTier(org.tier)
      }
    }
    fetchOrg()
  }, [user])

  function handleDragStart(i) {
    dragItem.current = i
  }

  function handleDragEnter(i) {
    dragOver.current = i
    if (dragItem.current === i) return
    const reordered = [...leagues]
    const [moved] = reordered.splice(dragItem.current, 1)
    reordered.splice(i, 0, moved)
    dragItem.current = i
    setLeagues(reordered)
  }

  async function handleDragEnd() {
    dragItem.current = null
    dragOver.current = null
    // Persist new order
    const updates = leagues.map((lg, i) =>
      supabase.from('leagues').update({ display_order: i }).eq('id', lg.id)
    )
    await Promise.all(updates)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.03em' }}>Leagues</h1>
          <p className="text-sm text-ink-muted mt-0.5">Manage your leagues and events</p>
        </div>
        <div className="flex items-center gap-3">
          {atLimit(orgTier, 'leagues', leagues.length) && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#fef9c3', color: '#854d0e' }}>
              {leagues.length} / {getLimit(orgTier, 'leagues')} leagues — {TIER_LABELS[nextTier(orgTier)]} plan required for additional leagues
            </span>
          )}
          <Button onClick={() => {
            if (atLimit(orgTier, 'leagues', leagues.length)) setUpgradePrompt(true)
            else setLeagueModal(true)
          }}>+ New League</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0,1,2].map(i => <div key={i} className="h-16 rounded-xl" style={{ background: '#eceae5' }} />)}
        </div>
      ) : leagues.length === 0 ? (
        <Card className="text-center py-16">
          <div className="text-4xl mb-3">🏌️</div>
          <p className="text-ink-muted font-medium">No leagues yet</p>
          <Button className="mt-4" onClick={() => setLeagueModal(true)}>Create First League</Button>
        </Card>
      ) : (
        <div className="card overflow-hidden p-0">
          {leagues.map((league, i) => (
            <div
              key={league.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              className="flex items-center gap-3 transition-colors"
              style={{ borderBottom: i < leagues.length - 1 ? '1px solid #ebe9e4' : 'none' }}
            >
              {/* Drag handle */}
              <div
                className="pl-3 py-4 cursor-grab active:cursor-grabbing text-ink-muted flex-shrink-0"
                style={{ touchAction: 'none' }}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="3" y="3" width="10" height="1.5" rx="0.75"/>
                  <rect x="3" y="7.25" width="10" height="1.5" rx="0.75"/>
                  <rect x="3" y="11.5" width="10" height="1.5" rx="0.75"/>
                </svg>
              </div>

              {/* Row content — clickable */}
              <button
                onClick={() => navigate(`/admin/leagues/${league.slug}`)}
                className="flex-1 flex items-center gap-4 pr-4 py-4 text-left"
                onMouseEnter={e => e.currentTarget.parentElement.style.background = '#f4f3f0'}
                onMouseLeave={e => e.currentTarget.parentElement.style.background = ''}
              >
                {league.logo_url ? (
                  <img src={league.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" style={{ border: '1px solid #ebe9e4' }} />
                ) : (
                  <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-ink-muted text-xs font-bold" style={{ background: '#eceae5' }}>
                    {league.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink text-sm" style={{ letterSpacing: '-0.01em' }}>{league.name}</div>
                  <div className="text-xs text-ink-muted mt-0.5">Season {league.season_year} · {league.events?.length ?? 0} event{(league.events?.length ?? 0) !== 1 ? 's' : ''}</div>
                </div>
                <span className="text-ink-muted text-sm">→</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <LeagueModal
        open={leagueModal}
        onClose={() => setLeagueModal(false)}
        orgId={orgId}
        orgSlug={orgSlug}
        onSaved={() => { setLeagueModal(false); load() }}
      />

      <UpgradePrompt
        open={upgradePrompt}
        onClose={() => setUpgradePrompt(false)}
        reason={`You've reached the ${getLimit(orgTier, 'leagues')}-league limit on the ${TIER_LABELS[orgTier]} plan.`}
        requiredTier={nextTier(orgTier)}
      />
    </div>
  )
}

function LeagueModal({ open, onClose, orgId, orgSlug, onSaved }) {
  const [name,    setName]    = useState('')
  const [year,    setYear]    = useState(CURRENT_YEAR)
  const [logoUrl, setLogoUrl] = useState('')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => {
    if (!open) { setName(''); setYear(CURRENT_YEAR); setLogoUrl('') }
  }, [open])

  async function handleSave(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    let resolvedOrgId = orgId
    if (!resolvedOrgId) {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('org_id').eq('id', user.id).single()
        resolvedOrgId = profile?.org_id ?? null
      }
    }
    const { error } = await supabase.from('leagues').insert({
      name: name.trim(), season_year: +year, org_id: resolvedOrgId, logo_url: logoUrl || null
    })
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('League created'); onSaved() }
  }

  const years = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - 1 + i)
  return (
    <Modal open={open} onClose={onClose} title="New League">
      <form onSubmit={handleSave} className="space-y-4">
        <ImageUpload
          shape="rect"
          path={`orgs/${orgSlug}/leagues/${Date.now()}`}
          currentUrl={logoUrl || null}
          onUploaded={url => setLogoUrl(url)}
          label="League Logo (optional)"
        />
        <Input label="League Name" value={name} onChange={e => setName(e.target.value)} placeholder="Tuesday Evening League" required />
        <Select label="Season Year" value={year} onChange={e => setYear(e.target.value)}>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </Select>
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create League</Button>
        </div>
      </form>
    </Modal>
  )
}
