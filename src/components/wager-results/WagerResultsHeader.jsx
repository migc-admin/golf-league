/**
 * WagerResultsHeader — top of the wager results page.
 *
 *   (logo)  MULLIGAN'S ISLAND GOLF CLUB                     Find a bettor
 *           Playoffs - Round 1 · Wagers                     [ Search by bettor name ]
 *           Native Oaks · Sun, Oct 25, 2026  [Final · Settled]
 *
 * Presentational and controlled: the page owns the search text. `showSearch={false}` leaves the
 * search box out (the shareable PNG). Wraps on narrow screens.
 * Colors specific to this page (pill tint, ink) are local values; forest green reuses the
 * existing token.
 */

import { useId } from 'react'

export default function WagerResultsHeader({ clubName, title, meta, statusLabel, final, logoUrl, query = '', onQuery, showSearch = true }) {
  const searchId = useId()
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
      <div className="flex min-w-0 items-center gap-4">
        <img
          src={logoUrl}
          alt=""
          width="72"
          height="72"
          className="h-[72px] w-[72px] shrink-0 rounded-full border border-[#E4E1D8] bg-white object-cover"
        />
        <div className="min-w-0">
          {clubName && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-fairway-700">{clubName}</p>
          )}
          <h1 className="mt-0.5 text-[28px] font-bold leading-tight text-[#1A1A1A] sm:text-[32px]">{title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#5F5F5A]">
            {meta && <span>{meta}</span>}
            {statusLabel && (
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                  final ? 'bg-[#E6EFE9] text-fairway-700' : 'bg-status-upcoming-bg text-status-upcoming-text'
                }`}
              >
                {statusLabel}
              </span>
            )}
          </p>
        </div>
      </div>

      {showSearch && <div className="w-full sm:w-72">
        <label htmlFor={searchId} className="mb-1 block text-sm font-semibold text-[#1A1A1A]">Find a bettor</label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={e => onQuery(e.target.value)}
          placeholder="Search by bettor name"
          autoComplete="off"
          className="h-11 w-full rounded-lg border border-[#E4E1D8] bg-white px-3 text-sm text-[#1A1A1A] placeholder:text-[#5F5F5A] focus:border-fairway-700 focus:outline-none focus:ring-2 focus:ring-fairway-500"
        />
      </div>}
    </header>
  )
}
