import { useEffect, useState } from 'react'
import { motion, useMotionValue } from 'framer-motion'

const ONE_SECOND = 1000
const AUTO_DELAY = ONE_SECOND * 5 // time between auto-advances (ms)
const DRAG_BUFFER = 50 // how far (px) user must drag to change slide

const SPRING_OPTIONS = {
  type: 'spring',
  mass: 3,
  stiffness: 400,
  damping: 50,
}

// Slide size (Tailwind classes) — tall enough that full-length screenshots fit without cropping
const SLIDE_SIZE_CLASSES = 'w-[360px] sm:w-[520px] h-[480px] sm:h-[680px]'
const SLIDE_WIDTH_CLASSES = 'w-[360px] sm:w-[520px]'

// Scale applied to active vs. inactive slides
const ACTIVE_SCALE = 0.97
const INACTIVE_SCALE = 0.88

// Thumbnail size (Tailwind classes)
const THUMB_SIZE_CLASSES = 'h-11 w-11 sm:h-13 sm:w-13'

const ACTIVE_THUMB_RING_CLASSES = 'ring-2'

/**
 * slides: [{ key, label, src, caption }]
 */
export default function ThumbnailCarousel({ slides = [] }) {
  const [imgIndex, setImgIndex] = useState(0)
  const dragX = useMotionValue(0)

  useEffect(() => {
    const intervalRef = setInterval(() => {
      const x = dragX.get()
      if (x === 0) {
        setImgIndex((prevIndex) => (prevIndex === slides.length - 1 ? 0 : prevIndex + 1))
      }
    }, AUTO_DELAY)
    return () => clearInterval(intervalRef)
  }, [dragX, slides.length])

  const onDragEnd = () => {
    const x = dragX.get()
    if (x <= -DRAG_BUFFER && imgIndex < slides.length - 1) {
      setImgIndex((prevIndex) => prevIndex + 1)
    } else if (x >= DRAG_BUFFER && imgIndex > 0) {
      setImgIndex((prevIndex) => prevIndex - 1)
    }
  }

  if (slides.length === 0) return null

  const active = slides[imgIndex]

  return (
    <div className="w-full overflow-hidden select-none py-2">
      <div className="flex flex-col lg:flex-row items-center lg:items-center gap-10 lg:gap-16">
        {/* ── Left: image carousel + thumbnails ── */}
        <div className={`relative ${SLIDE_WIDTH_CLASSES} shrink-0 mx-auto lg:mx-0 py-4`}>
          <div className="relative overflow-hidden rounded-2xl">
            <motion.div
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              style={{ x: dragX }}
              animate={{ translateX: `-${imgIndex * 100}%` }}
              transition={SPRING_OPTIONS}
              onDragEnd={onDragEnd}
              className="flex cursor-grab active:cursor-grabbing"
            >
              {slides.map((s, idx) => (
                <motion.div
                  key={s.key}
                  animate={{ scale: imgIndex === idx ? ACTIVE_SCALE : INACTIVE_SCALE }}
                  transition={SPRING_OPTIONS}
                  className={`relative ${SLIDE_SIZE_CLASSES} shrink-0 rounded-2xl overflow-hidden shadow-xl bg-white`}
                  style={{ border: '1px solid #ebe9e4' }}
                >
                  <img
                    src={s.src}
                    alt={s.label}
                    draggable={false}
                    className="w-full h-full object-contain pointer-events-none"
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>

          <div className="mt-4 flex gap-2 justify-center lg:justify-start items-center overflow-x-auto overflow-y-visible p-1 pb-2">
            {slides.map((s, idx) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setImgIndex(idx)}
                aria-label={`Go to ${s.label}`}
                className={`relative ${THUMB_SIZE_CLASSES} rounded-lg overflow-hidden transition-all duration-300 shrink-0 cursor-pointer ${
                  idx === imgIndex
                    ? `scale-110 ${ACTIVE_THUMB_RING_CLASSES} shadow-md opacity-100`
                    : 'opacity-50 hover:opacity-90'
                }`}
                style={idx === imgIndex ? { '--tw-ring-color': '#1B4332' } : undefined}
              >
                <img src={s.src} alt="" className="w-full h-full object-cover object-top" />
              </button>
            ))}
          </div>
        </div>

        {/* ── Right: description of the active slide ── */}
        <div className="flex-1 text-center lg:text-left max-w-md mx-auto lg:mx-0">
          <p className="text-xl sm:text-2xl font-bold" style={{ fontFamily: "'Manrope', sans-serif", color: '#1B4332' }}>
            {active?.label}
          </p>
          {active?.caption && (
            <p className="text-base mt-3 leading-relaxed" style={{ color: '#6b7280' }}>{active.caption}</p>
          )}
        </div>
      </div>
    </div>
  )
}
