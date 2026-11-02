/**
 * TripSiteHeader — the white site bar across the top of the public trip page.
 *
 *   (logo) Mulligan's Island Golf Club                          Home   Mulligan's Island   Special events
 *
 * The links are the same ones the old green bar had (Home plus each league). `activeKey` is the
 * `key` of the link to show in green; nothing is highlighted when none matches.
 */
import { Link } from 'react-router-dom'
import { initials } from '../../lib/tripView'

export default function TripSiteHeader({ name, logoUrl, links = [], activeKey = null }) {
  return (
    <header className="border-b border-surface-border bg-white">
      <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2 sm:px-6">
        <Link to="/" className="flex min-h-[44px] items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 shrink-0 rounded-full border border-surface-border object-cover" />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fairway-700 text-[11px] font-extrabold text-white" aria-hidden="true">
              {initials(name)}
            </span>
          )}
          <span className="text-[15px] font-bold text-ink">{name}</span>
        </Link>
        {links.length > 0 && <nav aria-label="Site" className="flex flex-wrap items-center gap-x-5">
          {links.map(l => (
            <Link
              key={l.key}
              to={l.to}
              aria-current={l.key === activeKey ? 'page' : undefined}
              className={`inline-flex min-h-[44px] items-center text-sm font-medium transition-colors ${l.key === activeKey ? 'font-bold text-fairway-700' : 'text-ink-muted hover:text-ink'}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>}
      </div>
    </header>
  )
}
