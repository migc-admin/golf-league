import { useEffect, useState } from 'react'

/**
 * True once the element with this id has scrolled up past the top of the screen.
 * Used to show the tab bar's Register button only after the hero's Register button is out of sight.
 * `watch` should change when the element appears (e.g. after the page finishes loading).
 */
export default function useScrolledPast(id, watch) {
  const [past, setPast] = useState(false)
  useEffect(() => {
    const el = typeof document !== 'undefined' ? document.getElementById(id) : null
    if (!el || typeof IntersectionObserver === 'undefined') { setPast(false); return }
    const io = new IntersectionObserver(([entry]) => {
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    io.observe(el)
    return () => io.disconnect()
  }, [id, watch])
  return past
}
