import { useEffect, useState } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter, useDroppable,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import Button, { ActionButton } from './ui/Button'
import SectionCard from './ui/SectionCard'
import Modal from './ui/Modal'
import Input from './ui/Input'

export function travelerName(t) {
  if (t.player) return `${t.player.first_name} ${t.player.last_name}`.trim()
  return t.guest_name || 'Unnamed'
}

// Rooms are identified by number; a name is optional decoration.
export function roomLabel(labels, n) {
  return (labels?.[String(n)] ?? '').trim() || `Room ${n}`
}

function byName(a, b) {
  return travelerName(a).localeCompare(travelerName(b))
}

/**
 * TripTravelersRooms — the "Travelers & rooms" card (the old Travelers and Rooms cards in one).
 * Every traveler appears once: inside a room, or in "Not in a room" at the top.
 *
 * The parent page owns the data (`travelers`, `roster`) and passes `onReload`, which re-reads
 * trip_travelers after any change. Nothing about how rooms are stored has changed.
 */
export default function TripTravelersRooms({ trip, travelers, roster, onReload }) {
  const [addOpen, setAddOpen] = useState(false)
  const [confirm, setConfirm] = useState(null) // { kind: 'clear' } | { kind: 'remove', traveler }
  const [busy,    setBusy]    = useState(false)
  const [extraRooms, setExtraRooms] = useState(0)

  async function removeFromTrip(t) {
    setBusy(true)
    const { error } = await supabase.from('trip_travelers').delete().eq('id', t.id)
    setBusy(false)
    setConfirm(null)
    if (error) return toast.error(error.message)
    onReload()
  }

  async function clearRooms() {
    setBusy(true)
    const { error } = await supabase
      .from('trip_travelers')
      .update({ room_number: null, room_order: null })
      .in('id', travelers.map(t => t.id))
    setBusy(false)
    setConfirm(null)
    if (error) return toast.error(error.message)
    setExtraRooms(0)
    onReload()
  }

  const anyAssigned = travelers.some(t => t.room_number)
  const count = `${travelers.length} traveler${travelers.length === 1 ? '' : 's'}`

  return (
    <SectionCard
      title="Travelers & rooms"
      subtitle={`${count} · drag between rooms, or use each person's menu on a phone`}
      headerAction={
        <div className="flex flex-wrap items-center gap-2">
          {anyAssigned && <ActionButton variant="ghost" onClick={() => setConfirm({ kind: 'clear' })}>Clear rooms</ActionButton>}
          {travelers.length > 0 && <ActionButton onClick={() => setExtraRooms(n => n + 1)}>+ Add room</ActionButton>}
          <ActionButton onClick={() => setAddOpen(true)}>+ Add travelers</ActionButton>
        </div>
      }
    >
      {travelers.length === 0 ? (
        <p className="text-sm text-ink-muted">
          Add the people coming on this trip. Travelers are separate from round rosters —
          adding someone here won't change any golf round.
        </p>
      ) : (
        <RoomBoard
          trip={trip}
          travelers={travelers}
          extraRooms={extraRooms}
          onUpdated={onReload}
          onRemove={t => setConfirm({ kind: 'remove', traveler: t })}
        />
      )}

      <AddTravelersModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        trip={trip}
        roster={roster}
        travelers={travelers}
        onSaved={() => { setAddOpen(false); onReload() }}
      />

      <Modal open={confirm?.kind === 'clear'} onClose={() => setConfirm(null)} title="Clear all rooms?">
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">Everyone moves to "Not in a room". Travelers stay on the trip.</p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button type="button" loading={busy} onClick={clearRooms}>Clear rooms</Button>
          </div>
        </div>
      </Modal>

      <Modal open={confirm?.kind === 'remove'} onClose={() => setConfirm(null)} title="Remove from trip?">
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">
            Remove <span className="font-semibold text-ink">{confirm?.traveler ? travelerName(confirm.traveler) : ''}</span> from this trip?
            Round rosters are not affected.
          </p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button type="button" variant="danger" loading={busy} onClick={() => removeFromTrip(confirm.traveler)}>Remove traveler</Button>
          </div>
        </div>
      </Modal>
    </SectionCard>
  )
}

