/** Two-letter initials for a league name ("Mulligan's Island Golf Club" -> "MI"). */
export function initialsOf(name) {
  const words = String(name ?? '').replace(/['\u2019]/g, '').replace(/[^A-Za-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase()
}

/**
 * Fetch an image and return it as a data URL so a print or capture never depends on a
 * cross-origin request finishing. Resolves to null on any failure (the header then shows
 * the initials circle instead).
 */
export async function fetchLogoDataUrl(url) {
  if (!url) return null
  try {
    const res = await fetch(url, { mode: 'cors', cache: 'force-cache' })
    if (!res.ok) return null
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return null
    return await new Promise((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(r.result)
      r.onerror = reject
      r.readAsDataURL(blob)
    })
  } catch {
    return null
  }
}
