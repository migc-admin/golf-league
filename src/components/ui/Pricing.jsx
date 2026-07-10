import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import confetti from 'canvas-confetti'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'

// ─── Check icon ──────────────────────────────────────────────────────────────
function Check() {
  return (
    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"
      style={{ color: GREEN, flexShrink: 0, marginTop: 2 }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

// ─── Star icon ───────────────────────────────────────────────────────────────
function Star() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}

// ─── Animated number ─────────────────────────────────────────────────────────
function AnimatedPrice({ value }) {
  return (
    <span
      key={value}
      style={{
        display: 'inline-block',
        fontSize: '3rem',
        fontWeight: 700,
        fontFamily: "'Playfair Display', serif",
        color: INK,
        letterSpacing: '-0.02em',
        animation: 'pricePop 0.35s ease-out',
      }}
    >
      {value}
    </span>
  )
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────
function Switch({ checked, onChange, switchRef }) {
  return (
    <button
      ref={switchRef}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center rounded-full transition-colors focus:outline-none"
      style={{
        width: 48,
        height: 26,
        background: checked ? GREEN : '#d1d5db',
        transition: 'background 0.25s',
      }}
    >
      <span
        style={{
          position: 'absolute',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          left: checked ? 24 : 4,
          transition: 'left 0.25s cubic-bezier(.4,0,.2,1)',
        }}
      />
    </button>
  )
}

// ─── Pricing Component ────────────────────────────────────────────────────────
export default function Pricing({ plans, title, description }) {
  const [isMonthly, setIsMonthly] = useState(true)
  const switchRef = useRef(null)

  function handleToggle(checked) {
    setIsMonthly(!checked)
    if (checked && switchRef.current) {
      const rect = switchRef.current.getBoundingClientRect()
      confetti({
        particleCount: 60,
        spread: 70,
        origin: {
          x: (rect.left + rect.width / 2) / window.innerWidth,
          y: (rect.top + rect.height / 2) / window.innerHeight,
        },
        colors: [GREEN, GOLD, '#ffffff', '#a3c4a8'],
        ticks: 200,
        gravity: 1.2,
        decay: 0.94,
        startVelocity: 28,
        shapes: ['circle'],
      })
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="text-center mb-10">
        {title && (
          <h2 className="text-3xl md:text-4xl font-bold mb-4"
            style={{ fontFamily: "'Playfair Display', serif", color: INK }}>
            {title}
          </h2>
        )}
        {description && (
          <p className="text-base max-w-xl mx-auto" style={{ color: '#6b7280', whiteSpace: 'pre-line' }}>
            {description}
          </p>
        )}
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-center gap-3 mb-12">
        <span className="text-sm font-semibold" style={{ color: isMonthly ? INK : '#9ca3af' }}>Monthly</span>
        <Switch checked={!isMonthly} onChange={handleToggle} switchRef={switchRef} />
        <span className="text-sm font-semibold" style={{ color: !isMonthly ? INK : '#9ca3af' }}>
          Annual{' '}
          <span className="font-bold" style={{ color: GREEN }}>
            (Save up to 43%)
          </span>
        </span>
      </div>

      {/* Cards */}
      <div className="grid md:grid-cols-3 gap-4 items-center">
        {plans.map((plan, index) => {
          const isPopular  = plan.isPopular
          const priceVal   = isMonthly ? plan.price : plan.yearlyPrice
          const isFree     = priceVal === 0 || plan.price === 0

          return (
            <motion.div
              key={plan.name}
              initial={{ y: 50, opacity: 0 }}
              whileInView={{
                y: isPopular ? -20 : 0,
                opacity: 1,
                x: index === 2 ? -20 : index === 0 ? 20 : 0,
                scale: index === 0 || index === 2 ? 0.95 : 1,
              }}
              viewport={{ once: true }}
              transition={{
                duration: 1.4,
                type: 'spring',
                stiffness: 90,
                damping: 28,
                delay: index * 0.1 + 0.2,
              }}
              style={{
                position: 'relative',
                borderRadius: '1.25rem',
                padding: '1.75rem',
                background: '#ffffff',
                border: isPopular ? `2px solid ${GREEN}` : '1px solid #ebe9e4',
                display: 'flex',
                flexDirection: 'column',
                zIndex: isPopular ? 10 : 0,
                boxShadow: isPopular
                  ? '0 20px 60px rgba(27,67,50,0.18)'
                  : '0 2px 12px rgba(0,0,0,0.05)',
              }}
            >
              {/* Popular badge */}
              {isPopular && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  background: GREEN,
                  color: '#fff',
                  padding: '4px 12px',
                  borderRadius: '0 1.25rem 0 0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}>
                  <Star /> Popular
                </div>
              )}

              {/* Plan name */}
              <p className="text-sm font-semibold uppercase tracking-widest mb-4"
                style={{ color: '#9ca3af' }}>
                {plan.name}
              </p>

              {/* Price */}
              <div className="flex items-end gap-2 mb-1">
                {isFree ? (
                  <AnimatedPrice value="Free" />
                ) : (
                  <AnimatedPrice value={`$${priceVal}`} />
                )}
                {!isFree && (
                  <span className="text-sm font-medium mb-2.5" style={{ color: '#9ca3af' }}>
                    / {isMonthly ? 'mo' : 'yr'}
                  </span>
                )}
              </div>
              <p className="text-xs mb-1" style={{ color: '#9ca3af' }}>
                {isFree ? 'forever free' : isMonthly ? 'billed monthly' : 'billed annually'}
              </p>

              {/* Yearly savings callout */}
              {!isMonthly && !isFree && plan.price > 0 && (
                <p className="text-xs font-semibold mb-4" style={{ color: GREEN }}>
                  <span style={{ textDecoration: 'line-through', color: '#9ca3af', fontWeight: 400 }}>
                    ${plan.price * 12}/yr
                  </span>
                  {' '}— you save ${plan.price * 12 - plan.yearlyPrice}
                </p>
              )}

              {/* Features */}
              <ul className="mt-4 space-y-2.5 flex-1 mb-6">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: '#4b5563' }}>
                    <Check />
                    {f}
                  </li>
                ))}
              </ul>

              <hr style={{ borderColor: '#ebe9e4', marginBottom: '1.25rem' }} />

              {/* CTA */}
              {plan.href.startsWith('mailto') ? (
                <a href={plan.href}
                  className="block text-center py-3 rounded-full font-bold text-sm transition-all"
                  style={{
                    background: isPopular ? GREEN : '#f3f4f6',
                    color: isPopular ? '#fff' : INK,
                    border: isPopular ? 'none' : `1px solid #d1d5db`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                  {plan.buttonText}
                </a>
              ) : (
                <Link to={plan.href}
                  className="block text-center py-3 rounded-full font-bold text-sm transition-all"
                  style={{
                    background: isPopular ? GREEN : '#f3f4f6',
                    color: isPopular ? '#fff' : INK,
                    border: isPopular ? 'none' : `1px solid #d1d5db`,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.85' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                  {plan.buttonText}
                </Link>
              )}

              {plan.description && (
                <p className="text-xs text-center mt-4" style={{ color: '#9ca3af' }}>{plan.description}</p>
              )}
            </motion.div>
          )
        })}
      </div>

      {/* keyframe for AnimatedPrice */}
      <style>{`
        @keyframes pricePop {
          0%   { opacity: 0.3; transform: translateY(6px) scale(0.96); }
          100% { opacity: 1;   transform: translateY(0)   scale(1); }
        }
      `}</style>
    </div>
  )
}
