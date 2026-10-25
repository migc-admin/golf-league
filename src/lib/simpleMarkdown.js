/**
 * Tiny, safe formatting for admin-written text (descriptions, local rules):
 * **bold**, *italic*, and line breaks. Everything is HTML-escaped first, so the only
 * tags that can come out are <strong>, <em> and <br/>.
 */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export function markdownToHtml(text) {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\r?\n/g, '<br/>')
}

/** Short stable fingerprint of a text, used to remember which version a player has read. */
export function textFingerprint(text) {
  const s = String(text ?? '').trim()
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}