// ─── Rooming board ────────────────────────────────────────────────
// Mirrors the event Groups drag-and-drop: containers keyed 'unassigned'
// and 'room-N', persisted to trip_travelers.room_number / room_order.
function RoomBoard({ trip, travelers, extraRooms, onUpdated, onRemove }) {
  const [containers, setContainers] = useState({})
  const [activeId,   setActiveId]   = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [labels,     setLabels]     = useState(
    trip.room_labels && typeof trip.room_labels === 'object' ? trip.room_labels : {}
  )

  async function saveLabel(n, value) {
    const name = value.trim()
    const next = { ...labels }
    if (name) next[String(n)] = name
    else delete next[String(n)]
    if (JSON.stringify(next) === JSON.stringify(labels)) return
    setLabels(next)
    const { error } = await supabase.from('trips').update({ room_labels: next }).eq('id', trip.id)
    if (error) toast.error(error.message)
  }

  useEffect(() => {
    const unassigned = []
    const byRoom = {}
    for (const t of travelers) {
      if (t.room_number) {
        if (!byRoom[t.room_number]) byRoom[t.room_number] = []
        byRoom[t.room_number].push(t)
      } else {
        unassigned.push(t)
      }
    }
    Object.values(byRoom).forEach(arr => arr.sort((a, b) => (a.room_order ?? 0) - (b.room_order ?? 0)))

    const existingMax = Object.keys(byRoom).length > 0 ? Math.max(...Object.keys(byRoom).map(Number)) : 0
    // Default to doubles; never shrink below rooms that already have people in them.
    const slots = Math.max(Math.ceil(travelers.length / 2), existingMax) + extraRooms
    const next = { unassigned: unassigned.sort(byName) }
    for (let i = 0; i < slots; i++) next[`room-${i}`] = byRoom[i + 1] ?? []
    setContainers(next)
  }, [travelers, extraRooms])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  function findContainer(id) {
    if (id in containers) return id
    for (const [key, members] of Object.entries(containers)) {
      if (members.some(t => t.id === id)) return key
    }
    return null
  }

  function handleDragOver({ active, over }) {
    if (!over) return
    const fromKey = findContainer(active.id)
    let toKey = findContainer(over.id)
    if (!toKey) toKey = over.id
    if (!fromKey || !toKey || fromKey === toKey) return

    setContainers(prev => {
      const next = {}
      for (const k of Object.keys(prev)) next[k] = [...prev[k]]
      const moved = next[fromKey].find(t => t.id === active.id)
      if (!moved) return prev
      next[fromKey] = next[fromKey].filter(t => t.id !== active.id)
      const overIdx = next[toKey]?.findIndex(t => t.id === over.id) ?? -1
      if (overIdx >= 0) next[toKey].splice(overIdx, 0, moved)
      else next[toKey] = [...(next[toKey] ?? []), moved]
      return next
    })
  }

  function handleDragEnd({ active, over }) {
    setActiveId(null)
    if (!over) return
    const fromKey = findContainer(active.id)
    let toKey = findContainer(over.id)
    if (!toKey) toKey = over.id

    if (fromKey === toKey) {
      setContainers(prev => {
        const members = [...(prev[fromKey] ?? [])]
        const from = members.findIndex(t => t.id === active.id)
        const to   = members.findIndex(t => t.id === over.id)
        if (from === -1 || to === -1 || from === to) return prev
        const next = { ...prev, [fromKey]: arrayMove(members, from, to) }
        persist(next)
        return next
      })
    } else {
      persist(containers)
    }
  }

  // The phone's "Room" menu and the ✕ button use this; drag-and-drop on a desktop ends in persist().
  function moveToContainer(t, fromKey, toKey) {
    if (!toKey || fromKey === toKey) return
    setContainers(prev => {
      const next = {}
      for (const k of Object.keys(prev)) next[k] = [...prev[k]]
      next[fromKey] = next[fromKey].filter(m => m.id !== t.id)
      next[toKey] = [...(next[toKey] ?? []), t]
      persist(next)
      return next
    })
  }

  async function persist(snap) {
    const source = snap ?? containers
    setSaving(true)
    try {
      const updates = []
      for (const [key, members] of Object.entries(source)) {
        const roomNum = key === 'unassigned' ? null : parseInt(key.replace('room-', ''), 10) + 1
        members.forEach((t, order) => {
          updates.push(
            supabase.from('trip_travelers')
              .update({ room_number: roomNum, room_order: roomNum ? order : null })
              .eq('id', t.id)
          )
        })
      }
      await Promise.all(updates)
      onUpdated()
    } catch (err) {
      toast.error('Save failed: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const unassigned = containers['unassigned'] ?? []
  const roomKeys = Object.keys(containers)
    .filter(k => k !== 'unassigned')
    .sort((a, b) => parseInt(a.replace('room-', ''), 10) - parseInt(b.replace('room-', ''), 10))
  const moveOptions = [
    { key: 'unassigned', label: 'Not in a room' },
    ...roomKeys.map(key => ({ key, label: roomLabel(labels, parseInt(key.replace('room-', ''), 10) + 1) })),
  ]
  const activeTraveler = activeId ? travelers.find(t => t.id === activeId) : null

  return (
    <div>
      {saving && <p className="mb-2 text-xs text-ink-muted" role="status">Saving…</p>}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 230px), 1fr))' }}>
          {unassigned.length > 0 && (
            <DroppableRoom
              id="unassigned"
              title="Not in a room"
              subtitle={`${unassigned.length} traveler${unassigned.length === 1 ? '' : 's'}`}
              warn
              members={unassigned}
              moveOptions={moveOptions}
              onMoveToRoom={moveToContainer}
              onRemoveFromTrip={onRemove}
            />
          )}
          {roomKeys.map(key => {
            const n = parseInt(key.replace('room-', ''), 10) + 1
            const members = containers[key] ?? []
            return (
              <DroppableRoom
                key={key}
                id={key}
                roomNum={n}
                nameValue={labels[String(n)] ?? ''}
                onRename={value => saveLabel(n, value)}
                subtitle={`${members.length} traveler${members.length !== 1 ? 's' : ''}`}
                members={members}
                moveOptions={moveOptions}
                onMoveToRoom={moveToContainer}
              />
            )
          })}
        </div>

        <DragOverlay>{activeTraveler ? <DragCard traveler={activeTraveler} /> : null}</DragOverlay>
      </DndContext>
    </div>
  )
}

