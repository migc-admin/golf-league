/**
 * Offline-tolerant score save queue.
 *
 * Saves are attempted immediately. On failure the item is queued in
 * localStorage and retried whenever the browser comes back online.
 *
 * Usage:
 *   const { saveScore, pendingCount, syncing } = useOfflineQueue()
 *   await saveScore({ event_id, player_id, hole_number, gross_score, putts })
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
  // Keep only the newest entry per (event_id, player_id, hole_number)
  return [
    ...queue.filter(
      i => !(i.event_id === item.event_id &&
             i.player_id === item.player_id &&
             i.hole_number === item.hole_number)
    ),
    item,
  ]
}

export function useOfflineQueue() {
  const [queue,   setQueue]   = useState(readQueue)
  const [syncing, setSyncing] = useState(false)
  const syncingRef = useRef(false)

  // Flush queue to Supabase
  const flush = useCallback(async () => {
    const current = readQueue()
    if (current.length === 0 || syncingRef.current) return
    if (!navigator.onLine) return

    syncingRef.current = true
    setSyncing(true)

    const succeeded = []

    for (const item of current) {
      try {
        const { error } = await supabase
          .from('scores')
          .upsert(
            {
              event_id:    item.event_id,
              player_id:   item.player_id,
              hole_number: item.hole_number,
              gross_score: item.gross_score,
              putts:       item.putts ?? null,
            },
            { onConflict: 'event_id,player_id,hole_number' }
          )
        if (!error) succeeded.push(item._qid)
      } catch {
        // Network error — stop and retry later
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

  // Online event triggers flush
  useEffect(() => {
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [flush])

  // Attempt flush on mount if there's a queue
  useEffect(() => {
    if (readQueue().length > 0) flush()
  }, [flush])

  /**
   * Save a score. Tries Supabase immediately; on failure queues locally.
   * Returns { ok: bool, queued: bool }
   */
  const saveScore = useCallback(async (score) => {
    const payload = {
      event_id:    score.event_id,
      player_id:   score.player_id,
      hole_number: score.hole_number,
      gross_score: score.gross_score,
      putts:       score.putts ?? null,
    }

    if (navigator.onLine) {
      try {
        const { error } = await supabase
          .from('scores')
          .upsert(payload, { onConflict: 'event_id,player_id,hole_number' })
        if (!error) return { ok: true, queued: false }
        // DB/auth error — surface it, do NOT queue
        return { ok: false, queued: false, error: error.message }
      } catch (err) {
        // Log the real error so we can diagnose
        console.error('[saveScore] caught exception:', err)
        return { ok: false, queued: false, error: err?.message ?? String(err) }
      }
    }

    // Queue locally (only on real network failures)
    const item  = { ...payload, _qid: crypto.randomUUID(), _ts: Date.now() }
    const q     = deduped(readQueue(), item)
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
