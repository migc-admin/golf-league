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
        <h3 className="font-bold text-augusta-600" style={{ fontFamily: "'Playfair Display', serif", fontSize: '1rem' }}>{title}</h3>
        {subtitle && <p className="text-sm mt-0.5" style={{ color: '#6c757d' }}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 ml-4">{action}</div>}
    </div>
  )
}
