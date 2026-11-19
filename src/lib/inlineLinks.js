// Inline links for static blog copy: write [link text](/blog/some-slug) inside any
// paragraph or list item string. Only site-relative paths ("/...") and https URLs
// are recognized; anything else is left as plain text.
const LINK_RE = /\[([^\]]+)\]\((\/[^)\s]*|https:\/\/[^)\s]+)\)/g

/**
 * Split a string into plain-text and link segments.
 * @returns {Array<{ text: string, href?: string }>}
 */
export function parseInlineLinks(text) {
  const segments = []
  let last = 0
  for (const m of text.matchAll(LINK_RE)) {
    if (m.index > last) segments.push({ text: text.slice(last, m.index) })
    segments.push({ text: m[1], href: m[2] })
    last = m.index + m[0].length
  }
  if (last < text.length) segments.push({ text: text.slice(last) })
  return segments
}

/** Every href used by inline links in a string. */
export function inlineLinkHrefs(text) {
  return [...text.matchAll(LINK_RE)].map(m => m[2])
}
