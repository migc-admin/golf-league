/**
 * DescriptionEditor — a plain textarea with Bold / Italic buttons that wrap the selection in
 * **…** / *…*. The text is shown on public pages by AboutCard (simple markdown, sanitized).
 * Shared by the golf event's tournament description and the trip overview.
 */
import { useRef } from 'react'

export default function DescriptionEditor({ value, onChange, rows = 5, placeholder = 'Describe the event — format, rules, prizes, anything players should know…' }) {
  const ref = useRef(null)

  function wrap(marker) {
    const el = ref.current
    if (!el) return
    const start = el.selectionStart
    const end   = el.selectionEnd
    const sel   = value.slice(start, end)
    const replacement = `${marker}${sel || 'text'}${marker}`
    const next = value.slice(0, start) + replacement + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      const newStart = start + marker.length
      el.setSelectionRange(newStart, newStart + (sel || 'text').length)
    })
  }

  return (
    <div className="border border-surface-highest rounded-sm overflow-hidden focus-within:ring-2 focus-within:ring-fairway-500">
      <div className="flex gap-1 px-2 py-1.5 bg-surface-container border-b border-surface-border">
        <button type="button" onMouseDown={e => { e.preventDefault(); wrap('**') }}
          className="px-2 py-0.5 text-sm font-bold text-ink hover:bg-surface-high rounded"
          aria-label="Bold" title="Bold (**text**)">B</button>
        <button type="button" onMouseDown={e => { e.preventDefault(); wrap('*') }}
          className="px-2 py-0.5 text-sm italic text-ink hover:bg-surface-high rounded"
          aria-label="Italic" title="Italic (*text*)">I</button>
      </div>
      <textarea
        ref={ref}
        className="w-full px-3 py-2 text-sm focus:outline-none bg-white"
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ resize: 'vertical' }}
      />
    </div>
  )
}
