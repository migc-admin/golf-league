/**
 * Turn pasted bylaws into display blocks, keeping the text as written.
 *
 *   heading  — a line that reads like a title: ALL CAPS ("ARTICLE II – HANDICAPS"),
 *              "Article 2" / "Section 4" / "Rule 7" at the start, or a short line ending in ":"
 *   list     — consecutive lines starting with -, *, • or –
 *   para     — anything else; single line breaks inside a paragraph are kept
 *
 * Blank lines separate blocks. Nothing here produces HTML: components render the
 * blocks as React elements, so pasted text can never inject markup.
 */

const BULLET = /^\s*[-*•–]\s+/

export function isHeading(line) {
  const t = line.trim()
  if (!t || t.length > 90) return false
  if (/^(article|section|rule|part|chapter)\s+[\dIVXLC]+\b/i.test(t)) return true
  const letters = t.replace(/[^A-Za-z]/g, '')
  if (letters.length >= 3 && letters === letters.toUpperCase()) return true
  return t.length <= 60 && t.endsWith(':') && !BULLET.test(t)
}

export function parseBylaws(text) {
  const blocks = []
  let para = null
  let list = null
  const flush = () => {
    if (para) blocks.push({ type: 'para', lines: para })
    if (list) blocks.push({ type: 'list', items: list })
    para = null
    list = null
  }
  for (const raw of String(text ?? '').replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) { flush(); continue }
    if (isHeading(line)) {
      flush()
      blocks.push({ type: 'heading', text: line.trim().replace(/:$/, ''), id: `rule-${blocks.length}` })
      continue
    }
    if (BULLET.test(line)) {
      if (para) { blocks.push({ type: 'para', lines: para }); para = null }
      list = list ?? []
      list.push(line.replace(BULLET, ''))
      continue
    }
    if (list) { blocks.push({ type: 'list', items: list }); list = null }
    para = para ?? []
    para.push(line.trim())
  }
  flush()
  return blocks
}

/**
 * Split a line into plain text, **bold** and web links, for safe rendering.
 * Returns [{ type: 'text' | 'bold' | 'link', value }].
 */
export function inlineParts(line) {
  const parts = []
  const re = /\*\*(.+?)\*\*|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g
  let last = 0
  let m
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push({ type: 'text', value: line.slice(last, m.index) })
    parts.push(m[1] != null ? { type: 'bold', value: m[1] } : { type: 'link', value: m[2] })
    last = re.lastIndex
  }
  if (last < line.length) parts.push({ type: 'text', value: line.slice(last) })
  return parts
}
