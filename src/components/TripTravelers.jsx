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
import Button from './ui/Button'
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

export default function TripTravelers({ trip }) {
  const [travelers, setTravelers] = useState([])
  const [roster,    setRoster]    = useState([])
  const [loading,   setLoading]   = useState(true)
  const [addOpen,   setAddOpen]   = useState(false)

  async function load() {
    const [{ data: t }, { data: p }] = await Promise.all([
      supabase.from('trip_travelers')
        .select('*, player:players(id, first_name, last_name, email)')
        .eq('trip_id', trip.id),
      supabase.from('players')
        .select('id, first_name, last_name, email')
        .eq('org_id', trip.org_id)
        .order('last_name'),
    ])
    setTravelers(t || [])
    setRoster(p || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [trip.id])

  async function removeTraveler(t) {
    const { error } = await supabase.from('trip_travelers').delete().eq('id', t.id)
    if (error) return toast.error(error.message)
    setTravelers(prev => prev.filter(x => x.id !== t.id))
  }

  if (loading) {
    return <div className="card p-5"><p className="text-sm text-ink-muted">Loading travelers…</p></div>
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h2 className="font-semibold text-ink">Travelers</h2>
            <p className="text-sm text-ink-muted mt-0.5">
              {travelers.length} traveler{travelers.length !== 1 ? 's' : ''} on this trip
            </p>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>+ Add Travelers</Button>
        </div>

        {travelers.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Add the people coming on this trip. Travelers are separate from round rosters —
            adding someone here won't change any golf round.
          </p>
        ) : (
          <div className="max-w-3xl grid gap-1 sm:grid-cols-2">
            {[...travelers].sort(byName).map(t => (
              <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2" style={{ borderColor: '#ebe9e4' }}>
                <span className="text-sm text-ink truncate">
                  {travelerName(t)}
                  {!t.player && <span className="ml-2 text-xs rounded-full px-1.5 py-0.5" style={{ background: '#f3f2ef', color: '#86868b' }}>Guest</span>}
                </span>
                <button
                  onClick={() => removeTraveler(t)}
                  title="Remove traveler"
                  className="text-gray-300 hover:text-red-400 transition-colors leading-none text-base font-bold px-1 shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {travelers.length > 0 && (
        <RoomBoard trip={trip} travelers={travelers} onUpdated={load} />
      )}

      <AddTravelersModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        trip={trip}
        roster={roster}
        travelers={travelers}
        onSaved={() => { setAddOpen(false); load() }}
      />
    </div>
  )
}

// ─── Rooming board ────────────────────────────────────────────────
// Mirrors the event Groups drag-and-drop: containers keyed 'unassigned'
// and 'room-N', persisted to trip_travelers.room_number / room_order.
function RoomBoard({ trip, travelers, onUpdated }) {
  const [containers, setContainers] = useState({})
  const [activeId,   setActiveId]   = useState(null)
  const [saving,     setSaving]     = useState(false)
  const [extraRooms, setExtraRooms] = useState(0)
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

  // Tap-to-move alternative — the drag handle is awkward on touch.
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

  async function clearAll() {
    setSaving(true)
    const { error } = await supabase
      .from('trip_travelers')
      .update({ room_number: null, room_order: null })
      .in('id', travelers.map(t => t.id))
    setSaving(false)
    if (error) return toast.error(error.message)
    setExtraRooms(0)
    onUpdated()
  }

  const unassigned = containers['unassigned'] ?? []
  const roomKeys = Object.keys(containers)
    .filter(k => k !== 'unassigned')
    .sort((a, b) => parseInt(a.replace('room-', ''), 10) - parseInt(b.replace('room-', ''), 10))
  const moveOptions = [
    { key: 'unassigned', label: 'Unassigned' },
    ...roomKeys.map(key => ({ key, label: roomLabel(labels, parseInt(key.replace('room-', ''), 10) + 1) })),
  ]
  const activeTraveler = activeId ? travelers.find(t => t.id === activeId) : null

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-ink">Rooms</h2>
          <p className="text-sm text-ink-muted mt-0.5">Drag travelers into rooms to set who's rooming together.</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {saving && <span className="text-xs text-ink-muted">Saving…</span>}
          {travelers.some(t => t.room_number) && (
            <Button size="sm" variant="ghost" onClick={clearAll}>Clear All</Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setExtraRooms(n => n + 1)}>+ Add Room</Button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={({ active }) => setActiveId(active.id)}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {unassigned.length > 0 && (
          <DroppableRoom
            id="unassigned"
            title="Unassigned"
            subtitle="Drag into a room below, or use Move to on mobile"
            members={unassigned}
            moveOptions={moveOptions}
            onMoveToRoom={moveToContainer}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mt-3">
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

function DroppableRoom({ id, title, roomNum, nameValue, onRename, subtitle, members, moveOptions, onMoveToRoom }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className="rounded-xl border-2 transition-colors"
      style={{ borderColor: isOver ? '#1B4332' : '#e5e7eb', background: isOver ? '#f0fdf4' : '#fff', minHeight: 80 }}
    >
      <div className="px-4 py-3 border-b border-gray-100">
        {onRename ? (
          <RoomNameInput roomNum={roomNum} value={nameValue} onRename={onRename} />
        ) : (
          <div className="font-semibold text-gray-900 text-sm">{title}</div>
        )}
        <div className="text-xs text-gray-400">{subtitle}</div>
      </div>
      <SortableContext items={members.map(t => t.id)} strategy={verticalListSortingStrategy}>
        <div className="p-2 space-y-1">
          {members.map(t => (
            <SortableTravelerCard
              key={t.id}
              traveler={t}
              moveOptions={moveOptions}
              currentKey={id}
              onMoveToRoom={onMoveToRoom}
            />
          ))}
          {members.length === 0 && (
            <div className="text-xs text-gray-300 text-center py-4">Drop travelers here</div>
          )}
        </div>
      </SortableContext>
    </div>
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
      className="w-full font-semibold text-gray-900 text-sm bg-transparent border-0 border-b border-transparent hover:border-gray-200 focus:border-gray-400 focus:outline-none px-0 py-0"
    />
  )
}

function SortableTravelerCard({ traveler, moveOptions, currentKey, onMoveToRoom }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: traveler.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }
  return (
    <div ref={setNodeRef} style={style} className="flex items-center justify-between rounded-lg px-3 py-2 border bg-white border-gray-100 hover:border-gray-200">
      <div className="flex items-center gap-2 min-w-0">
        <span {...attributes} {...listeners} className="cursor-grab text-gray-300 hover:text-gray-500 select-none hidden sm:inline" title="Drag to move">⠿</span>
        <span className="text-sm font-medium text-gray-900 truncate">{travelerName(traveler)}</span>
        {!traveler.player && (
          <span className="text-xs rounded-full px-1.5 py-0.5 shrink-0" style={{ background: '#f3f2ef', color: '#86868b' }}>Guest</span>
        )}
      </div>
      <select
        value=""
        onChange={e => { if (e.target.value) onMoveToRoom(traveler, currentKey, e.target.value) }}
        className="input py-0.5 text-xs w-28 bg-white text-gray-500 sm:hidden shrink-0"
      >
        <option value="">Move to…</option>
        {moveOptions.filter(o => o.key !== currentKey).map(o => (
          <option key={o.key} value={o.key}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function DragCard({ traveler }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#fff', border: '2px solid #1B4332', borderRadius: 8, padding: '6px 12px', boxShadow: '0 8px 24px rgba(0,0,0,0.18)', fontSize: 13, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', width: 'fit-content' }}>
      <span style={{ color: '#9ca3af' }}>⠿</span>
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
