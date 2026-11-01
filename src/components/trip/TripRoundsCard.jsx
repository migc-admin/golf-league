/**
 * TripRoundsCard — the trip's rounds (events of the hidden trip league).
 *
 *   Rounds                         [Standings] [Team play] [+ Add round]
 *   ⠿  Fri Sep 11   Sand Hollow · Sand Hollow Resort Championship   Upcoming   [Manage]
 *
 * Same handlers the old page had (they lived in LeagueDetailView): drag a row to reorder
 * (saves display_order), "+ Add round" goes to the new-event page, "Manage" opens the round's
 * event admin, "Team play" opens the team play modal.
 */
import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { hasFeature } from '../../lib/features'
import SectionCard from '../ui/SectionCard'
import Button, { ActionButton } from '../ui/Button'
import { StatusBadge } from '../ui/Badge'
import { TGLTeamsModal } from '../../pages/admin/LeagueDetail'

function dayLabel(d) {
  return new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function HandleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <rect x="3" y="3" width="10" height="1.5" rx="0.75" />
      <rect x="3" y="7.25" width="10" height="1.5" rx="0.75" />
      <rect x="3" y="11.5" width="10" height="1.5" rx="0.75" />
    </svg>
  )
}

export default function TripRoundsCard({ league, rounds, setRounds, orgSlug, orgTier }) {
  const [tglOpen, setTglOpen] = useState(false)
  const dragItem = useRef(null)

  function handleDragEnter(i) {
    if (dragItem.current == null || dragItem.current === i) return
    const reordered = [...rounds]
    const [moved] = reordered.splice(dragItem.current, 1)
    reordered.splice(i, 0, moved)
    dragItem.current = i
    setRounds(reordered)
  }

  async function handleDragEnd() {
    dragItem.current = null
    await Promise.all(rounds.map((ev, i) => supabase.from('events').update({ display_order: i }).eq('id', ev.id)))
  }

  const teamPlayLabel = league.team_play_label || 'Team play'
  return (
    <SectionCard
      title="Rounds"
      subtitle={`${rounds.length} round${rounds.length === 1 ? '' : 's'}`}
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          <Button as={Link} variant="ghost" to={`/${orgSlug}/${league.slug}/standings`}>Standings</Button>
          {hasFeature(orgTier, 'tgl')
            ? <ActionButton variant="ghost" onClick={() => setTglOpen(true)}>{teamPlayLabel}</ActionButton>
            : <span className="rounded-full bg-surface-high px-3 py-1 text-xs text-ink-muted">Team play — Club</span>}
          <Button as={Link} to={`/admin/leagues/${league.slug}/new-event`}>+ Add round</Button>
        </div>
      }
    >
      {rounds.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No rounds yet. <Link to={`/admin/leagues/${league.slug}/new-event`} className="font-semibold text-fairway-700 hover:underline">Add the first round</Link>
        </p>
      ) : (
        <ul className="-mx-1 border-t border-surface-border">
          {rounds.map((ev, i) => (
            <li
              key={ev.id}
              draggable
              onDragStart={() => { dragItem.current = i }}
              onDragEnter={() => handleDragEnter(i)}
              onDragEnd={handleDragEnd}
              onDragOver={e => e.preventDefault()}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-surface-border px-1 py-2 last:border-b-0"
            >
              <span className="hidden shrink-0 cursor-grab text-ink-muted active:cursor-grabbing sm:inline-flex" aria-hidden="true"><HandleIcon /></span>
              <span className="w-[92px] shrink-0 text-sm font-semibold text-ink">{dayLabel(ev.event_date)}</span>
              <span className="min-w-[140px] flex-1">
                <span className="block text-sm font-bold text-ink">{ev.name ? ev.name : `Event #${ev.event_number}`}</span>
                {ev.course?.name && <span className="block text-xs text-ink-muted">{ev.course.name}</span>}
              </span>
              <StatusBadge status={ev.status} />
              <ActionButton as={Link} to={`/admin/${orgSlug}/${league.slug}/${ev.slug}`} aria-label={`Manage ${ev.name ?? `Event #${ev.event_number}`}`}>Manage</ActionButton>
            </li>
          ))}
        </ul>
      )}

      {tglOpen && <TGLTeamsModal open={tglOpen} onClose={() => setTglOpen(false)} league={league} />}
    </SectionCard>
  )
}
