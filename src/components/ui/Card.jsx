// Change 1: CardHeader title uses Manrope
// Change 4: .card shadow updated in index.css

export default function Card({ children, className = '', ...props }) {
  return (
    <div className={`card p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h3
          className="font-bold text-augusta-600"
          style={{ fontFamily: "'Manrope', 'DM Sans', sans-serif", fontSize: '1rem', letterSpacing: '-0.01em' }}
        >
          {title}
        </h3>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: '#6c757d' }}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}

// Change 5: Row card with optional featured (gold left bar) and avatar/chevron helpers
export function RowCard({ children, featured = false, className = '', ...props }) {
  return (
    <div className={`row-card ${featured ? 'row-card-featured' : ''} ${className}`} {...props}>
      {children}
    </div>
  )
}

export function RowAvatar({ initials, className = '' }) {
  return (
    <div className={`row-card-avatar ${className}`}>
      {initials}
    </div>
  )
}

export function RowChevron() {
  return (
    <svg className="row-card-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
