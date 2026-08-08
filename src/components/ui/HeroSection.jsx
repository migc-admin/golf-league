import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15, delayChildren: 0.2 },
  },
}

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { duration: 0.5, ease: 'easeOut' },
  },
}

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'

export default function HeroSection({
  logo,
  slogan,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  trustLine,
  backgroundImage,
  contactInfo = [],
}) {
  return (
    <motion.section
      className="relative flex w-full flex-col overflow-hidden md:flex-row"
      style={{ minHeight: '90vh', background: '#ffffff' }}
      initial="hidden"
      animate="visible"
      variants={containerVariants}
    >
      {/* ── Left: Content ── */}
      <div className="flex w-full flex-col justify-between p-8 md:w-1/2 md:p-12 lg:w-3/5 lg:p-16"
        style={{ zIndex: 1 }}>

        {/* Logo + slogan */}
        <motion.header className="mb-12" variants={itemVariants}>
          {logo && (
            <div className="flex items-center gap-3">
              <img src={logo.url} alt={logo.alt} className="h-9 w-9 object-contain" />
              <div>
                {logo.text && (
                  <p className="text-base font-bold" style={{ color: '#1a1a1f', letterSpacing: '-0.02em' }}>
                    {logo.text}
                  </p>
                )}
                {slogan && (
                  <p className="text-xs tracking-widest font-semibold uppercase" style={{ color: GOLD }}>
                    {slogan}
                  </p>
                )}
              </div>
            </div>
          )}
        </motion.header>

        {/* Main content */}
        <motion.main variants={containerVariants} className="flex-1 flex flex-col justify-center">
          <motion.h1
            className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight"
            style={{ fontFamily: "'Playfair Display', serif", color: '#1a1a1f' }}
            variants={itemVariants}
          >
            {title}
          </motion.h1>

          {/* Gold accent bar */}
          <motion.div
            className="my-6"
            style={{ height: 4, width: 72, background: GOLD, borderRadius: 2 }}
            variants={itemVariants}
          />

          <motion.p
            className="mb-8 max-w-md text-base leading-relaxed"
            style={{ color: '#6b7280' }}
            variants={itemVariants}
          >
            {subtitle}
          </motion.p>

          {/* CTAs */}
          <motion.div className="flex flex-col sm:flex-row gap-3" variants={itemVariants}>
            {primaryCta && (
              <Link
                to={primaryCta.href}
                className="px-7 py-3.5 rounded-full font-bold text-sm text-center transition-opacity hover:opacity-90"
                style={{ background: GREEN, color: '#ffffff' }}
              >
                {primaryCta.text}
              </Link>
            )}
            {secondaryCta && (
              <a
                href={secondaryCta.href}
                className="px-7 py-3.5 rounded-full font-bold text-sm text-center border transition-colors"
                style={{ border: `1.5px solid ${GREEN}`, color: GREEN }}
                onMouseEnter={e => { e.currentTarget.style.background = GREEN; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = GREEN }}
              >
                {secondaryCta.text}
              </a>
            )}
          </motion.div>

          {trustLine && (
            <motion.p className="mt-4 text-xs" style={{ color: '#9ca3af' }} variants={itemVariants}>
              {trustLine}
            </motion.p>
          )}
        </motion.main>

        {/* Footer info row */}
        {contactInfo.length > 0 && (
          <motion.footer className="mt-12" variants={itemVariants}>
            <div className="flex flex-wrap gap-6 text-xs" style={{ color: '#6b7280' }}>
              {contactInfo.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {item.icon && <span style={{ color: GREEN }}>{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </motion.footer>
        )}
      </div>

      {/* ── Right: Video with clip-path reveal ── */}
      <motion.div
        className="w-full md:w-1/2 lg:w-2/5 overflow-hidden relative"
        style={{ minHeight: 320 }}
        initial={{ clipPath: 'polygon(100% 0, 100% 0, 100% 100%, 100% 100%)' }}
        animate={{ clipPath: 'polygon(15% 0, 100% 0, 100% 100%, 0% 100%)' }}
        transition={{ duration: 1.2, ease: 'circOut' }}
      >
        <video
          autoPlay
          muted
          loop
          playsInline
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        >
          <source src="/Intro_screenshots.mp4" type="video/mp4" />
        </video>
      </motion.div>
    </motion.section>
  )
}
