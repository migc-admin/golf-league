const MENU_ITEMS = [
  {
    title: 'Product',
    links: [
      { text: 'Features',  url: '#features' },
      { text: 'Pricing',   url: '#pricing'  },
      { text: 'Demo',      url: '#demo'     },
    ],
  },
  {
    title: 'Company',
    links: [
      { text: 'About',    url: '#about'            },
      { text: 'Blog',     url: '#blog'             },
      { text: 'Contact',  url: 'mailto:hello@scorifygolf.com' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { text: 'Terms & Conditions', url: '#terms'   },
      { text: 'Privacy Policy',     url: '#privacy' },
    ],
  },
  {
    title: 'Social',
    links: [
      { text: 'Twitter / X', url: 'https://twitter.com/scorifygolf'   },
      { text: 'Instagram',   url: 'https://instagram.com/scorifygolf' },
      { text: 'LinkedIn',    url: 'https://linkedin.com/company/scorifygolf' },
      { text: 'Facebook',    url: 'https://facebook.com/scorifygolf'  },
    ],
  },
]

export default function Footer() {
  return (
    <footer style={{ background: '#1d1d1f', color: '#f5f5f7' }}>
      <div className="max-w-6xl mx-auto px-6 pt-16 pb-8">

        {/* Top grid */}
        <div className="grid grid-cols-2 gap-10 lg:grid-cols-6 pb-12" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>

          {/* Brand */}
          <div className="col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: '#1B4332' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1L10.5 5.5H15L11.5 8.5L13 13L8 10L3 13L4.5 8.5L1 5.5H5.5L8 1Z" fill="#ffffff" />
                </svg>
              </div>
              <span className="font-bold text-white text-lg" style={{ letterSpacing: '-0.02em' }}>Scorify Golf</span>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: '#86868b' }}>
              Modern golf league management.<br />
              Scoring, leaderboards, and standings — built for the way your league plays.
            </p>
          </div>

          {/* Menu columns */}
          {MENU_ITEMS.map(section => (
            <div key={section.title}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-4" style={{ color: '#86868b' }}>
                {section.title}
              </h3>
              <ul className="space-y-3">
                {section.links.map(link => (
                  <li key={link.text}>
                    <a
                      href={link.url}
                      className="text-sm transition-colors"
                      style={{ color: '#a1a1aa' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
                      onMouseLeave={e => e.currentTarget.style.color = '#a1a1aa'}
                      target={link.url.startsWith('http') ? '_blank' : undefined}
                      rel={link.url.startsWith('http') ? 'noopener noreferrer' : undefined}
                    >
                      {link.text}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col gap-3 pt-8 md:flex-row md:items-center md:justify-between">
          <p className="text-xs" style={{ color: '#86868b' }}>
            © 2026 Scorify Golf. All rights reserved.
          </p>
          <div className="flex gap-6">
            <a href="#terms"   className="text-xs transition-colors" style={{ color: '#86868b' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.color = '#86868b'}>
              Terms &amp; Conditions
            </a>
            <a href="#privacy" className="text-xs transition-colors" style={{ color: '#86868b' }}
              onMouseEnter={e => e.currentTarget.style.color = '#ffffff'}
              onMouseLeave={e => e.currentTarget.style.color = '#86868b'}>
              Privacy Policy
            </a>
          </div>
        </div>

      </div>
    </footer>
  )
}
