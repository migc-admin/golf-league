import { ArrowRight, PlayCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

const GREEN = '#1B4332'

export default function HeroTwoButtons({
  eyebrow = "We're live!",
  title = 'This is the start of something!',
  subtitle = 'Managing a small business today is already tough. Avoid further complications by ditching outdated, tedious trade methods.',
  primaryCta = { text: 'Get Started Free', href: '/onboarding' },
  secondaryCta = { text: 'See Features', href: '#features' },
  image,
  video,
}) {
  return (
    <div className="w-full py-20 lg:py-40 bg-surface">
      <div className="mx-auto max-w-container px-6">
        <div className="grid grid-cols-1 gap-8 items-center lg:grid-cols-2">
          <div className="flex gap-4 flex-col">
            <div>
              <span className="inline-flex items-center rounded-full border border-fairway-200 px-2.5 py-0.5 text-xs font-semibold text-fairway-700">
                {eyebrow}
              </span>
            </div>
            <div className="flex gap-4 flex-col">
              <h1 className="text-5xl md:text-7xl max-w-lg tracking-tighter text-left font-semibold text-ink">
                {title}
              </h1>
              <p className="text-xl leading-relaxed tracking-tight text-ink-muted max-w-md text-left">
                {subtitle}
              </p>
            </div>
            <div className="flex flex-row flex-wrap gap-4">
              <a
                href={secondaryCta.href}
                className="inline-flex items-center justify-center gap-2 h-11 px-8 rounded-md text-sm font-medium whitespace-nowrap border border-ink/15 text-ink hover:bg-surface-high transition-colors"
              >
                {secondaryCta.text} <PlayCircle className="w-4 h-4" />
              </a>
              <Link
                to={primaryCta.href}
                className="inline-flex items-center justify-center gap-2 h-11 px-8 rounded-md text-sm font-medium whitespace-nowrap text-white transition-opacity hover:opacity-90"
                style={{ background: GREEN }}
              >
                {primaryCta.text} <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
          <div className="bg-surface-high rounded-md aspect-square overflow-hidden">
            {video && (
              <video
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover"
              >
                <source src={video} type="video/mp4" />
              </video>
            )}
            {!video && image && <img src={image} alt="" className="w-full h-full object-cover" />}
          </div>
        </div>
      </div>
    </div>
  )
}
