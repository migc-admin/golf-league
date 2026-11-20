// Shared building blocks for the public "solution" landing pages
// (/golf-tournament-software, /golf-trip-app). Same look as
// /golf-league-software so the three read as one family.
import { Link } from 'react-router-dom'
import { SOLUTIONS } from '../../lib/solutions'
import SiteHeader from '../ui/SiteHeader'

export const GREEN = '#1B4332'
export const GOLD  = '#D4AF37'
export const INK   = '#1d1d1f'
export const MUTED = '#6b7280'
export const BODY  = '#374151'
export const LINE  = '#ebe9e4'
export const SITE  = 'https://www.scorifygolf.com'

const linkCls = 'font-semibold underline underline-offset-2'

export function Eyebrow({ children, color = GREEN }) {
  return <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color }}>{children}</p>
}

export function H2({ children }) {
  return (
    <h2 className="text-2xl md:text-3xl font-bold mb-4" style={{ fontFamily: "'Manrope', sans-serif", color: INK, letterSpacing: '-0.01em' }}>
      {children}
    </h2>
  )
}

export function TextLink({ to, children }) {
  return <Link to={to} className={linkCls} style={{ color: GREEN }}>{children}</Link>
}

export function LandingHeader() {
  return (
    <SiteHeader />
  )
}

/** CTA can be { to } (internal route), { href } (mailto/anchor). */
function Cta({ cta, primary }) {
  const cls = 'text-center px-7 py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90'
  const style = primary ? { background: GOLD, color: '#1a1a1a' } : { border: '1px solid rgba(255,255,255,0.35)', color: '#fff' }
  return cta.to
    ? <Link to={cta.to} className={cls} style={style}>{cta.text}</Link>
    : <a href={cta.href} className={cls} style={style}>{cta.text}</a>
}