function DroppableRoom({ id, title, roomNum, nameValue, onRename, subtitle, warn = false, members, moveOptions, onMoveToRoom, onRemoveFromTrip }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <section
      ref={setNodeRef}
      className={`overflow-hidden rounded-sm border transition-colors ${isOver ? 'border-fairway-700 bg-fairway-50' : 'border-surface-border bg-surface-container'}`}
    >
      <header className={`border-b border-surface-border px-4 py-2 ${warn ? 'bg-status-upcoming-bg' : ''}`}>
        {onRename ? (
          <RoomNameInput roomNum={roomNum} value={nameValue} onRename={onRename} />
        ) : (
          <h3 className={`flex h-11 items-center text-sm font-bold ${warn ? 'text-status-upcoming-text' : 'text-ink'}`}>{title}</h3>
        )}
        <p className={`-mt-1 text-xs ${warn ? 'text-status-upcoming-text' : 'text-ink-muted'}`}>{subtitle}</p>
      </header>
      <SortableContext items={members.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="bg-white">
          {members.map(t => (
            <TravelerRow
              key={t.id}
              traveler={t}
              currentKey={id}
              moveOptions={moveOptions}
              onMoveToRoom={onMoveToRoom}
              onRemoveFromTrip={onRemoveFromTrip}
            />
          ))}
        </ul>
      </SortableContext>
      {members.length === 0 && (
        <div className="m-2 flex min-h-[44px] items-center justify-center rounded-sm border border-dashed border-surface-highest px-3 text-xs text-ink-muted">
          Drop travelers here
        </div>
      )}
    </section>
  )
}

// Inline-editable room name. Saves on blur / Enter; Escape reverts.
function RoomNameInput({ roomNum, value, onRename }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => { setDraft(value) }, [value])

  return (
    <input
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onRename(draft)}
      onKeyDown={e => {
        if (e.key === 'Enter') { e.preventDefault(); e.target.blur() }
        if (e.key === 'Escape') { setDraft(value); e.target.blur() }
      }}
      placeholder={`Room ${roomNum}`}
      aria-label={`Name for room ${roomNum}`}
      className="block h-11 w-full border-0 border-b border-transparent bg-transparent px-0 text-sm font-bold text-ink placeholder:text-ink-muted hover:border-surface-highest focus:border-fairway-700 focus:outline-none"
    />
  )
}

function HandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      {[6, 12, 18].flatMap(y => [9, 15].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function TravelerRow({ traveler, currentKey, moveOptions, onMoveToRoom, onRemoveFromTrip }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: traveler.id })
  const name = travelerName(traveler)
  const inRoom = currentKey !== 'unassigned'
  // In a room, ✕ moves the person back to "Not in a room". There, ✕ removes them from the trip.
  const onClose = inRoom ? () => onMoveToRoom(traveler, currentKey, 'unassigned') : () => onRemoveFromTrip(traveler)
  const closeLabel = inRoom ? `Remove ${name} from this room` : `Remove ${name} from the trip`

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="flex min-h-[44px] flex-col justify-center gap-1.5 border-t border-surface-border bg-white px-3 py-2 first:border-t-0 md:flex-row md:items-center md:gap-2"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          {...attributes}
          {...listeners}
          aria-label={`Drag ${name}`}
          className="hidden cursor-grab select-none text-surface-outline hover:text-ink-muted md:inline-flex"
        >
          <HandleIcon />
        </span>
        <span className="truncate text-sm font-medium text-ink">{name}</span>
        {!traveler.player && (
          <span className="inline-flex h-5 shrink-0 items-center rounded-sm bg-surface-high px-1.5 text-[10px] font-bold uppercase tracking-wide text-ink-muted">Guest</span>
        )}
      </div>
      <div className="flex items-center gap-2 md:shrink-0">
        <label className="flex flex-1 items-center gap-2 text-xs text-ink-muted md:hidden">
          <span>Room</span>
          <select
            className="input h-11 min-w-0 flex-1 bg-white py-0 text-sm"
            value={currentKey}
            onChange={e => onMoveToRoom(traveler, currentKey, e.target.value)}
          >
            {moveOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          aria-label={closeLabel}
          title={closeLabel}
          onClick={onClose}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-dim hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
        >
          <CloseIcon />
        </button>
      </div>
    </li>
  )
}

function DragCard({ traveler }) {
  return (
    <div className="inline-flex items-center gap-2 whitespace-nowrap rounded-sm border-2 border-fairway-700 bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-float">
      <span className="text-ink-muted"><HandleIcon /></span>
      {travelerName(traveler)}
    </div>
  )
}

// ─── Add travelers modal ──────────────────────────────────────────
function AddTravelersModal({ open, onClose, trip, roster, travelers, onSaved }) {
  const [selected,  setSelected]  = useState([])
  const [guestName, setGuestName] = useState('')
  const [search,    setSearch]    = useState('')
  const [saving,    setSaving]    = useState(false)

  useEffect(() => {
    if (open) { setSelected([]); setGuestName(''); setSearch('') }
  }, [open])

  const existingPlayerIds = new Set(travelers.map(t => t.player_id).filter(Boolean))
  const available = roster
    .filter(p => !existingPlayerIds.has(p.id))
    .filter(p => {
      const q = search.trim().toLowerCase()
      if (!q) return true
      return `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
    })

  function toggle(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleSave(e) {
    e.preventDefault()
    const guest = guestName.trim()
    if (selected.length === 0 && !guest) {
      return toast.error('Select a player or enter a guest name.')
    }
    setSaving(true)
    const rows = [
      ...selected.map(id => ({ trip_id: trip.id, org_id: trip.org_id, player_id: id })),
      ...(guest ? [{ trip_id: trip.id, org_id: trip.org_id, guest_name: guest }] : []),
    ]
    const { error } = await supabase.from('trip_travelers').insert(rows)
    setSaving(false)
    if (error) return toast.error(error.message)
    toast.success(`Added ${rows.length} traveler${rows.length !== 1 ? 's' : ''}`)
    onSaved()
  }

  return (
    <Modal open={open} onClose={onClose} title="Add Travelers">
      <form onSubmit={handleSave} className="space-y-5">
        <div className="space-y-2">
          <label className="label">From your player roster</label>
          <Input placeholder="Search players…" value={search} onChange={e => setSearch(e.target.value)} />
          <div className="max-h-64 overflow-y-auto rounded-lg border divide-y" style={{ borderColor: '#ebe9e4' }}>
            {available.length === 0 ? (
              <p className="text-sm text-ink-muted px-3 py-3">
                {roster.length === 0 ? 'No players in your org roster yet.' : 'Everyone matching is already a traveler.'}
              </p>
            ) : available.map(p => (
              <label key={p.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selected.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="accent-fairway-600"
                />
                <span className="text-sm text-ink">{p.first_name} {p.last_name}</span>
              </label>
            ))}
          </div>
        </div>

        <Input
          label="Or add a guest (non-golfer)"
          placeholder="e.g. Jane Smith"
          value={guestName}
          onChange={e => setGuestName(e.target.value)}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={saving}>Add</Button>
        </div>
      </form>
    </Modal>
  )
}
