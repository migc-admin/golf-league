import React from 'react'

/**
 * Marquee — infinite horizontal/vertical auto-scroll for a row of children.
 * Adapted from the shadcn/21st.dev Marquee component for this project's
 * plain JS + Vite + Tailwind setup (no TypeScript, no `cn` alias).
 */
export function Marquee({
  children,
  className = '',
  duration = 20,
  pauseOnHover = false,
  direction = 'left',
  fade = true,
  fadeAmount = 10,
  ...props
}) {
  const [isPaused, setIsPaused] = React.useState(false)

  const items = React.Children.toArray(children)
  const isVertical = direction === 'up' || direction === 'down'

  const maskImage = fade
    ? (isVertical
        ? `linear-gradient(to bottom, transparent 0%, black ${fadeAmount}%, black ${100 - fadeAmount}%, transparent 100%)`
        : `linear-gradient(to right, transparent 0%, black ${fadeAmount}%, black ${100 - fadeAmount}%, transparent 100%)`)
    : undefined

  const animationName = isVertical
    ? (direction === 'up' ? 'marquee-scroll-y' : 'marquee-scroll-y-reverse')
    : (direction === 'left' ? 'marquee-scroll' : 'marquee-scroll-reverse')

  return (
    <>
      <style>{`
        @keyframes marquee-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes marquee-scroll-reverse { from { transform: translateX(-50%); } to { transform: translateX(0); } }
        @keyframes marquee-scroll-y { from { transform: translateY(0); } to { transform: translateY(-50%); } }
        @keyframes marquee-scroll-y-reverse { from { transform: translateY(-50%); } to { transform: translateY(0); } }
        .marquee-scroller { display: flex; animation: ${animationName} ${duration}s linear infinite; }
        .marquee-scroller.paused { animation-play-state: paused; }
      `}</style>
      <div
        className={`flex w-full overflow-hidden ${isVertical ? 'flex-col' : ''} ${className}`}
        style={{ maskImage, WebkitMaskImage: maskImage }}
        onMouseEnter={() => pauseOnHover && setIsPaused(true)}
        onMouseLeave={() => pauseOnHover && setIsPaused(false)}
        {...props}
      >
        <div className={`marquee-scroller flex shrink-0 ${isVertical ? 'flex-col' : ''} ${isPaused ? 'paused' : ''}`}>
          {items.map((item, index) => (
            <div key={`a-${index}`} className={`flex shrink-0 ${isVertical ? 'w-full' : ''}`}>
              {item}
            </div>
          ))}
          {items.map((item, index) => (
            <div key={`b-${index}`} className={`flex shrink-0 ${isVertical ? 'w-full' : ''}`} aria-hidden="true">
              {item}
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default Marquee
