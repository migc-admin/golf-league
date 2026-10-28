/**
 * MatchPairingsCard — the "Match pairings" card on the Groups & pairings page.
 *
 * Desktop (768px and up): a table  # | Team A | vs | Team B | Group | remove, with a drag
 * handle in the # cell. Phones: each match is a small card with ▲ / ▼ and a trash button.
 * Tiebreak box (only for matches tied after 18) sits under the row on desktop and inside the
 * card on phones. A dashed "Add match" row ends the list.
 *
 * Presentational plus the drag wiring. The page passes `rows` (already worked out from the
 * existing match results) and the same handlers it used before:
 *   onReorder(ids)               new order of pairing ids — dragging and ▲/▼ both call this one function
 *   onRemove(id)  onRenumber()  onSetWinner(id, playerId, note)
 *   onAdd(playerAId, playerBId)  returns true when saved (the selects then reset)
 * `locked` (event complete) hides every control except the tiebreak Winner select.
 *
 * row: { id, number, nameA, nameB, strokesA, strokesB, group: { label, differ },
 *        box: { headline, detail, showSelect } | null, playerAId, playerBId, winnerId, note }
 */

import { useId, useState } from 'react'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ActionButton } from './Button'
import AmberBanner from './AmberBanner'
import { moveItem } from '../../lib/groupsView'

const COLS = 'md:grid md:grid-cols-[3.5rem_minmax(0,1fr)_2rem_minmax(0,1fr)_8rem_2.75rem] md:items-center md:gap-2'

function StrokeTag({ n }) {
  if (!n) return null
  return (
    <span className="ml-1.5 inline-flex h-5 items-center rounded-sm bg-status-active-bg px-1.5 text-[11px] font-bold text-status-active-text" title={`Receives ${n} stroke${n !== 1 ? 's' : ''}`}>
      +{n}
    </span>
  )
}

function TrashButton({ number, onClick }) {
  return (
    <button
      type="button"
      aria-label={`Remove match ${number}`}
      onClick={onClick}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-dim hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
      </svg>
    </button>
  )
}

function ArrowButton({ dir, number, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-label={`Move match ${number} ${dir}`}
      disabled={disabled}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-sm border border-surface-highest bg-white text-ink transition-colors hover:bg-surface-dim disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d={dir === 'up' ? 'M6 15l6-6 6 6' : 'M6 9l6 6 6-6'} />
      </svg>
    </button>
  )
}

function DifferentGroupsTag({ className = '' }) {
  return (
    <span className={`inline-flex h-5 items-center rounded-sm bg-status-upcoming-bg px-1.5 text-[10px] font-bold uppercase tracking-wide text-status-upcoming-text ${className}`.trim()}>
      Different groups
    </span>
  )
}

function GroupCell({ group }) {
  return (
    <span className="text-sm text-ink-muted">
      {group.label}
      {group.differ && <DifferentGroupsTag className="ml-1.5" />}
    </span>
  )
}

function TiebreakBox({ row, onSetWinner }) {
  const [note, setNote] = useState(row.note ?? '')
  const selectId = useId()
  const box = row.box
  return (
    <div className="mt-2 rounded-sm border border-surface-border bg-surface-container px-3 py-2.5 md:ml-14">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">{box.headline}</p>
          {box.detail && <p className="text-xs text-ink-muted">{box.detail}</p>}
        </div>
        {box.showSelect && (
          <div className="flex items-center gap-2">
            <label htmlFor={selectId} className="text-xs font-semibold text-ink-muted">Winner</label>
            <select
              id={selectId}
              className="input h-11 min-w-[11rem] bg-white py-0 text-sm"
              value={row.winnerId ?? ''}
              onChange={e => onSetWinner(row.id, e.target.value, note)}
            >
              <option value="">Use tiebreaker</option>
              <option value={row.playerAId}>{row.nameA}</option>
              <option value={row.playerBId}>{row.nameB}</option>
            </select>
          </div>
        )}
      </div>
      {box.showSelect && row.winnerId && (
        <input
          className="input mt-2 h-11 w-full text-sm"
          placeholder="Reason (optional)"
          aria-label={`Reason for the winner of match ${row.number}`}
          value={note}
          onChange={e => setNote(e.target.value)}
          onBlur={() => note !== (row.note ?? '') && onSetWinner(row.id, row.winnerId, note)}
        />
      )}
    </div>
  )
}

