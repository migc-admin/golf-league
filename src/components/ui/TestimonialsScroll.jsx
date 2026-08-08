import React from 'react'
import { motion } from 'framer-motion'

const GOLD  = '#D4AF37'
const GREEN = '#1B4332'

const testimonials = [
  {
    text: "The post-round process is a breeze compared to manually checking scorecards. What used to take an hour is done before everyone leaves the clubhouse.",
    name: "League Organizer",
    role: "Mulligan's Island Golf Club · San Diego, CA",
  },
  {
    text: "The ability to enter scores during the round and keep track of the competition is a game changer! Everyone is checking the leaderboard on the back nine.",
    name: "League Member",
    role: "Mulligan's Island Golf Club · San Diego, CA",
  },
  {
    text: "Online registration, payment collection, and player organization has made the pre-tournament setup way more efficient. Our director can actually enjoy the round now.",
    name: "League Administrator",
    role: "Mulligan's Island Golf Club · San Diego, CA",
  },
  {
    text: "The live leaderboard is a hit with our players. Everyone's on their phone checking standings between holes — it adds a whole new level of excitement to the round.",
    name: "Event Coordinator",
    role: "Mulligan's Island Golf Club · San Diego, CA",
  },
  {
    text: "Setting up groups and printing tee sheets used to take most of my morning. With Scorify I have it done the night before in under 10 minutes.",
    name: "League Director",
    role: "Mulligan's Island Golf Club · San Diego, CA",
  },
  {
    text: "No more arguments at the scoring table. Everything is digital, timestamped, and visible to everyone. It's just cleaner.",
    name: "Season Player",
    role: "Mulligan's Island Golf Club · San Diego, CA",
  },
]

const col1 = testimonials.slice(0, 2)
const col2 = testimonials.slice(2, 4)
const col3 = testimonials.slice(4, 6)

function StarRow() {
  return (
    <div className="flex gap-0.5 mb-3">
      {[...Array(5)].map((_, i) => (
        <svg key={i} width="13" height="13" viewBox="0 0 24 24" fill={GOLD}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  )
}

function TestimonialCard({ text, name, role }) {
  return (
    <motion.div
      whileHover={{ scale: 1.03, y: -6, transition: { type: 'spring', stiffness: 400, damping: 17 } }}
      className="p-7 rounded-2xl bg-white border max-w-xs w-full select-none cursor-default"
      style={{ border: '1px solid #ebe9e4', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
    >
      <StarRow />
      <p className="text-sm leading-relaxed mb-5" style={{ color: '#374151' }}>"{text}"</p>
      <div>
        <div className="text-sm font-semibold" style={{ color: '#1a1a1f' }}>{name}</div>
        <div className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{role}</div>
      </div>
    </motion.div>
  )
}

function ScrollColumn({ testimonials, duration = 15, className = '' }) {
  return (
    <div className={`overflow-hidden ${className}`} style={{ maxHeight: 700 }}>
      <motion.div
        animate={{ translateY: '-50%' }}
        transition={{ duration, repeat: Infinity, ease: 'linear', repeatType: 'loop' }}
        className="flex flex-col gap-5 pb-5"
      >
        {[0, 1].map(idx => (
          <React.Fragment key={idx}>
            {testimonials.map((t, i) => (
              <TestimonialCard key={`${idx}-${i}`} {...t} />
            ))}
          </React.Fragment>
        ))}
      </motion.div>
    </div>
  )
}

export default function TestimonialsScroll() {
  return (
    <section className="py-24" style={{ background: '#fbfaf8' }}>
      <div className="max-w-6xl mx-auto px-6">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col items-center mb-14"
        >
          <div className="px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest mb-4"
            style={{ background: 'rgba(27,67,50,0.08)', color: GREEN }}>
            Testimonials
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4"
            style={{ fontFamily: "'Playfair Display', serif", color: '#1a1a1f' }}>
            What organizers are saying
          </h2>
          <p className="text-center text-base max-w-sm" style={{ color: '#6b7280' }}>
            Real feedback from league directors and players using Scorify every week.
          </p>
        </motion.div>

        {/* Social proof bar */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mb-14">
          {[
            { num: '4', label: 'Active leagues this season' },
            { num: '100+', label: 'Rounds scored on platform' },
            { num: '$0', label: 'To get started' },
          ].map((s, i) => (
            <React.Fragment key={s.num}>
              {i > 0 && <div className="hidden sm:block w-px h-8" style={{ background: '#e5e7eb' }} />}
              <div className="text-center">
                <div className="text-3xl font-bold" style={{ fontFamily: "'Playfair Display', serif", color: GREEN }}>{s.num}</div>
                <div className="text-sm mt-1" style={{ color: '#6b7280' }}>{s.label}</div>
              </div>
            </React.Fragment>
          ))}
        </div>

        {/* Scrolling columns */}
        <div
          className="flex justify-center gap-5"
          style={{ maskImage: 'linear-gradient(to bottom, transparent, black 10%, black 90%, transparent)' }}
        >
          <ScrollColumn testimonials={col1} duration={14} />
          <ScrollColumn testimonials={col2} duration={18} className="hidden md:block" />
          <ScrollColumn testimonials={col3} duration={16} className="hidden lg:block" />
        </div>

        {/* Payment trust note */}
        <div className="mt-12 rounded-2xl px-6 py-4 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left"
          style={{ background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <svg width="24" height="24" fill="none" stroke="#16a34a" strokeWidth="2" viewBox="0 0 24 24" className="shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p className="text-sm" style={{ color: '#15803d' }}>
            <strong>Payments stay between you and your players.</strong> Scorify connects to Venmo and PayPal links you control — we never hold or process your league funds.
          </p>
        </div>

      </div>
    </section>
  )
}
