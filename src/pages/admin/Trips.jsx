import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import toast from 'react-hot-toast'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Modal from '../../components/ui/Modal'
import Input from '../../components/ui/Input'
import ImageUpload from '../../components/ui/ImageUpload'
import UpgradePrompt from '../../components/ui/UpgradePrompt'
import { atLimit, getLimit, nextTier, TIER_LABELS } from '../../lib/features'

export default function Trips() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [trips,         setTrips]         = useState([])
  const [orgSlug,       setOrgSlug]       = useState(null)
  const [orgId,         setOrgId]         = useState(null)
  const [orgTier,       setOrgTier]       = useState('free')
  const [loading,       setLoading]       = useState(true)
  const [tripModal,     setTripModal]     = useState(false)
  const [upgradePrompt, setUpgradePrompt] = useState(false)
  const dragItem = useRef(null)
  const dragOver = useRef(null)

  async function load() {
    const { data } = await supabase
      .from('trips')
      .select('id, name, slug, description, start_date, end_date, location, logo_url, display_order')
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('start_date', { ascending: false })
    setTrips(data ?? [])
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
    const reordered = [...trips]
    const [moved] = reordered.splice(dragItem.current, 1)
    reordered.splice(i, 0, moved)
    dragItem.current = i
    setTrips(reordered)
  }

  async function handleDragEnd() {
    dragItem.current = null
    dragOver.current = null
    const updates = trips.map((trip, i) =>
      supabase.from('trips').update({ display_order: i }).eq('id', trip.id)
    )
    await Promise.all(updates)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink" style={{ letterSpacing: '-0.03em' }}>Trips</h1>
          <p className="text-sm text-ink-muted mt-0.5">Manage multi-day golf trips and rounds</p>
        </div>
        <div className="flex items-center gap-3">
          {atLimit(orgTier, 'trips', trips.length) && (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: '#fef9c3', color: '#854d0e' }}>
              {trips.length} / {getLimit(orgTier, 'trips')} trips — {TIER_LABELS[nextTier(orgTier)]} plan required for additional trips
            </span>
          )}
          <Button onClick={() => {
            if (atLimit(orgTier, 'trips', trips.length)) setUpgradePrompt(true)
            else setTripModal(true)
          }}>+ New Trip</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[0,1,2].map(i => <div key={i} className="h-16 rounded-xl" style={{ background: '#eceae5' }} />)}
        </div>
      ) : trips.length === 0 ? (
        <Card className="text-center py-16">
          <p className="text-ink-muted font-medium">No trips yet</p>
          <Button className="mt-4" onClick={() => {
            if (atLimit(orgTier, 'trips', trips.length)) setUpgradePrompt(true)
            else setTripModal(true)
          }}>Create First Trip</Button>
        </Card>
      ) : (
        <div className="card overflow-hidden p-0">
          {trips.map((trip, i) => (
            <div
              key={trip.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              className="flex items-center gap-3 transition-colors"
              style={{ borderBottom: i < trips.length - 1 ? '1px solid #ebe9e4' : 'none' }}
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
                onClick={() => navigate(`/admin/trips/${trip.slug}`)}
                className="flex-1 flex items-center gap-4 py-4 text-left"
                onMouseEnter={e => e.currentTarget.parentElement.style.background = '#f4f3f0'}
                onMouseLeave={e => e.currentTarget.parentElement.style.background = ''}
              >
                {trip.logo_url ? (
                  <img src={trip.logo_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" style={{ border: '1px solid #ebe9e4' }} />
                ) : (
                  <div className="w-10 h-10 rounded-lg shrink-0 flex items-center justify-center text-ink-muted text-xs font-bold" style={{ background: '#eceae5' }}>
                    {trip.name.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink text-sm" style={{ letterSpacing: '-0.01em' }}>{trip.name}</div>
                  <div className="text-xs text-ink-muted mt-0.5">
                    {formatDateRange(trip.start_date, trip.end_date)}{trip.location ? ` · ${trip.location}` : ''}
                  </div>
                </div>
                <span className="text-ink-muted text-sm">→</span>
              </button>
            </div>
          ))}
        </div>
      )}

      <TripModal
        open={tripModal}
        onClose={() => setTripModal(false)}
        orgId={orgId}
        orgSlug={orgSlug}
        onSaved={() => { setTripModal(false); load() }}
      />

      <UpgradePrompt
        open={upgradePrompt}
        onClose={() => setUpgradePrompt(false)}
        reason={`You've reached the ${getLimit(orgTier, 'trips')}-trip limit on the ${TIER_LABELS[orgTier]} plan.`}
        requiredTier={nextTier(orgTier)}
      />
    </div>
  )
}

function TripModal({ open, onClose, orgId, orgSlug, onSaved }) {
  const [name,        setName]        = useState('')
  const [description, setDescription] = useState('')
  const [startDate,   setStartDate]   = useState('')
  const [endDate,      setEndDate]     = useState('')
  const [location,    setLocation]    = useState('')
  const [logoUrl,     setLogoUrl]     = useState('')
  const [saving,      setSaving]      = useState(false)

  useEffect(() => {
    if (!open) {
      setName(''); setDescription(''); setStartDate(''); setEndDate(''); setLocation(''); setLogoUrl('')
    }
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
    const { error } = await supabase.rpc('create_trip', {
      p_org_id: resolvedOrgId,
      p_name: name.trim(),
      p_description: description.trim() || null,
      p_start_date: startDate || null,
      p_end_date: endDate || null,
      p_location: location.trim() || null,
      p_logo_url: logoUrl || null,
    })
    setSaving(false)
    if (error) toast.error(error.message)
    else { toast.success('Trip created'); onSaved() }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Trip">
      <form onSubmit={handleSave} className="space-y-4">
        <ImageUpload
          shape="rect"
          path={`orgs/${orgSlug}/trips/${Date.now()}`}
          currentUrl={logoUrl || null}
          onUploaded={url => setLogoUrl(url)}
          label="Trip Logo (optional)"
        />
        <Input label="Trip Name" value={name} onChange={e => setName(e.target.value)} placeholder="Myrtle Beach 2026" required />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <Input label="Location (optional)" value={location} onChange={e => setLocation(e.target.value)} placeholder="Myrtle Beach, SC" />
        <Input label="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} placeholder="Annual buddies trip" />
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Create Trip</Button>
        </div>
      </form>
    </Modal>
  )
}

function formatDateRange(start, end) {
  if (!start && !end) return 'Dates TBD'
  const fmt = d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  if (start && end && start !== end) return `${fmt(start)} – ${fmt(end)}`
  return fmt(start || end)
}
