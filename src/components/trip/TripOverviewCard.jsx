/**
 * TripOverviewCard — the trip's write-up, on the trip admin page.
 *
 *   Trip overview                                                        [Edit]
 *   Celebrating Mike's 50th in Palm Springs: three rounds, pool house, ...
 *
 * Same editor (Bold / Italic) and the same rendering as a golf event's tournament description.
 * Saved to trips.description and shown on the public trip page as "About this trip".
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { supabase } from '../../lib/supabase'
import SectionCard from '../ui/SectionCard'
import Button, { ActionButton } from '../ui/Button'
import DescriptionEditor from '../ui/DescriptionEditor'
import { aboutHtml } from '../event-page/AboutCard'

export default function TripOverviewCard({ trip, onSaved }) {
  const [editing, setEditing] = useState(false)
  const [text,    setText]    = useState(trip.description ?? '')
  const [saving,  setSaving]  = useState(false)

  useEffect(() => { if (!editing) setText(trip.description ?? '') }, [trip.description, editing])

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('trips').update({ description: text.trim() || null }).eq('id', trip.id)
    setSaving(false)
    if (error) { toast.error(error.message); return }
    toast.success('Overview saved')
    setEditing(false)
    onSaved()
  }

  const has = !!trip.description?.trim()
  return (
    <SectionCard
      title="Trip overview"
      subtitle="Shown at the top of the public trip page as About this trip"
      headerAction={!editing && <ActionButton variant="ghost" onClick={() => setEditing(true)}>{has ? 'Edit' : '+ Add'}</ActionButton>}
    >
      {editing ? (
        <div className="space-y-3">
          <DescriptionEditor value={text} onChange={setText} rows={6}
            placeholder="What the trip is, who it's for, what's included, what to bring…" />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
            <Button type="button" loading={saving} onClick={save}>Save overview</Button>
          </div>
        </div>
      ) : has ? (
        <div className="max-w-[68ch] break-words text-sm leading-relaxed text-ink" dangerouslySetInnerHTML={{ __html: aboutHtml(trip.description) }} />
      ) : (
        <p className="text-sm text-ink-muted">Add an overview so people know what the trip is about before they sign up.</p>
      )}
    </SectionCard>
  )
}