export function LandingHero({ crumb, eyebrow, title, subtitle, primary, secondary, note }) {
  return (
    <section style={{ background: `linear-gradient(135deg, #0b2318, ${GREEN})` }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 pb-16 md:pb-20">
        <nav aria-label="Breadcrumb" className="text-xs mb-10" style={{ color: 'rgba(255,255,255,0.6)' }}>
          <Link to="/" className="hover:underline">Home</Link>
          <span className="mx-2">/</span>
          <span style={{ color: 'rgba(255,255,255,0.85)' }}>{crumb}</span>
        </nav>
        <Eyebrow color={GOLD}>{eyebrow}</Eyebrow>
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white max-w-3xl" style={{ fontFamily: "'Manrope', sans-serif", letterSpacing: '-0.02em', lineHeight: 1.1 }}>
          {title}
        </h1>
        <p className="mt-5 text-base md:text-lg max-w-2xl leading-relaxed" style={{ color: 'rgba(255,255,255,0.8)' }}>{subtitle}</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3">
          <Cta cta={primary} primary />
          {secondary && <Cta cta={secondary} />}
        </div>
        {note && <p className="mt-4 text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>{note}</p>}
      </div>
    </section>
  )
}

/** Feature cards grouped by stage, e.g. Before / During / After. */
export function StageGrid({ id = 'features', eyebrow, title, intro, stages }) {
  return (
    <section id={id} className="py-16 md:py-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="max-w-2xl mb-12">
          <Eyebrow>{eyebrow}</Eyebrow>
          <H2>{title}</H2>
          {intro && <p className="text-sm md:text-base leading-relaxed" style={{ color: MUTED }}>{intro}</p>}
        </div>
        <div className="space-y-12">
          {stages.map(group => (
            <div key={group.stage}>
              <h3 className="text-lg font-bold mb-4" style={{ color: GREEN }}>{group.stage}</h3>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {group.items.map(item => (
                  <div key={item.title} className="bg-white rounded-2xl p-5" style={{ border: `1px solid ${LINE}` }}>
                    <h4 className="font-bold text-sm mb-2" style={{ color: INK }}>{item.title}</h4>
                    <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function BulletColumns({ columns }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {columns.map(col => (
        <div key={col.title}>
          <h3 className="font-bold text-sm mb-3" style={{ color: INK }}>{col.title}</h3>
          <ul className="space-y-2 text-sm" style={{ color: BODY }}>
            {col.items.map(f => <li key={f} className="flex gap-2"><span style={{ color: GOLD }}>●</span>{f}</li>)}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function PlanCard({ name, price, sub, description, features, cta, highlight }) {
  const btnCls = 'mt-auto text-center px-5 py-2.5 rounded-full font-bold text-sm transition-opacity hover:opacity-90'
  const btnStyle = highlight ? { background: GREEN, color: '#fff' } : { border: `1px solid ${GREEN}`, color: GREEN }
  return (
    <div className="bg-white rounded-2xl p-6 flex flex-col" style={{ border: highlight ? `2px solid ${GREEN}` : `1px solid ${LINE}` }}>
      <h3 className="font-bold text-lg mb-1" style={{ color: INK }}>{name}</h3>
      <p className="text-sm mb-4" style={{ color: MUTED }}>{description}</p>
      <p className="text-2xl font-bold" style={{ color: INK }}>{price}</p>
      <p className="text-xs mb-5" style={{ color: MUTED }}>{sub}</p>
      <ul className="space-y-2 text-sm mb-6" style={{ color: BODY }}>
        {features.map(f => <li key={f} className="flex gap-2"><span style={{ color: GOLD }}>●</span>{f}</li>)}
      </ul>
      {cta.to
        ? <Link to={cta.to} className={btnCls} style={btnStyle}>{cta.text}</Link>
        : <a href={cta.href} className={btnCls} style={btnStyle}>{cta.text}</a>}
    </div>
  )
}

export function FaqSection({ title, faqs }) {
  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-8">
          <Eyebrow>FAQ</Eyebrow>
          <H2>{title}</H2>
        </div>
        <div className="divide-y" style={{ borderColor: '#e5e7eb' }}>
          {faqs.map(({ q, a }) => (
            <div key={q} className="py-5">
              <h3 className="font-semibold text-sm mb-2" style={{ color: INK }}>{q}</h3>
              <p className="text-sm leading-relaxed" style={{ color: MUTED }}>{a}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-center mt-6">
          <Link to="/faq" className="font-semibold" style={{ color: GREEN }}>See all FAQs →</Link>
        </p>
      </div>
    </section>
  )
}

/** Links to the other solution pages, so the three pages connect. */
export function OtherSolutions({ current }) {
  const others = SOLUTIONS.filter(s => s.key !== current)
  return (
    <section className="pb-4">
      <div className={`max-w-5xl mx-auto px-4 sm:px-6 grid gap-4 ${others.length > 2 ? 'md:grid-cols-3' : 'sm:grid-cols-2'}`}>
        {others.map(s => (
          <Link key={s.key} to={s.path} className="group block bg-white rounded-2xl p-6 transition-shadow hover:shadow-md" style={{ border: `1px solid ${LINE}` }}>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: GREEN }}>Also on Scorify</p>
            <p className="font-bold" style={{ color: INK }}>{s.title}</p>
            <p className="text-sm mt-1 mb-3" style={{ color: MUTED }}>{s.blurb}</p>
            <span className="text-sm font-semibold" style={{ color: GREEN }}>{s.linkText} →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function GuidesAndCta({ guides, ctaTitle, ctaText, cta }) {
  return (
    <section className="py-16 md:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 grid md:grid-cols-2 gap-8 items-stretch">
        <div className="bg-white rounded-2xl p-7" style={{ border: `1px solid ${LINE}` }}>
          <Eyebrow>Guides</Eyebrow>
          <ul className="space-y-3">
            {guides.map(g => (
              <li key={g.to}><Link to={g.to} className="text-sm font-semibold hover:underline" style={{ color: GREEN }}>{g.text} →</Link></li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl p-7 flex flex-col justify-center" style={{ background: `linear-gradient(135deg, #0b2318, ${GREEN})` }}>
          <h2 className="text-xl font-bold text-white mb-2">{ctaTitle}</h2>
          <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.75)' }}>{ctaText}</p>
          {cta.to
            ? <Link to={cta.to} className="self-start px-7 py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90" style={{ background: GOLD, color: '#1a1a1a' }}>{cta.text}</Link>
            : <a href={cta.href} className="self-start px-7 py-3 rounded-full font-bold text-sm transition-opacity hover:opacity-90" style={{ background: GOLD, color: '#1a1a1a' }}>{cta.text}</a>}
        </div>
      </div>
    </section>
  )
}

/** JSON-LD for a solution page: SoftwareApplication + breadcrumb + FAQ. */
export function landingJsonLd({ path, crumb, description, offer, faqs }) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Scorify Golf',
      applicationCategory: 'SportsApplication',
      operatingSystem: 'Web',
      url: `${SITE}${path}`,
      description,
      ...(offer ? { offers: { '@type': 'Offer', priceCurrency: 'USD', ...offer } } : {}),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: crumb, item: `${SITE}${path}` },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
  ]
}
