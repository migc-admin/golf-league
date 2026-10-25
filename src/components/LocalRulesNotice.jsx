/**
 * LocalRulesNotice — a warning banner for the scoring app that points players to the
 * event's local rules. Unread: a prominent amber box. Once a player has opened and
 * acknowledged the rules it shrinks to a slim "Local rules" link. If an admin edits
 * the rules, it becomes prominent again.
 */
import { useState } from 'react'
import DOMPurify from 'dompurify'
import { markdownToHtml, textFingerprint } from '../lib/simpleMarkdown'

const keyFor = eventId => `local_rules_seen_${eventId}`

function readSeen(eventId) {
  try { return localStorage.getItem(keyFor(eventId)) } catch { return null }
}
function writeSeen(eventId, value) {
  try { localStorage.setItem(keyFor(eventId), value) } catch { /* private mode: banner just stays prominent */ }
}

/** The pop-up that shows the full rules. Closing it (backdrop or "Got it") calls onClose. */
function LocalRulesDialog({ text, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Local rules"
        className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl p-5 overflow-y-auto"
        style={{ maxHeight: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <span style={{ fontSize: 22 }} aria-hidden="true">⚠️</span>
          <h2 className="text-lg font-bold text-ink">Local Rules</h2>
        </div>
        <div
          className="text-sm leading-relaxed"
          style={{ color: '#374151' }}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(markdownToHtml(text), { ALLOWED_TAGS: ['strong', 'em', 'br'], ALLOWED_ATTR: [] }) }}
        />
        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full py-3 rounded-xl text-sm font-bold text-white"
          style={{ background: '#1B4332' }}
        >
          Got it
        </button>
      </div>
    </div>
  )
}

/**
 * Small header link that reopens the rules once the big banner has gone away.
 * Same look as the other top-bar links (Leaderboard, Progress).
 */
export function LocalRulesLink({ text }) {
  const rules = (text ?? '').trim()
  const [open, setOpen] = useState(false)
  if (!rules) return null
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-semibold px-2.5 py-1.5 rounded-full transition-colors hover:bg-surface-high whitespace-nowrap"
        style={{ color: '#92400e' }}
      >
        Local rules
      </button>
      {open && <LocalRulesDialog text={rules} onClose={() => setOpen(false)} />}
    </>
  )
}

export default function LocalRulesNotice({ eventId, text, today = false, card = false }) {
  const rules = (text ?? '').trim()
  const fingerprint = textFingerprint(rules)
  const [seen, setSeen] = useState(() => readSeen(eventId) === fingerprint)
  const [open, setOpen] = useState(false)

  if (!rules) return null

  function close() {
    writeSeen(eventId, fingerprint)
    setSeen(true)
    setOpen(false)
  }

  return (
    <>
      {seen ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full px-4 py-1.5 text-xs font-semibold text-left"
          style={{ background: '#fffbeb', color: '#92400e', ...(card ? { border: '1px solid #fde68a', borderRadius: 12 } : { borderTop: '1px solid #fde68a' }) }}
        >
          ⚠ Local rules in play · <span style={{ textDecoration: 'underline' }}>View</span>
        </button>
      ) : (
        <div
          className="px-4 py-3 flex items-center gap-3"
          style={{ background: '#fef3c7', ...(card ? { border: '1px solid #fcd34d', borderRadius: 16 } : { borderTop: '1px solid #fcd34d', borderBottom: '1px solid #fcd34d' }) }}
        >
          <span style={{ fontSize: 20 }} aria-hidden="true">⚠️</span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold" style={{ color: '#78350f' }}>
              {today ? 'Local rules are in play today' : 'Local rules are in play for this event'}
            </div>
            <div className="text-xs" style={{ color: '#92400e' }}>Read them before you tee off.</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="shrink-0 text-xs font-bold px-3 py-2 rounded-full"
            style={{ background: '#92400e', color: '#fff' }}
          >
            Read local rules
          </button>
        </div>
      )}

      {open && <LocalRulesDialog text={rules} onClose={close} />}
    </>
  )
}