function MatchRow({ row, index, count, locked, onRemove, onMoveRow, onSetWinner }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled: locked })
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="mb-3 rounded-sm border border-surface-border bg-white p-3 md:mb-0 md:rounded-none md:border-0 md:border-t md:bg-transparent md:px-0 md:py-2 md:first:border-t-0"
    >
      {/* Desktop row */}
      <div className={`hidden ${COLS}`}>
        <span className="flex items-center gap-2 text-sm font-semibold text-ink">
          {!locked ? (
            <span {...attributes} {...listeners} aria-label={`Drag match ${row.number}`} className="cursor-grab select-none text-surface-outline hover:text-ink-muted">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                {[6, 12, 18].flatMap(y => [9, 15].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
              </svg>
            </span>
          ) : <span className="w-3.5" />}
          {row.number}
        </span>
        <span className="min-w-0 truncate text-sm font-medium text-ink">{row.nameA}<StrokeTag n={row.strokesA} /></span>
        <span className="text-center text-xs text-ink-muted">vs</span>
        <span className="min-w-0 truncate text-sm font-medium text-ink">{row.nameB}<StrokeTag n={row.strokesB} /></span>
        <GroupCell group={row.group} />
        {!locked ? <TrashButton number={row.number} onClick={() => onRemove(row.id)} /> : <span />}
      </div>

      {/* Phone card */}
      <div className="md:hidden">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-ink">Match {row.number} · {row.group.label}</p>
          {!locked && (
            <div className="flex items-center gap-1.5">
              <ArrowButton dir="up" number={row.number} disabled={index === 0} onClick={() => onMoveRow(index, -1)} />
              <ArrowButton dir="down" number={row.number} disabled={index === count - 1} onClick={() => onMoveRow(index, 1)} />
              <TrashButton number={row.number} onClick={() => onRemove(row.id)} />
            </div>
          )}
        </div>
        {row.group.differ && <DifferentGroupsTag className="mt-1" />}
        <div className="mt-2 space-y-0.5 text-sm font-medium text-ink">
          <p>{row.nameA}<StrokeTag n={row.strokesA} /></p>
          <p className="text-xs font-normal text-ink-muted">vs</p>
          <p>{row.nameB}<StrokeTag n={row.strokesB} /></p>
        </div>
      </div>

      {row.box && <TiebreakBox row={row} onSetWinner={onSetWinner} />}
    </li>
  )
}

function AddMatchRow({ unpaired, onAdd }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const idA = useId()
  const idB = useId()
  async function submit() {
    const saved = await onAdd(a, b)
    if (saved) { setA(''); setB('') }
  }
  const opts = unpaired.map(p => <option key={p.value} value={p.value}>{p.label}</option>)
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-sm border border-dashed border-surface-highest p-3 md:flex-row md:items-end">
      <div className="flex-1">
        <label htmlFor={idA} className="label">Team A player</label>
        <select id={idA} className="input h-11 bg-white py-0" value={a} onChange={e => setA(e.target.value)}>
          <option value="">Select player</option>{opts}
        </select>
      </div>
      <div className="flex-1">
        <label htmlFor={idB} className="label">Team B player</label>
        <select id={idB} className="input h-11 bg-white py-0" value={b} onChange={e => setB(e.target.value)}>
          <option value="">Select player</option>{opts}
        </select>
      </div>
      <ActionButton onClick={submit}>Add match</ActionButton>
    </div>
  )
}

export default function MatchPairingsCard({
  id = 'match-pairings', rows, locked = false, teamAName, teamBName, withoutMatch = null, needWinnerCount = 0,
  unpaired = [], onReorder, onRemove, onRenumber, onSetWinner, onAdd, className = '',
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))
  const ids = rows.map(r => r.id)

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return
    const from = ids.indexOf(active.id)
    const to = ids.indexOf(over.id)
    if (from === -1 || to === -1) return
    onReorder(arrayMove(ids, from, to))
  }

  function onMoveRow(index, dir) {
    const next = moveItem(ids, index, dir)
    if (next !== ids) onReorder(next)
  }

  return (
    <section id={id} className={`rounded-sm border border-surface-border bg-white p-5 sm:p-6 ${className}`.trim()}>
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">Match pairings</h2>
          <p className="mt-0.5 text-sm text-ink-muted">
            {locked ? (
              'Final pairings. Strokes went to the higher-handicap player.'
            ) : (
              <>
                <span className="md:hidden">Use the arrows to reorder.</span>
                <span className="hidden md:inline">Drag to reorder. Strokes go to the higher-handicap player.</span>
              </>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {needWinnerCount > 0 && (
            <span className="rounded-full bg-status-upcoming-bg px-2.5 py-1 text-xs font-semibold text-status-upcoming-text">
              {needWinnerCount} need{needWinnerCount === 1 ? 's' : ''} a winner
            </span>
          )}
          {!locked && rows.length > 0 && <ActionButton variant="ghost" onClick={onRenumber}>Renumber</ActionButton>}
        </div>
      </header>

      {withoutMatch && (
        <AmberBanner className="mb-4" title={`${withoutMatch.count} player${withoutMatch.count !== 1 ? 's' : ''} ${withoutMatch.count !== 1 ? 'have' : 'has'} no match:`}>
          {withoutMatch.text}
        </AmberBanner>
      )}

      {rows.length === 0 ? (
        <p className="py-4 text-sm text-ink-muted">No pairings assigned yet.</p>
      ) : (
        <>
          <div className={`hidden border-b border-surface-border pb-2 text-[11px] font-bold uppercase tracking-widest text-ink-muted ${COLS}`} aria-hidden="true">
            <span>#</span><span>{teamAName || 'Team A'}</span><span /><span>{teamBName || 'Team B'}</span><span>Group</span><span />
          </div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={locked ? undefined : handleDragEnd}>
            <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={locked}>
              <ul>
                {rows.map((row, i) => (
                  <MatchRow key={row.id} row={row} index={i} count={rows.length} locked={locked}
                    onRemove={onRemove} onMoveRow={onMoveRow} onSetWinner={onSetWinner} />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        </>
      )}

      {!locked && <AddMatchRow unpaired={unpaired} onAdd={onAdd} />}
    </section>
  )
}
