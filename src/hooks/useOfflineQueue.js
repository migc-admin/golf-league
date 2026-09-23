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
const DEAD_LETTER_KEY = 'golf_score_queue_dead_letter'
const MAX_RETRIES = 5

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

function readDeadLetter() {
  try {
    return JSON.parse(localStorage.getItem(DEAD_LETTER_KEY) ?? '[]')
  } catch {
    return []
  }
}

function writeDeadLetter(q) {
  localStorage.setItem(DEAD_LETTER_KEY, JSON.stringify(q))
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
  const [queue,          setQueue]          = useState(readQueue)
  const [syncing,        setSyncing]        = useState(false)
  const [deadLetterCount, setDeadLetterCount] = useState(() => readDeadLetter().length)
  const syncingRef = useRef(false)

  const flush = useCallback(async () => {
    const current = readQueue()
    if (current.length === 0 || syncingRef.current) return
    if (!navigator.onLine) return

    syncingRef.current = true
    setSyncing(true)

    // Items that keep failing (structurally invalid, references deleted
    // event, etc.) would otherwise retry forever and can delay valid items
    // behind them. After MAX_RETRIES failed attempts, move the item to a
    // dead-letter queue instead of leaving it in the active queue.
    const nextQueue = []
    const deadLetterAdditions = []

    for (const item of current) {
      let ok = false
      try {
        const { error } = await persistScore(item)
        ok = !error
      } catch {
        ok = false
      }

      if (ok) continue

      const retryCount = (item._retryCount ?? 0) + 1
      if (retryCount >= MAX_RETRIES) {
        deadLetterAdditions.push({ ...item, _retryCount: retryCount })
      } else {
        nextQueue.push({ ...item, _retryCount: retryCount })
      }
    }

    writeQueue(nextQueue)
    setQueue(nextQueue)

    if (deadLetterAdditions.length > 0) {
      const deadLetter = [...readDeadLetter(), ...deadLetterAdditions]
      writeDeadLetter(deadLetter)
      setDeadLetterCount(deadLetter.length)
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
    deadLetterCount,
  }
}
