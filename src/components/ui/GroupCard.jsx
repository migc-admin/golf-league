/**
 * GroupCard — one group on the Groups & pairings page (also used for the Unassigned pool).
 *
 *   Group 1 · 4 players                                   9:50 AM
 *   ⠿ Tam Tran   SCORER  [A]                                  ✕
 *   ⠿ Colin Harrison     [B]                                  ✕
 *   ┄ Open spot · drop a player here ┄
 *
 * Presentational plus the drag-and-drop wiring the old cards had (@dnd-kit droppable +
 * sortable). The page passes the members already in display order (scorers first) and the
 * same handlers it used before:
 *   onMove(ep, fromKey, toKey)   the existing move function (drag end and the phone menu share it)
 *   onReturnToPool(ep)           the old ✕ button
 *   noShow                       the old No Show / Undo controls (active events only)
 * When `locked`, nothing can be dragged, moved or removed: no handles, no ✕, no menu, no
 * open-spot target, and drag-and-drop is switched off in the hooks themselves.
 *
 * Below 768px a row is two lines: name + tags, then a labeled "Group" menu and the remove
 * button. From 768px it is one line with a drag handle and the menu is hidden.
 */

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ActionButton } from './Button'
import { fullName } from '../../lib/groupsView'

export const GROUP_SIZE = 4

function Tag({ children, tone = 'neutral', title }) {
  const tones = {
    scorer: 'bg-status-upcoming-bg text-status-upcoming-text',
    A: 'bg-status-active-bg text-status-active-text',
    B: 'bg-surface-high text-ink-muted',
    warn: 'bg-status-upcoming-bg text-status-upcoming-text',
  }
  return (
    <span title={title} className={`inline-flex h-5 items-center rounded-sm px-1.5 text-[10px] font-bold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
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

function PlayerRow({ ep, groupKey, isScorer, locked, moveOptions, onMove, onReturnToPool, noShow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: ep.id, disabled: locked })
  const name = fullName(ep)
  const isNoShow = noShow?.isNoShow?.(ep) ?? false
  const canMove = !locked && moveOptions && onMove
  const canRemove = !locked && !!onReturnToPool

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`flex min-h-[44px] flex-col justify-center gap-1.5 border-t border-surface-border px-3 py-2 first:border-t-0 md:flex-row md:items-center md:gap-2 ${isNoShow ? 'bg-surface-container' : 'bg-white'}`}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!locked && (
          <span
            {...attributes}
            {...listeners}
            aria-label={`Drag ${name}`}
            className="hidden cursor-grab select-none text-surface-outline hover:text-ink-muted md:inline-flex"
          >
            <HandleIcon />
          </span>
        )}
        <span className={`truncate text-sm font-medium ${isNoShow ? 'text-ink-muted' : 'text-ink'}`}>{name}</span>
        {isScorer && <Tag tone="scorer">Scorer</Tag>}
        {isNoShow
          ? <Tag tone="warn">No show</Tag>
          : ep.flight && <Tag tone={ep.flight === 'A' ? 'A' : 'B'} title={`Flight ${ep.flight}`}>{ep.flight}</Tag>}
      </div>

      <div className="flex items-center gap-2 md:shrink-0">
        {canMove && (
          <label className="flex flex-1 items-center gap-2 text-xs text-ink-muted md:hidden">
            <span>Group</span>
            <select
              className="input h-11 flex-1 bg-white py-0 text-sm"
              value={groupKey}
              onChange={e => onMove(ep, groupKey, e.target.value)}
            >
              {moveOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
        )}
        {noShow?.show && (
          isNoShow ? (
            <ActionButton variant="ghost" size="sm" disabled={noShow.loadingId === ep.player_id} onClick={() => noShow.onClear(ep)}>
              {noShow.loadingId === ep.player_id ? '…' : 'Undo'}
            </ActionButton>
          ) : (
            <ActionButton variant="ghost" size="sm" disabled={noShow.loadingId === ep.player_id} onClick={() => noShow.onMark(ep)}>
              {noShow.loadingId === ep.player_id ? '…' : 'No show'}
            </ActionButton>
          )
        )}
        {canRemove && (
          <button
            type="button"
            aria-label={`Remove ${name} from group`}
            onClick={() => onReturnToPool(ep)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm text-ink-muted transition-colors hover:bg-surface-dim hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fairway-500"
          >
            <CloseIcon />
          </button>
        )}
      </div>
    </li>
  )
}

export default function GroupCard({
  id, title, subtitle, teeTime = null, headerExtra = null, members, scorerIdSet = new Set(), locked = false,
  moveOptions = null, onMove, onReturnToPool, noShow, showOpenSpot = true, capacity = GROUP_SIZE, className = '',
}) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled: locked })
  const openSpot = showOpenSpot && !locked && members.length < capacity

  return (
    <section
      ref={setNodeRef}
      className={`overflow-hidden rounded-sm border transition-colors ${
        isOver ? 'border-fairway-700 bg-fairway-50' : 'border-surface-border bg-surface-container'
      } ${className}`.trim()}
    >
      <header className="flex items-start justify-between gap-3 border-b border-surface-border px-4 py-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-ink">{title}</h3>
          <p className="text-xs text-ink-muted">{subtitle}</p>
        </div>
        {headerExtra ?? (teeTime && <span className="shrink-0 text-sm font-semibold tabular-nums text-ink">{teeTime}</span>)}
      </header>

      <SortableContext items={members.map(m => m.id)} strategy={verticalListSortingStrategy} disabled={locked}>
        <ul className="bg-white">
          {members.map(ep => (
            <PlayerRow
              key={ep.id}
              ep={ep}
              groupKey={id}
              isScorer={scorerIdSet.has(ep.id)}
              locked={locked}
              moveOptions={moveOptions}
              onMove={onMove}
              onReturnToPool={onReturnToPool}
              noShow={noShow}
            />
          ))}
        </ul>
      </SortableContext>

      {openSpot && (
        <div className="m-2 flex min-h-[44px] items-center justify-center rounded-sm border border-dashed border-surface-highest px-3 text-xs text-ink-muted">
          Open spot · drop a player here
        </div>
      )}
      {members.length === 0 && locked && <p className="px-4 py-4 text-xs text-ink-muted">No players in this group.</p>}
    </section>
  )
}
