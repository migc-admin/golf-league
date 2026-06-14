/**
 * Offline-tolerant score save queue.
 *
 * Saves are attempted immediately. On failure the item is queued in
 * localStorage and retried whenever the browser comes back online.
 *
 * Each save:
 *  1. Fetches the existing score to detect conflicts
 *  2. Writes an audit log entry (score_audit_log)
 *  3. Upserts the score with entered_by
 *
 * Usage:
 *   const { saveScore, pendingCount, syncing } = useOfflineQueue()
 *   await saveScore({ event_id, player_id, hole_number, gross_score, putts, entered_by })
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'

const QUEUE_KEY = 'golf_score_queue'

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeQueue(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

function deduped(queue, item) {
  return [
    ...queue.filter(
      i => !(i.event_id === item.event_id &&
             i.player_id === item.player_id &&
             i.hole_number === item.hole_number)
    ),
    item,
  ]
}

async function persistScore(score) {
  const { event_id, player_id, hole_number, gross_score, putts, entered_by } = score

  // 1. Fetch existing score to detect conflict
  const { data: existing } = await supabase
    .from('scores')
    .select('gross_score, putts, entered_by')
    .eq('event_id', event_id)
    .eq('player_id', player_id)
    .eq('hole_number', hole_number)
    .maybeSingle()

  const isConflict = existing != null
    && existing.entered_by != null
    && existing.entered_by !== entered_by
    && existing.gross_score !== gross_score

  // 2. Write audit log
  await supabase.from('score_audit_log').insert({
    event_id,
    player_id,
    hole_number,
    new_score:     gross_score,
    previous_score: existing?.gross_score ?? null,
    entered_by:    entered_by ?? 'unknown',
    previous_entered_by: existing?.entered_by ?? null,
    is_conflict:   isConflict,
  })

  // 3. Upsert score
  const { error } = await supabase
    .from('scores')
    .upsert(
      { event_id, player_id, hole_number, gross_score, putts: putts ?? null, entered_by: entered_by ?? null },
      { onConflict: 'event_id,player_id,hole_number' }
    )

  return { error, isConflict }
}

export function useOfflineQueue() {
  const [queue,   setQueue]   = useState(readQueue)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  const flush = useCallback(async () => {
    const current = readQueue()
    if (current.length === 0 || syncingRef.current) return
    if (!navigator.onLine) return

    syncingRef.current = true
    setSyncing(true)

    const succeeded = []

    for (const item of current) {
      try {
        const { error } = await persistScore(item)
        if (!error) succeeded.push(item._qid)
      } catch {
        break
      }
    }

    if (succeeded.length > 0) {
      const remaining = current.filter(i => !succeeded.includes(i._qid))
      writeQueue(remaining)
      setQueue(remaining)
    }

    syncingRef.current = false
    setSyncing(false)
  }, [])

  useEffect(() => {
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [flush])

  useEffect(() => {
    if (readQueue().length > 0) flush()
  }, [flush])

  const saveScore = useCallback(async (score) => {
    if (navigator.onLine) {
      try {
        const { error, isConflict } = await persistScore(score)
        if (!error) return { ok: true, queued: false, conflict: isConflict }
        return { ok: false, queued: false, error: error.message }
      } catch (err) {
        console.error('[saveScore] caught exception:', err)
        return { ok: false, queued: false, error: err?.message ?? String(err) }
      }
    }

    const item = { ...score, _qid: crypto.randomUUID(), _ts: Date.now() }
    const q    = deduped(readQueue(), item)
    writeQueue(q)
    setQueue(q)
    return { ok: false, queued: true }
  }, [])

  return {
    saveScore,
    pendingCount: queue.length,
    syncing,
    flushQueue: flush,
  }
}
