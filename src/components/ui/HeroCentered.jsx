import { MoveRight, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const GREEN = '#1B4332'
const GOLD  = '#D4AF37'
const INK   = '#1d1d1f'

export default function HeroCentered({
  logo,
  slogan,
  title,
  subtitle,
  primaryCta,
  secondaryCta,
  contactInfo = [],
}) {
  return (
    <div className="w-full" style={{ background: '#ffffff' }}>
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex gap-8 py-20 lg:py-32 items-center justify-center flex-col">
          {logo && (
            <div className="flex items-center gap-4">
              <img src={logo.url} alt={logo.alt} className="h-14 w-14 object-contain" />
              <div>
                {logo.text && (
                  <p className="text-2xl font-bold leading-tight" style={{ color: INK, letterSpacing: '-0.02em' }}>
                    {logo.text}
                  </p>
                )}
                {slogan && (
                  <p className="text-sm tracking-widest font-bold uppercase" style={{ color: GOLD }}>
                    {slogan}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-4 flex-col">
            <h1
              className="text-5xl md:text-7xl max-w-2xl tracking-tighter text-center font-bold"
              style={{ fontFamily: "'Manrope', sans-serif", color: INK }}
            >
              {title}
            </h1>
            <p className="text-lg md:text-xl leading-relaxed tracking-tight text-center max-w-2xl mx-auto" style={{ color: '#6b7280' }}>
              {subtitle}
            </p>
          </div>

          <div className="flex flex-row flex-wrap gap-3 justify-center">
            {secondaryCta && (
              <a
                href={secondaryCta.href}
                className="inline-flex items-center justify-center gap-2 h-11 px-8 rounded-full text-sm font-bold whitespace-nowrap border transition-colors"
                style={{ border: `1.5px solid ${GREEN}`, color: GREEN }}
                onMouseEnter={e => { e.currentTarget.style.background = GREEN; e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = GREEN }}
              >
                {secondaryCta.text} <PlayCircle className="w-4 h-4" />
              </a>
            )}
            {primaryCta && (
              <Link
                to={primaryCta.href}
                className="inline-flex items-center justify-center gap-2 h-11 px-8 rounded-full text-sm font-bold whitespace-nowrap text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                {primaryCta.text} <MoveRight className="w-4 h-4" />
              </Link>
            )}
          </div>

          {contactInfo.length > 0 && (
            <div className="flex flex-wrap gap-6 text-xs justify-center" style={{ color: '#9ca3af' }}>
              {contactInfo.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  {item.icon && <span style={{ color: GREEN }}>{item.icon}</span>}
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
